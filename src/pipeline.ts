import { ScreenshotCapture } from './capture/screenshot.js';
import { JevGate } from './capture/jev-gate.js';
import { OpenAIVision } from './vision/openai.js';
import { ClaudeVision } from './vision/claude.js';
import { ChessValidator } from './chess/validator.js';
import { StockfishEngine } from './chess/engine.js';
import { SpeechSynthesizer } from './audio/speech.js';
import { WebServer } from './web/server.js';
import { Config, PipelineEvent, GameState } from './types.js';
import { writeFile, readFile } from 'fs/promises';

export class ChessHackerPipeline {
  private capture: ScreenshotCapture;
  private jevGate: JevGate;
  private vision: OpenAIVision | ClaudeVision;
  private validator: ChessValidator;
  private engine: StockfishEngine;
  private speech: SpeechSynthesizer;
  private webServer: WebServer;
  private config: Config;

  private running: boolean = false;
  private totalCost: number = 0;
  private frameCount: number = 0;
  private events: PipelineEvent[] = [];
  private pgnPath: string = './game.pgn';

  constructor(config: Config, credentials: { openaiApiKey?: string; claudeApiKey?: string; jevKey?: string }) {
    this.config = config;

    // Initialize components
    this.capture = new ScreenshotCapture();
    this.jevGate = new JevGate(credentials.jevKey);

    // Choose vision model
    if (config.visionModel === 'openai') {
      if (!credentials.openaiApiKey) {
        throw new Error('OpenAI API key required');
      }
      this.vision = new OpenAIVision(credentials.openaiApiKey);
    } else {
      if (!credentials.claudeApiKey) {
        throw new Error('Claude API key required');
      }
      this.vision = new ClaudeVision(credentials.claudeApiKey);
    }

    this.validator = new ChessValidator();
    this.engine = new StockfishEngine('/opt/homebrew/bin/stockfish', config.stockfishThinkTime);
    this.speech = new SpeechSynthesizer();
    this.webServer = new WebServer(this, config.portNumber);
  }

  /**
   * Initialize pipeline
   */
  async init(): Promise<void> {
    this.log('screenshot', { message: 'Initializing pipeline' });

    await this.capture.init();
    await this.engine.init();
    await this.webServer.start();

    this.log('screenshot', { message: 'Pipeline ready' });
  }

  /**
   * Start the main processing loop
   */
  async start(): Promise<void> {
    this.running = true;

    console.log(`Starting chesshacker as ${this.config.color}`);
    console.log(`Vision model: ${this.config.visionModel}`);
    console.log(`Max cost: $${this.config.maxCost}`);
    console.log('Press Ctrl+C to stop\n');

    // Main loop: capture → analyze → move
    while (this.running) {
      try {
        await this.processFrame();
        await this.sleep(this.config.screenshotInterval);
      } catch (error) {
        console.error('Frame processing error:', error);
        this.log('screenshot', { error });
      }
    }
  }

