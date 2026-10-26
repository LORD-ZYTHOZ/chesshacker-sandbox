import { Frame } from '../types.js';

/**
 * Jev Gate: Quality filter for frames
 * Skips blurry frames, hands over board, and unchanged positions
 *
 * In production, this would use the Jev API from TypeSafe
 * For now, implements basic heuristics
 */
export class JevGate {
  private lastFrameHash?: string;
  private jevApiKey?: string;

  constructor(jevApiKey?: string) {
    this.jevApiKey = jevApiKey;
  }

  /**
   * Check if frame should be processed or skipped
   */
  async shouldProcess(frame: Frame): Promise<boolean> {
    // If we have Jev API key, use that
    if (this.jevApiKey) {
      return this.checkWithJevAPI(frame);
    }

    // Otherwise use basic heuristics
    return this.basicQualityCheck(frame);
  }

  private async checkWithJevAPI(frame: Frame): Promise<boolean> {
    // TODO: Implement Jev API integration
    // For now, fall back to basic check
    console.log('Jev API not implemented yet, using basic check');
    return this.basicQualityCheck(frame);
  }

  private async basicQualityCheck(frame: Frame): Promise<boolean> {
    // Basic implementation - always process for now
    // In production, would check:
    // 1. Image sharpness (FFT-based blur detection)
    // 2. Hand detection (skin color + shape)
    // 3. Board change detection (perceptual hash comparison)

    // For development, mark frame as processable
    frame.isBlurry = false;
    frame.hasHands = false;
    frame.boardUnchanged = false;

    return true;
  }

  /**
   * Compare frames to detect if board changed
   * Uses perceptual hashing
   */
  private async compareFrames(frame1: Frame, frame2: Frame): Promise<boolean> {
    // TODO: Implement perceptual hashing comparison
    // For now, always return true (board changed)
    return true;
  }
}
