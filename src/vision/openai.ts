import { readFile } from 'fs/promises';
import { VisionResponse, SquareChange } from '../types.js';

export class OpenAIVision {
  private apiKey: string;
  private model: string = 'gpt-6.1-sol';
  private costPerFrame: number = 0.014; // dollars

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

      // Call OpenAI Vision API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: this.buildPrompt(currentFen)
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices[0].message.content;

      // Parse JSON response
      const changes = this.parseResponse(content);

      return {
        changes,
        confidence: data.choices[0].finish_reason === 'stop' ? 1.0 : 0.8,
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
