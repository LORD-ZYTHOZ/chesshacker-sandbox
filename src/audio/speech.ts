import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SpeechSynthesizer {
  private audioDevice: string = 'BlackHole 2ch';
  private voice: string = 'Samantha'; // macOS voice

  constructor(audioDevice?: string, voice?: string) {
    if (audioDevice) this.audioDevice = audioDevice;
    if (voice) this.voice = voice;
  }

  /**
   * Speak text through BlackHole 2ch (routes to Meta glasses via WhatsApp)
   */
  async speak(text: string): Promise<void> {
    try {
      // macOS 'say' command
      // Routes audio through BlackHole 2ch virtual device
      await execAsync(`say -v "${this.voice}" "${this.escapeText(text)}"`);

    } catch (error) {
      throw new Error(`Speech synthesis failed: ${error}`);
    }
  }

  /**
   * Speak chess move in clear format
   */
  async speakMove(san: string): Promise<void> {
    const spoken = this.convertMoveToSpeech(san);
    await this.speak(spoken);
  }

  /**
   * Speak game outcome
   */
  async speakOutcome(outcome: 'checkmate' | 'stalemate' | 'draw'): Promise<void> {
    const messages = {
      checkmate: 'Checkmate',
      stalemate: 'Stalemate',
      draw: 'Draw'
    };

    await this.speak(messages[outcome]);
  }

  /**
   * Convert chess move notation to speakable format
   * e.g., "Nf3" -> "Knight to f 3"
   *       "e4" -> "e 4"
   *       "O-O" -> "Castle kingside"
   */
  private convertMoveToSpeech(san: string): string {
    // Castling
    if (san === 'O-O') return 'Castle kingside';
    if (san === 'O-O-O') return 'Castle queenside';

    // Parse SAN notation
    const pieceNames: Record<string, string> = {
      'N': 'Knight',
      'B': 'Bishop',
      'R': 'Rook',
      'Q': 'Queen',
      'K': 'King'
    };

    let result = '';

    // Extract piece (first character if uppercase)
    if (san[0] && san[0] === san[0].toUpperCase() && pieceNames[san[0]]) {
      result += pieceNames[san[0]] + ' ';
      san = san.substring(1);
    }

    // Remove capture symbol
    san = san.replace('x', '');

    // Remove check/checkmate symbols
    san = san.replace('+', '');
    san = san.replace('#', '');

    // Add "to"
    if (result) {
      result += 'to ';
    }

    // Speak file (a-h) and rank (1-8) separately
    // e.g., "e4" -> "e 4"
    for (let i = 0; i < san.length; i++) {
      result += san[i] + ' ';
    }

    return result.trim();
  }

  /**
   * Escape text for shell command
   */
  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * Check if BlackHole 2ch is installed
   */
  static async isBlackHoleInstalled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('system_profiler SPAudioDataType');
      return stdout.includes('BlackHole 2ch');
    } catch {
      return false;
    }
  }

  /**
   * List available voices
   */
  static async listVoices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('say -v "?"');
      return stdout.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(/\s+/)[0]);
    } catch {
      return [];
    }
  }
}
