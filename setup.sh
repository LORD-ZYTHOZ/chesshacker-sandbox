#!/bin/bash
set -e

echo "🔧 Chesshacker Setup Script"
echo "==========================="
echo ""

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 22 ]; then
    echo "   ✓ Node.js $(node -v) installed"
else
    echo "   ✗ Node.js 22+ required (you have: $(node -v))"
    echo "   Install: brew install node"
    exit 1
fi

# Install dependencies
echo ""
echo "2. Installing npm dependencies..."
npm install
echo "   ✓ Dependencies installed"

# Build TypeScript
echo ""
echo "3. Building TypeScript..."
npm run build
echo "   ✓ Build complete"

# Check Stockfish
echo ""
echo "4. Checking Stockfish..."
if command -v stockfish &> /dev/null; then
    echo "   ✓ Stockfish installed"
else
    echo "   ✗ Stockfish not found"
    echo "   Installing Stockfish..."
    brew install stockfish
    echo "   ✓ Stockfish installed"
fi

# Check BlackHole 2ch
echo ""
echo "5. Checking BlackHole 2ch..."
if system_profiler SPAudioDataType 2>/dev/null | grep -q "BlackHole 2ch"; then
    echo "   ✓ BlackHole 2ch installed"
else
    echo "   ⚠️  BlackHole 2ch not installed"
    echo "   Install with: brew install blackhole-2ch"
    echo "   (requires sudo password)"
fi

# Setup API keys
echo ""
echo "6. Setting up API keys..."
echo ""
read -p "   Do you want to configure API keys now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx chesshacker setup
else
    echo "   ⚠️  Skipping API key setup"
    echo "   Run later with: npx chesshacker setup"
fi

# Final check
echo ""
echo "7. Running system diagnostics..."
echo ""
npx chesshacker doctor

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. If BlackHole 2ch is not installed: brew install blackhole-2ch"
echo "  2. If API keys not configured: npx chesshacker setup"
echo "  3. Open WhatsApp and set microphone to BlackHole 2ch in call settings"
echo "  4. Grant Terminal Screen Recording permission (System Settings > Privacy)"
echo "  5. Run: npx chesshacker run --color white"
echo ""
echo "Documentation: ~/chesshacker-sandbox/README.md"
echo "Web UI: http://127.0.0.1:8000 (when running)"
echo ""
