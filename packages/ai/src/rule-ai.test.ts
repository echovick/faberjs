import { describe, expect, it, vi, afterEach } from 'vitest';

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

describe('AiRule', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass (return null) when AI returns valid:true', async () => {
    const { AiRule } = await import('./rule-ai');
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"valid":true}' }],
    });

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const rule = new AiRule('Must be professional');
    const result = await rule.validate('content', 'Hello, this is professional.', {});
    expect(result).toBeNull();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should fail with reason when AI returns valid:false', async () => {
    const { AiRule } = await import('./rule-ai');
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"valid":false,"reason":"Contains hate speech"}' }],
    });

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const rule = new AiRule('Must not contain hate speech');
    const result = await rule.validate('content', 'offensive content', {});
    expect(result).toBe('Contains hate speech');
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should fail open when AI call fails and failOpen is true', async () => {
    const { AiRule } = await import('./rule-ai');
    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error('API error'));

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const rule = new AiRule('Some rule', { failOpen: true });
    const result = await rule.validate('field', 'value', {});
    expect(result).toBeNull();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should fail closed when AI call fails and failOpen is false', async () => {
    const { AiRule } = await import('./rule-ai');
    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error('API error'));

    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    const rule = new AiRule('Some rule', { failOpen: false });
    const result = await rule.validate('field', 'value', {});
    expect(result).not.toBeNull();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('should pass (return null) when no API key is set', async () => {
    const { AiRule } = await import('./rule-ai');
    delete process.env['ANTHROPIC_API_KEY'];
    const rule = new AiRule('Some rule');
    const result = await rule.validate('field', 'value', {});
    expect(result).toBeNull();
  });

  it('should return null for null/undefined values', async () => {
    const { AiRule } = await import('./rule-ai');
    const rule = new AiRule('Some rule');
    expect(await rule.validate('field', null, {})).toBeNull();
    expect(await rule.validate('field', undefined, {})).toBeNull();
  });
});

describe('Rule.ai()', () => {
  it('should create an AiRule instance', async () => {
    const { Rule, AiRule } = await import('./rule-ai');
    const rule = Rule.ai('Must not contain spam');
    expect(rule).toBeInstanceOf(AiRule);
    expect(rule.name).toBe('ai');
  });
});
