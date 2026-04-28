import Anthropic from '@anthropic-ai/sdk';
import { Rule as BaseRule } from '@faber-js/validation';
import type { InputData, RuleObject, RuleValue } from '@faber-js/validation';

const DEFAULT_VALIDATION_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 3000;

export class AiRule implements RuleObject {
  readonly name = 'ai';
  readonly #description: string;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #failOpen: boolean;

  constructor(
    description: string,
    options: { model?: string; timeoutMs?: number; failOpen?: boolean } = {},
  ) {
    this.#description = description;
    this.#model = options.model ?? DEFAULT_VALIDATION_MODEL;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#failOpen = options.failOpen ?? true;
  }

  async validate(field: string, value: RuleValue, _data: InputData): Promise<string | null> {
    if (value === null || value === undefined) return null;

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return null;

    const client = new Anthropic({ apiKey });

    try {
      const response = await Promise.race([
        client.messages.create({
          model: this.#model,
          max_tokens: 150,
          messages: [
            {
              role: 'user',
              content: `Validate the following field value against the given rule.
Field name: ${field}
Field value: ${String(value)}
Rule: ${this.#description}

Respond with ONLY valid JSON: {"valid":true} if the value passes the rule, or {"valid":false,"reason":"brief explanation"} if it fails. No other text.`,
            },
          ],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ai_validation_timeout')), this.#timeoutMs),
        ),
      ]);

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      const parsed = JSON.parse(text) as { valid: boolean; reason?: string };
      if (!parsed.valid) {
        return parsed.reason ?? `The ${field} failed AI validation.`;
      }
      return null;
    } catch {
      return this.#failOpen ? null : `The ${field} failed AI validation.`;
    }
  }
}

export class Rule extends BaseRule {
  static ai(
    description: string,
    options?: { model?: string; timeoutMs?: number; failOpen?: boolean },
  ): AiRule {
    return new AiRule(description, options);
  }
}
