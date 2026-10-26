import { exec } from 'child_process';
import { promisify } from 'util';
import { Frame } from '../types.js';

const execAsync = promisify(exec);

export class ScreenshotCapture {
  private outputDir: string;
  private frameCount: number = 0;

  constructor(outputDir: string = '/tmp/chesshacker-frames') {
    this.outputDir = outputDir;
  }

  async init(): Promise<void> {
    // Create output directory
    await execAsync(`mkdir -p ${this.outputDir}`);
  }

  /**
   * Capture screenshot of WhatsApp call window
   * Uses macOS screencapture with -x (no sound) and -o (opens in background)
   */
  async captureFrame(): Promise<Frame> {
    const timestamp = Date.now();
    const framePath = `${this.outputDir}/frame_${this.frameCount++}_${timestamp}.png`;

    try {
      // -x: no sound
      // -o: open file in default app (skipped here, we just save)
      // -t: format (png)
      await execAsync(`screencapture -x -t png "${framePath}"`);

      return {
        path: framePath,
        timestamp,
        isBlurry: false,      // Will be determined by jev-gate
        hasHands: false,      // Will be determined by jev-gate
        boardUnchanged: false // Will be determined by jev-gate
      };
    } catch (error) {
      throw new Error(`Screenshot failed: ${error}`);
    }
  }

  /**
   * Capture specific window by name (e.g., WhatsApp)
   */
  async captureWindow(windowName: string): Promise<Frame> {
    const timestamp = Date.now();
    const framePath = `${this.outputDir}/frame_${this.frameCount++}_${timestamp}.png`;

    try {
      // This requires window ID - simplified version for now
      // In production, would use AppleScript to get WhatsApp window ID
      await execAsync(`screencapture -l$(osascript -e 'tell app "WhatsApp" to id of window 1') -x -t png "${framePath}"`);

      return {
        path: framePath,
        timestamp,
        isBlurry: false,
        hasHands: false,
        boardUnchanged: false
      };
    } catch (error) {
      // Fallback to full screen capture
      console.warn('Window capture failed, falling back to full screen');
      return this.captureFrame();
    }
  }

  async cleanup(): Promise<void> {
    await execAsync(`rm -rf ${this.outputDir}`);
  }
}
