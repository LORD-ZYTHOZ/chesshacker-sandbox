import { spawn, ChildProcess } from 'child_process';
import { EngineAnalysis } from '../types.js';

export class StockfishEngine {
  private process: ChildProcess | null = null;
  private ready: boolean = false;
  private stockfishPath: string;
  private thinkTime: number; // milliseconds

  constructor(stockfishPath: string = '/opt/homebrew/bin/stockfish', thinkTime: number = 500) {
    this.stockfishPath = stockfishPath;
    this.thinkTime = thinkTime;
  }

  /**
   * Initialize Stockfish engine
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.stockfishPath);

        this.process.stdout?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('uciok')) {
            this.ready = true;
            resolve();
          }
        });

        this.process.stderr?.on('data', (data) => {
          console.error('Stockfish error:', data.toString());
        });

        this.process.on('error', (error) => {
          reject(new Error(`Failed to start Stockfish: ${error.message}`));
        });

        // Send UCI command to initialize
        this.send('uci');

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!this.ready) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Analyze position and get best move
   */
  async getBestMove(fen: string): Promise<EngineAnalysis> {
    if (!this.ready || !this.process || !this.process.stdout) {
      throw new Error('Stockfish engine not initialized');
    }

    const process = this.process; // Capture for type narrowing

    return new Promise((resolve, reject) => {
      let bestMove: string = '';
      let evaluation: number = 0;
      let depth: number = 0;
      const startTime = Date.now();

      const dataHandler = (data: Buffer) => {
        const output = data.toString();
        const lines = output.split('\n');

        for (const line of lines) {
          // Parse evaluation
          if (line.includes('score cp')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
              evaluation = parseInt(match[1]);
            }
          }

          // Parse depth
          if (line.includes('depth')) {
            const match = line.match(/depth (\d+)/);
            if (match) {
              depth = parseInt(match[1]);
            }
          }

          // Parse best move
          if (line.startsWith('bestmove')) {
            const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (match) {
              bestMove = match[1];

              this.process?.stdout?.off('data', dataHandler);

              resolve({
                bestMove,
                evaluation,
                depth,
                time: Date.now() - startTime
              });
            }
          }
        }
      };

      process.stdout!.on('data', dataHandler);

      // Send position and search command
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${this.thinkTime}`);

      // Timeout after thinkTime + 2 seconds
      setTimeout(() => {
        if (this.process?.stdout) {
          this.process.stdout.off('data', dataHandler);
        }
        reject(new Error('Engine analysis timeout'));
      }, this.thinkTime + 2000);
    });
  }

  /**
   * Send UCI command to engine
   */
  private send(command: string): void {
    if (!this.process?.stdin) {
      throw new Error('Stockfish not running');
    }
    this.process.stdin.write(command + '\n');
  }

  /**
   * Stop engine
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.send('quit');
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }

  /**
   * Check if Stockfish is installed
   */
  static async isInstalled(path: string = '/opt/homebrew/bin/stockfish'): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync(`test -f ${path}`);
      return true;
    } catch {
      return false;
    }
  }
}
