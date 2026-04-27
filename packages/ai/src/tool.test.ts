import { describe, expect, it } from 'vitest';
import { Tool, getToolMeta } from './tool';

class SampleAgent {
  @Tool({ description: 'Get the weather for a city' })
  async getWeather(_input: Record<string, unknown>): Promise<string> {
    return 'sunny';
  }

  @Tool({
    description: 'Search the database',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  })
  async search(_input: Record<string, unknown>): Promise<string[]> {
    return [];
  }

  notATool(): void {
    // no @Tool decorator
  }
}

describe('@Tool() decorator', () => {
  it('stores tool metadata on the class prototype', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    expect(meta.length).toBe(2);
  });

  it('captures method name as tool name', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    const names = meta.map((m) => m.name);
    expect(names).toContain('getWeather');
    expect(names).toContain('search');
  });

  it('stores the tool description', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    const weather = meta.find((m) => m.name === 'getWeather');
    expect(weather?.description).toBe('Get the weather for a city');
  });

  it('stores a default empty schema when inputSchema is omitted', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    const weather = meta.find((m) => m.name === 'getWeather');
    expect(weather?.inputSchema).toEqual({ type: 'object', properties: {} });
  });

  it('stores the provided inputSchema', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    const search = meta.find((m) => m.name === 'search');
    expect(search?.inputSchema.required).toEqual(['query']);
  });

  it('does not include methods without @Tool', () => {
    const agent = new SampleAgent();
    const meta = getToolMeta(agent);
    const names = meta.map((m) => m.name);
    expect(names).not.toContain('notATool');
  });
});
