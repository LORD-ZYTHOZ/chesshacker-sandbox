import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { ChessHackerPipeline } from '../pipeline.js';

export class WebServer {
  private server: ReturnType<typeof createServer> | null = null;
  private pipeline: ChessHackerPipeline;
  private port: number;

  constructor(pipeline: ChessHackerPipeline, port: number = 8000) {
    this.pipeline = pipeline;
    this.port = port;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`Web interface: http://127.0.0.1:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      if (url === '/') {
        await this.serveHTML(res);
      } else if (url === '/api/stats') {
        await this.serveStats(res);
      } else if (url === '/api/state') {
        await this.serveGameState(res);
      } else if (url === '/api/events') {
        await this.serveEvents(res);
      } else if (url.startsWith('/api/undo') && req.method === 'POST') {
        await this.handleUndo(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (error) {
      res.writeHead(500);
      res.end(`Error: ${error}`);
    }
  }

  private async serveHTML(res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(this.getHTML());
  }

  private async serveStats(res: ServerResponse): Promise<void> {
    const stats = this.pipeline.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }

  private async serveGameState(res: ServerResponse): Promise<void> {
    const state = this.pipeline.getGameState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
  }

  private async serveEvents(res: ServerResponse): Promise<void> {
    const events = this.pipeline.getEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(events));
  }

  private async handleUndo(res: ServerResponse): Promise<void> {
    this.pipeline.undo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  private getHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>♟️ Chesshacker - Meta Glasses Assistant</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @keyframes slideIn {
      from { transform: translateX(-10px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16213e, #0f3460);
      background-size: 400% 400%;
      animation: gradient 15s ease infinite;
      color: #fff;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      animation: fadeIn 0.6s ease;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 30px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    h1 {
      font-size: 48px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
      letter-spacing: -1px;
    }

    .subtitle {
      color: #999;
      font-size: 16px;
      font-weight: 300;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      padding: 30px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);
      border-color: rgba(102, 126, 234, 0.5);
    }

    .stat-card:hover::before {
      transform: scaleX(1);
    }

    .stat-label {
      color: #999;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, #fff 0%, #999 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .stat-value.pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    @media (max-width: 1000px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }

    .board {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      padding: 30px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .board h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #667eea;
    }

    .board-state {
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      font-size: 18px;
      line-height: 1.8;
      white-space: pre;
      background: rgba(0, 0, 0, 0.3);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      overflow-x: auto;
    }

    .fen-display {
      margin-top: 20px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      color: #999;
      word-break: break-all;
    }

    .controls {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      letter-spacing: 0.5px;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }

    button:active {
      transform: translateY(0);
    }

    button:disabled {
      background: rgba(255, 255, 255, 0.1);
      cursor: not-allowed;
      box-shadow: none;
    }

    .events {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      padding: 30px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-height: 500px;
      overflow-y: auto;
    }

    .events::-webkit-scrollbar {
      width: 8px;
    }

    .events::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
    }

    .events::-webkit-scrollbar-thumb {
      background: rgba(102, 126, 234, 0.5);
      border-radius: 10px;
    }

    .events::-webkit-scrollbar-thumb:hover {
      background: rgba(102, 126, 234, 0.8);
    }

    .events h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #667eea;
    }

    .event {
      padding: 15px;
      margin-bottom: 10px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      border-left: 3px solid #667eea;
      animation: slideIn 0.3s ease;
      transition: all 0.2s ease;
    }

    .event:hover {
      background: rgba(102, 126, 234, 0.1);
      transform: translateX(5px);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .event-stage {
      color: #667eea;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .event-time {
      color: #666;
      font-size: 11px;
      font-family: monospace;
    }

    .event-data {
      color: #aaa;
      font-size: 12px;
      font-family: 'SF Mono', monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 10px;
      border-radius: 6px;
      margin-top: 8px;
      overflow-x: auto;
    }

    .status-running {
      color: #4ade80;
    }

    .status-stopped {
      color: #f87171;
    }

    .chess-piece {
      display: inline-block;
      font-size: 24px;
      margin: 0 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>♟️ CHESSHACKER</h1>
      <div class="subtitle">Meta Glasses Chess Assistant</div>
    </div>

    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-label">System Status</div>
        <div class="stat-value pulse" id="status">Running</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Frames Processed</div>
        <div class="stat-value" id="frames">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Cost</div>
        <div class="stat-value" id="cost">$0.00</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Current Turn</div>
        <div class="stat-value" id="turn">White</div>
      </div>
    </div>

    <div class="controls">
      <button onclick="undo()">⟲ Undo Move</button>
      <button onclick="refresh()">⟳ Refresh</button>
      <button onclick="togglePause()">⏸ Pause</button>
    </div>

    <div class="main-grid">
      <div class="board">
        <h2>♔ Board State</h2>
        <div class="board-state" id="board">Loading...</div>
        <div class="fen-display">
          <strong>FEN:</strong> <span id="fen">-</span>
        </div>
      </div>

      <div class="events">
        <h2>📊 Event Stream</h2>
        <div id="events">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    let autoRefresh = true;

    async function refresh() {
      try {
        // Get stats
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();

        const statusEl = document.getElementById('status');
        const isRunning = stats.running;
        statusEl.textContent = isRunning ? 'RUNNING' : 'STOPPED';
        statusEl.className = 'stat-value pulse ' + (isRunning ? 'status-running' : 'status-stopped');

        document.getElementById('frames').textContent = stats.frameCount.toLocaleString();
        document.getElementById('cost').textContent = '$' + stats.totalCost.toFixed(2);
        document.getElementById('turn').textContent = stats.gameState.turn === 'w' ? '⚪ White' : '⚫ Black';
        document.getElementById('fen').textContent = stats.gameState.fen;

        // Get board state
        const stateRes = await fetch('/api/state');
        const state = await stateRes.json();
        document.getElementById('board').innerHTML = formatBoard(state.fen);

        // Get events
        const eventsRes = await fetch('/api/events');
        const events = await eventsRes.json();
        renderEvents(events.slice(-20).reverse());

      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }

    function formatBoard(fen) {
      const pieceMap = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
      };

      const rows = fen.split(' ')[0].split('/');
      let board = '';

      for (const row of rows) {
        let line = '';
        for (const char of row) {
          if (isNaN(char)) {
            const piece = pieceMap[char] || char;
            line += '<span class="chess-piece">' + piece + '</span> ';
          } else {
            line += '· '.repeat(parseInt(char));
          }
        }
        board += line.trim() + '\\n';
      }
      return board;
    }

    function renderEvents(events) {
      const container = document.getElementById('events');
      if (events.length === 0) {
        container.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">No events yet</div>';
        return;
      }

      container.innerHTML = events.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        const dataStr = JSON.stringify(e.data, null, 2);
        return \`
          <div class="event">
            <div class="event-header">
              <span class="event-stage">\${e.stage}</span>
              <span class="event-time">\${time}</span>
            </div>
            <div class="event-data">\${dataStr}</div>
          </div>
        \`;
      }).join('');
    }

    async function undo() {
      try {
        await fetch('/api/undo', { method: 'POST' });
        await refresh();
      } catch (error) {
        console.error('Undo failed:', error);
      }
    }

    function togglePause() {
      autoRefresh = !autoRefresh;
      const btn = event.target;
      btn.textContent = autoRefresh ? '⏸ Pause' : '▶️ Resume';
    }

    // Auto-refresh every 2 seconds
    setInterval(() => {
      if (autoRefresh) refresh();
    }, 2000);

    refresh();
  </script>
</body>
</html>`;
  }
}
