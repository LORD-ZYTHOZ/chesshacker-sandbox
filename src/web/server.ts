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
  <title>Chesshacker Control Panel</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1a1a1a;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 20px; font-size: 24px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #3a3a3a;
    }
    .stat-label { color: #888; font-size: 12px; margin-bottom: 5px; }
    .stat-value { font-size: 24px; font-weight: 600; }
    .board {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #3a3a3a;
      margin-bottom: 20px;
    }
    .board-state {
      font-family: monospace;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre;
    }
    .controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    button {
      background: #0066cc;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: #0052a3; }
    button:disabled {
      background: #555;
      cursor: not-allowed;
    }
    .events {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #3a3a3a;
      max-height: 400px;
      overflow-y: auto;
    }
    .event {
      padding: 10px;
      border-bottom: 1px solid #3a3a3a;
      font-size: 13px;
    }
    .event:last-child { border-bottom: none; }
    .event-stage {
      color: #0066cc;
      font-weight: 600;
      margin-right: 10px;
    }
    .event-time {
      color: #666;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Chesshacker Control Panel</h1>

    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-label">Status</div>
        <div class="stat-value" id="status">Running</div>
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
        <div class="stat-label">Turn</div>
        <div class="stat-value" id="turn">White</div>
      </div>
    </div>

    <div class="controls">
      <button onclick="undo()">Undo Move</button>
      <button onclick="refresh()">Refresh</button>
    </div>

    <div class="board">
      <h2 style="margin-bottom: 15px;">Board State</h2>
      <div class="board-state" id="board">Loading...</div>
      <div style="margin-top: 15px; color: #888; font-size: 13px;">
        FEN: <span id="fen">-</span>
      </div>
    </div>

    <div class="events">
      <h2 style="margin-bottom: 15px;">Event Log</h2>
      <div id="events">Loading...</div>
    </div>
  </div>

  <script>
    async function refresh() {
      try {
        // Get stats
        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();

        document.getElementById('status').textContent = stats.running ? 'Running' : 'Stopped';
        document.getElementById('frames').textContent = stats.frameCount;
        document.getElementById('cost').textContent = '$' + stats.totalCost.toFixed(2);
        document.getElementById('turn').textContent = stats.gameState.turn === 'w' ? 'White' : 'Black';
        document.getElementById('fen').textContent = stats.gameState.fen;

        // Get board state
        const stateRes = await fetch('/api/state');
        const state = await stateRes.json();
        document.getElementById('board').textContent = formatBoard(state.fen);

        // Get events
        const eventsRes = await fetch('/api/events');
        const events = await eventsRes.json();
        renderEvents(events.slice(-20).reverse());

      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }

    function formatBoard(fen) {
      const rows = fen.split(' ')[0].split('/');
      let board = '';
      for (const row of rows) {
        let line = '';
        for (const char of row) {
          if (isNaN(char)) {
            line += char + ' ';
          } else {
            line += '. '.repeat(parseInt(char));
          }
        }
        board += line.trim() + '\\n';
      }
      return board;
    }

    function renderEvents(events) {
      const container = document.getElementById('events');
      container.innerHTML = events.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        return \`
          <div class="event">
            <span class="event-stage">\${e.stage}</span>
            <span class="event-time">\${time}</span>
            <div style="margin-top: 5px; color: #aaa;">\${JSON.stringify(e.data)}</div>
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

    // Auto-refresh every 2 seconds
    setInterval(refresh, 2000);
    refresh();
  </script>
</body>
</html>`;
  }
}
