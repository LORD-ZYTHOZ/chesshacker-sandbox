#!/usr/bin/env node

import { ChessHackerPipeline } from './pipeline.js';
import { Keychain } from './keychain.js';
import { StockfishEngine } from './chess/engine.js';
import { SpeechSynthesizer } from './audio/speech.js';
import { Config } from './types.js';

const USAGE = `
Chesshacker - Meta glasses chess assistant

USAGE:
  npx chesshacker <command> [options]

COMMANDS:
  run           Start chess assistance
  setup         Configure API keys in Keychain
  test-call     Test WhatsApp call integration
  doctor        Run system diagnostics
  windows       List available windows for capture

RUN OPTIONS:
  --color       white|black (required)
  --fen         Start from custom position (optional)
  --max-cost    Maximum spend in dollars (default: 10)
  --model       openai|claude (default: openai)
  --think-time  Stockfish think time in ms (default: 500)

EXAMPLES:
  npx chesshacker run --color white
  npx chesshacker run --color black --fen "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  npx chesshacker setup
  npx chesshacker doctor
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'run':
        await runCommand(args.slice(1));
        break;

      case 'setup':
        await setupCommand();
        break;

      case 'test-call':
        await testCallCommand();
        break;

      case 'doctor':
        await doctorCommand();
        break;

      case 'windows':
        await windowsCommand();
        break;

      default:
        console.error(`Unknown command: ${command}\n`);
        console.log(USAGE);
        process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function runCommand(args: string[]) {
  // Parse arguments
  const config: Config = {
    color: getArg(args, '--color') as 'white' | 'black',
    maxCost: parseFloat(getArg(args, '--max-cost') || '10'),
    visionModel: (getArg(args, '--model') || 'openai') as 'openai' | 'claude',
    stockfishThinkTime: parseInt(getArg(args, '--think-time') || '500'),
    screenshotInterval: 1000, // 1 second
    portNumber: 8000
  };

  const fen = getArg(args, '--fen');

  // Validate
  if (!config.color) {
    console.error('Error: --color is required (white or black)\n');
    console.log(USAGE);
    process.exit(1);
  }

  // Check credentials
  const valid = await Keychain.validate(config.visionModel);
  if (!valid) {
    process.exit(1);
  }

  // Get credentials from Keychain
  const credentials = await Keychain.getAllCredentials();

  // Create pipeline
  const pipeline = new ChessHackerPipeline(config, credentials);

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    pipeline.stop();
    await pipeline.cleanup();
    process.exit(0);
  });

  // Initialize and start
  await pipeline.init();

  if (fen) {
    console.log(`Starting from position: ${fen}\n`);
  }

  await pipeline.start();
  await pipeline.cleanup();
}

async function setupCommand() {
  await Keychain.setup();
}

async function testCallCommand() {
  console.log('Testing WhatsApp call integration...\n');

  // Test speech
  console.log('1. Testing speech synthesis...');
  const speech = new SpeechSynthesizer();
  await speech.speak('Testing chesshacker audio');
  console.log('✓ Speech synthesis working\n');

  // Test screenshot
  console.log('2. Testing screenshot capture...');
  const { ScreenshotCapture } = await import('./capture/screenshot.js');
  const capture = new ScreenshotCapture();
  await capture.init();
  const frame = await capture.captureFrame();
  console.log(`✓ Screenshot saved to: ${frame.path}\n`);
  await capture.cleanup();

  console.log('Test complete!\n');
}

async function doctorCommand() {
  console.log('Running system diagnostics...\n');

  let allGood = true;

  // Check Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.split('.')[0].substring(1));
  if (nodeMajor >= 22) {
    console.log(`✓ Node.js ${nodeVersion} (>= 22 required)`);
  } else {
    console.log(`✗ Node.js ${nodeVersion} (>= 22 required)`);
    allGood = false;
  }

  // Check Stockfish
  const stockfishInstalled = await StockfishEngine.isInstalled();
  if (stockfishInstalled) {
    console.log('✓ Stockfish installed');
  } else {
    console.log('✗ Stockfish not found at /opt/homebrew/bin/stockfish');
    console.log('  Install: brew install stockfish');
    allGood = false;
  }

  // Check BlackHole 2ch
  const blackholeInstalled = await SpeechSynthesizer.isBlackHoleInstalled();
  if (blackholeInstalled) {
    console.log('✓ BlackHole 2ch installed');
  } else {
    console.log('✗ BlackHole 2ch not found');
    console.log('  Install: brew install blackhole-2ch');
    allGood = false;
  }

  // Check API keys
  const credentials = await Keychain.getAllCredentials();
  if (credentials.openaiApiKey) {
    console.log('✓ OpenAI API key configured');
  } else {
    console.log('✗ OpenAI API key not found');
    console.log('  Run: npx chesshacker setup');
    allGood = false;
  }

  if (credentials.claudeApiKey) {
    console.log('✓ Claude API key configured');
  } else {
    console.log('  Claude API key not configured (optional)');
  }

  if (credentials.jevKey) {
    console.log('✓ Jev key configured');
  } else {
    console.log('  Jev key not configured (optional)');
  }

  console.log('');

  if (allGood) {
    console.log('✓ All systems ready!\n');
  } else {
    console.log('⚠️  Some components need attention\n');
    process.exit(1);
  }
}

async function windowsCommand() {
  console.log('Available windows for capture:\n');
  console.log('(Feature not yet implemented)');
  console.log('For now, chesshacker captures full screen\n');
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

main();
