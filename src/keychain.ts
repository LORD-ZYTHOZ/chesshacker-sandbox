import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * macOS Keychain integration for secure API key storage
 */
export class Keychain {
  private static SERVICE_NAME = 'chesshacker';

  /**
   * Store API key in macOS Keychain
   */
  static async set(key: string, value: string): Promise<void> {
    try {
      // Delete existing key if present (ignore errors)
      await execAsync(
        `security delete-generic-password -s "${this.SERVICE_NAME}" -a "${key}" 2>/dev/null || true`
      );

      // Add new key
      await execAsync(
        `security add-generic-password -s "${this.SERVICE_NAME}" -a "${key}" -w "${value}"`
      );

    } catch (error) {
      throw new Error(`Failed to store key in Keychain: ${error}`);
    }
  }

  /**
   * Retrieve API key from macOS Keychain
   */
  static async get(key: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `security find-generic-password -s "${this.SERVICE_NAME}" -a "${key}" -w`
      );

      return stdout.trim();

    } catch (error) {
      // Key not found
      return null;
    }
  }

  /**
   * Delete API key from macOS Keychain
   */
  static async delete(key: string): Promise<void> {
    try {
      await execAsync(
        `security delete-generic-password -s "${this.SERVICE_NAME}" -a "${key}"`
      );
    } catch (error) {
      throw new Error(`Failed to delete key from Keychain: ${error}`);
    }
  }

  /**
   * Get all credentials needed for chesshacker
   */
  static async getAllCredentials(): Promise<{
    openaiApiKey?: string;
    claudeApiKey?: string;
    jevKey?: string;
  }> {
    const [openaiApiKey, claudeApiKey, jevKey] = await Promise.all([
      this.get('openai-api-key'),
      this.get('claude-api-key'),
      this.get('jev-key')
    ]);

    return {
      openaiApiKey: openaiApiKey || undefined,
      claudeApiKey: claudeApiKey || undefined,
      jevKey: jevKey || undefined
    };
  }

  /**
   * Interactive setup for API keys
   */
  static async setup(): Promise<void> {
    console.log('Chesshacker API Key Setup\n');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer: string) => {
          resolve(answer.trim());
        });
      });
    };

    try {
      // OpenAI API key (mandatory)
      const openaiKey = await question('OpenAI API key (required): ');
      if (openaiKey) {
        await this.set('openai-api-key', openaiKey);
        console.log('✓ OpenAI API key saved to Keychain\n');
      }

      // Claude API key (optional)
      const claudeKey = await question('Claude API key (optional, press Enter to skip): ');
      if (claudeKey) {
        await this.set('claude-api-key', claudeKey);
        console.log('✓ Claude API key saved to Keychain\n');
      }

      // Jev key (optional)
      const jevKey = await question('Jev key from TypeSafe (optional, press Enter to skip): ');
      if (jevKey) {
        await this.set('jev-key', jevKey);
        console.log('✓ Jev key saved to Keychain\n');
      }

      console.log('Setup complete! Keys stored securely in macOS Keychain.\n');

    } finally {
      rl.close();
    }
  }

  /**
   * Validate credentials are present
   */
  static async validate(visionModel: 'openai' | 'claude'): Promise<boolean> {
    const credentials = await this.getAllCredentials();

    if (visionModel === 'openai' && !credentials.openaiApiKey) {
      console.error('❌ OpenAI API key not found in Keychain');
      console.error('Run: npx chesshacker setup\n');
      return false;
    }

    if (visionModel === 'claude' && !credentials.claudeApiKey) {
      console.error('❌ Claude API key not found in Keychain');
      console.error('Run: npx chesshacker setup\n');
      return false;
    }

    return true;
  }
}