  /**
   * Process single frame (8-step pipeline)
   */
  private async processFrame(): Promise<void> {
    // Step 1: Screenshot WhatsApp call window
    const frame = await this.capture.captureFrame();
    this.frameCount++;
    this.log('screenshot', { frame: this.frameCount, path: frame.path });

    // Step 2: Jev gate - skip bad frames
    const shouldProcess = await this.jevGate.shouldProcess(frame);
    if (!shouldProcess) {
      this.log('jev-gate', { skipped: true, reason: 'quality filter' });
      return;
    }
    this.log('jev-gate', { passed: true });

    // Step 3: Vision AI - identify changed squares
    const currentFen = this.validator.getGameState().fen;
    const visionResult = await this.vision.analyzeBoard(frame.path, currentFen);
    this.log('vision', {
      changes: visionResult.changes.length,
      time: visionResult.timestamp
    });

    // Update cost
    this.updateCost();

    // Step 4: chess.js - match to legal move (2-frame confirmation)
    const move = this.validator.findLegalMove(visionResult.changes);
    if (!move) {
      this.log('validation', { matched: false });
      return;
    }
    this.log('validation', { move: move.san, fen: move.fen });

    // Step 5: chess.js - detect game end
    const gameState = this.validator.getGameState();
    this.log('game-state', {
      checkmate: gameState.isCheckmate,
      stalemate: gameState.isStalemate,
      draw: gameState.isDraw,
      check: gameState.isCheck
    });

    // Save game state
    await this.savePGN(gameState);

    // Step 6: Handle game outcome or get best reply
    if (gameState.isCheckmate) {
      await this.speech.speakOutcome('checkmate');
      this.stop();
      return;
    } else if (gameState.isStalemate) {
      await this.speech.speakOutcome('stalemate');
      this.stop();
      return;
    } else if (gameState.isDraw) {
      await this.speech.speakOutcome('draw');
      this.stop();
      return;
    }

    // Step 6A: Stockfish - calculate best reply
    const analysis = await this.engine.getBestMove(gameState.fen);
    this.log('engine', {
      bestMove: analysis.bestMove,
      evaluation: analysis.evaluation,
      depth: analysis.depth,
      time: analysis.time
    });

    // Step 7: Speak move through BlackHole 2ch
    const bestMoveSan = this.convertUciToSan(analysis.bestMove, gameState.fen);
    await this.speech.speakMove(bestMoveSan);
    this.log('speech', { spoken: bestMoveSan });

    console.log(`\n→ Opponent played: ${move.san}`);
    console.log(`← Recommended: ${bestMoveSan} (eval: ${analysis.evaluation}cp)\n`);
  }

  /**
   * Convert UCI move to SAN notation
   */
  private convertUciToSan(uci: string, fen: string): string {
    // Create temporary Chess instance to get SAN
    const { Chess } = require('chess.js');
    const tempChess = new Chess(fen);

    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.substring(4);

    const move = tempChess.move({ from, to, promotion: promotion || undefined });
    return move ? move.san : uci;
  }

  /**
   * Update cost tracking and check limit
   */
  private updateCost(): void {
    const costPerFrame = this.config.visionModel === 'openai' ? 0.014 : 0.04;
    this.totalCost += costPerFrame;

    if (this.totalCost >= this.config.maxCost) {
      console.warn(`\n⚠️  Max cost reached: $${this.totalCost.toFixed(2)}`);
      console.warn('Pausing. Adjust with --max-cost flag.\n');
      this.stop();
    }
  }

  /**
   * Save game to PGN file
   */
  private async savePGN(gameState: GameState): Promise<void> {
    try {
      await writeFile(this.pgnPath, gameState.pgn);
    } catch (error) {
      console.error('Failed to save PGN:', error);
    }
  }

  /**
   * Load game from PGN file
   */
  async loadPGN(): Promise<void> {
    try {
      const pgn = await readFile(this.pgnPath, 'utf-8');
      // TODO: Load PGN into validator
      console.log('Loaded game from', this.pgnPath);
    } catch (error) {
      console.log('No previous game found');
    }
  }

  /**
   * Stop pipeline
   */
  stop(): void {
    this.running = false;
    console.log('\nStopping pipeline...');
    console.log(`Total cost: $${this.totalCost.toFixed(2)}`);
    console.log(`Frames processed: ${this.frameCount}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.engine.stop();
    await this.capture.cleanup();
    await this.webServer.stop();
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.validator.getGameState();
  }

  /**
   * Get events log
   */
  getEvents(): PipelineEvent[] {
    return this.events;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalCost: this.totalCost,
      frameCount: this.frameCount,
      running: this.running,
      gameState: this.validator.getGameState()
    };
  }

  /**
   * Undo last move
   */
  undo(): void {
    const undone = this.validator.undo();
    if (undone) {
      console.log(`Undone move: ${undone.san}`);
    }
  }

  /**
   * Log pipeline event
   */
  private log(stage: PipelineEvent['stage'], data: unknown): void {
    const event: PipelineEvent = {
      stage,
      timestamp: Date.now(),
      data
    };
    this.events.push(event);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
