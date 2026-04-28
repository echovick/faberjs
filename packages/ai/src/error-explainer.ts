import Anthropic from '@anthropic-ai/sdk';

const EXPLAINER_MODEL = 'claude-haiku-4-5-20251001';

const cache = new Map<string, string>();

function cacheKey(error: Error): string {
  const firstFrame = (error.stack ?? '').split('\n')[1] ?? '';
  return `${error.constructor.name}:${error.message}:${firstFrame}`;
}

export async function explainError(error: Error): Promise<string> {
  const key = cacheKey(error);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return '';

  const client = new Anthropic({ apiKey });
  const stackLines = (error.stack ?? '').split('\n').slice(0, 6).join('\n');

  try {
    const result = await client.messages.create({
      model: EXPLAINER_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `A developer is seeing this error in their FaberJS (Node.js/TypeScript) application:

${error.constructor.name}: ${error.message}
Stack:
${stackLines}

Explain in 3-4 sentences: what caused this, why it commonly happens, and one concrete fix. Be practical and direct.`,
        },
      ],
    });

    const explanation = result.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    cache.set(key, explanation);
    return explanation;
  } catch {
    return '';
  }
}

export function clearExplainerCache(): void {
  cache.clear();
}
