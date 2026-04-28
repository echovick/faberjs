import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  (Anthropic as unknown as Record<string, unknown>).__mockCreate = mockCreate;
  return { default: Anthropic };
});

async function getMockCreate(): Promise<ReturnType<typeof vi.fn>> {
  const mod = await import('@anthropic-ai/sdk');
  const A = mod.default as unknown as Record<string, unknown>;
  return A['__mockCreate'] as ReturnType<typeof vi.fn>;
}

describe('explainError()', () => {
  beforeEach(async () => {
    const { clearExplainerCache } = await import('./error-explainer');
    clearExplainerCache();
    (await getMockCreate()).mockReset();
  });

  it('should return empty string when no API key is set', async () => {
    const { explainError } = await import('./error-explainer');
    delete process.env['ANTHROPIC_API_KEY'];
    const result = await explainError(new Error('Some error'));
    expect(result).toBe('');
  });

  it('should return explanation from AI', async () => {
    const { explainError } = await import('./error-explainer');
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This error means X happened because Y.' }],
    });

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const error = new TypeError('Cannot read property of undefined');
    const result = await explainError(error);
    expect(result).toBe('This error means X happened because Y.');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should cache the explanation for the same error', async () => {
    const { explainError } = await import('./error-explainer');
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Cached explanation' }],
    });

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const error = new TypeError('Unique message for caching');
    await explainError(error);
    await explainError(error);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should return empty string when AI call fails', async () => {
    const { explainError } = await import('./error-explainer');
    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error('API down'));

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const result = await explainError(new RangeError('Out of range'));
    expect(result).toBe('');
    delete process.env['ANTHROPIC_API_KEY'];
  });
});

describe('clearExplainerCache()', () => {
  it('should clear the cache so the next call re-queries AI', async () => {
    const { explainError, clearExplainerCache } = await import('./error-explainer');
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'explanation' }],
    });

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const error = new Error('Cache clear test');
    await explainError(error);
    clearExplainerCache();
    await explainError(error);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    delete process.env['ANTHROPIC_API_KEY'];
  });
});
