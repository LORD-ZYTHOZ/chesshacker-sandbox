import { readFile } from 'fs/promises';
import { VisionResponse, SquareChange } from '../types.js';

export class ClaudeVision {
  private apiKey: string;
  private model: string = 'claude-opus-5.5';
  private costPerFrame: number = 0.04; // dollars

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Analyze chess board image and detect changed squares
   */
  async analyzeBoard(imagePath: string, currentFen?: string): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      // Read image and convert to base64
      const imageBuffer = await readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Call Claude Vision API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: this.buildPrompt(currentFen)
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.content[0].text;

      // Parse JSON response
      const changes = this.parseResponse(content);

      return {
        changes,
        confidence: data.stop_reason === 'end_turn' ? 1.0 : 0.8,
        timestamp: Date.now() - startTime
      };

    } catch (error) {
      throw new Error(`Vision analysis failed: ${error}`);
    }
  }

  private buildPrompt(currentFen?: string): string {
    let prompt = `Analyze this chess board image and identify which squares have changed.

Return ONLY a JSON object in this exact format:
{
  "changes": [
    { "square": "e2", "now": "" },
    { "square": "e4", "now": "wP" }
  ]
}

Square notation: a1-h8 (standard chess coordinates)
Piece notation:
- wP, wN, wB, wR, wQ, wK (white pieces)
- bP, bN, bB, bR, bQ, bK (black pieces)
- "" (empty square)

Only report squares that have changed from the previous position.
`;

    if (currentFen) {
      prompt += `\nCurrent board position (FEN): ${currentFen}`;
    }

    return prompt;
  }

  private parseResponse(content: string): SquareChange[] {
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.changes || [];

    } catch (error) {
      console.error('Failed to parse vision response:', content);
      return [];
    }
  }

  getCostEstimate(framesProcessed: number): number {
    return framesProcessed * this.costPerFrame;
  }
}
