# Chesshacker Sandbox

Meta glasses chess assistant - reconstructed from [reverse.dev/pjchess](https://www.reverse.dev/pjchess#workflow) specifications.

## Overview

Real-time chess assistance through Meta glasses via WhatsApp call:
- Screenshots WhatsApp call window (~1fps)
- Vision AI detects board changes (OpenAI gpt-6.1-sol or Claude Opus 5.5)
- Validates legal moves with chess.js
- Stockfish calculates best reply (500ms)
- Speaks move through BlackHole 2ch into Meta glasses

**Processing time:** ~10 seconds from opponent's move to spoken response

## Architecture (8-Step Pipeline)

| Step | Component | Function |
|------|-----------|----------|
| 1 | WhatsApp trigger | Screenshot call window (~1/second) |
| 2 | Jev gate | Skip blurry frames, hands, unchanged boards |
| 3 | OpenAI/Claude | Identify changed squares |
| 4 | chess.js | Match changes to legal moves (2-frame confirmation) |
| 5 | chess.js | Detect checkmate/stalemate/draw |
| 6A | Stockfish | Calculate best reply (500ms thinking) |
| 6B | chess.js | Determine game outcome if ended |
| 7 | BlackHole 2ch | Speak result into glasses |

## Prerequisites

### System Requirements
- macOS
- Node.js 22+ (you have v24.11.1 ✓)
- WhatsApp (Mac App Store)
- BlackHole 2ch: `brew install blackhole-2ch`
- Screen Recording permission for Terminal

### API Keys (stored in macOS Keychain)
- **OpenAI API key** (mandatory) - ~$0.014/frame with gpt-6.1-sol
- **Jev key** from TypeSafe (optional, reduces costs)

### Dependencies
- chess.js v1.4 (game rules, legal moves)
- ffmpeg-static v5.3 (media handling)
- Stockfish sf_19 (chess engine)

## Installation

```bash
cd ~/chesshacker-sandbox
npm install
npm run build
```

## Configuration

### Cost Protection
Default max spend: $10 (adjustable with `--max-cost` flag)

### Vision Model Options
- **gpt-6.1-sol** (default): ~1.4¢/frame, 4-5s latency
- **Claude Opus 5.5**: ~4¢/frame, 3.6-6.3s latency

### WhatsApp Audio Setup
1. Set microphone to BlackHole 2ch in WhatsApp call settings
2. Speech routes through virtual audio device into glasses

## Usage

```bash
# Play as white
npx chesshacker run --color white

# Play as black with custom position
npx chesshacker run --color black --fen "<position>"

# Test WhatsApp call integration
npx chesshacker test-call

# System diagnostics
npx chesshacker doctor

# Window management
npx chesshacker windows
```

## Web Interface

Control interface at `http://127.0.0.1:8000` during gameplay:
- Live call frame preview
- Board state visualization with move arrows
- Controls: pause, undo, manual move entry, repeat announcement

## Game State

- Persists in `game.pgn`
- Move confirmation requires 2-frame agreement
- Minimum 3 square changes to register move

## Security Notes

✅ **Safe:**
- API keys in macOS Keychain (not hardcoded)
- Local processing only
- No data exfiltration

⚠️ **Watch:**
- Screen Recording permission required
- Real API costs (monitor spending)
- Untested on live WhatsApp calls (only tested with glass recordings)

## Project Structure

```
chesshacker-sandbox/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── pipeline.ts         # 8-step processing pipeline
│   ├── vision/
│   │   ├── openai.ts       # OpenAI vision integration
│   │   └── claude.ts       # Claude vision integration
│   ├── chess/
│   │   ├── validator.ts    # chess.js move validation
│   │   └── engine.ts       # Stockfish UCI interface
│   ├── capture/
│   │   ├── screenshot.ts   # macOS screencapture wrapper
│   │   └── jev-gate.ts     # Frame quality filtering
│   ├── audio/
│   │   └── speech.ts       # macOS 'say' → BlackHole 2ch
│   └── web/
│       └── server.ts       # Control interface (port 8000)
├── game.pgn                # Game state persistence
├── package.json
├── tsconfig.json
└── README.md
```

## Credits

Original: picklerpeej @ reverse.dev/pjchess
Reconstructed from public specs for educational/research purposes

## License

MIT (reconstruction - original license unknown)
