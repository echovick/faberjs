import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Application } from '@faberjs/core';
import { Tool } from './tool';
import { Agent } from './agent';

// Mock the Anthropic SDK before importing Agent
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  const mockStream = vi.fn();

  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  }));

  (Anthropic as unknown as Record<string, unknown>).__mockCreate = mockCreate;
  (Anthropic as unknown as Record<string, unknown>).__mockStream = mockStream;

  return { default: Anthropic };
});

async function getAnthropicMocks(): Promise<{
  mockCreate: ReturnType<typeof vi.fn>;
  mockStream: ReturnType<typeof vi.fn>;
}> {
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default as unknown as Record<string, unknown>;
  return {
    mockCreate: Anthropic['__mockCreate'] as ReturnType<typeof vi.fn>,
    mockStream: Anthropic['__mockStream'] as ReturnType<typeof vi.fn>,
  };
}

class WeatherAgent extends Agent {
  override model = 'claude-haiku-4-5-20251001';

  @Tool({ description: 'Get weather for a city' })
  async getWeather(_input: Record<string, unknown>): Promise<string> {
    return 'sunny';
  }
}

class SimpleAgent extends Agent {
  override model = 'claude-haiku-4-5-20251001';
}

describe('Agent', () => {
  beforeEach(async () => {
    const { mockCreate, mockStream } = await getAnthropicMocks();
    mockCreate.mockReset();
    mockStream.mockReset();
  });

  describe('chat()', () => {
    it('should return the text response from the model', async () => {
      const { mockCreate } = await getAnthropicMocks();
      mockCreate.mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello, world!' }],
      });

      const agent = new SimpleAgent();
      const result = await agent.chat('Hi');
      expect(result).toBe('Hello, world!');
    });

    it('should add user and assistant messages to memory', async () => {
      const { mockCreate } = await getAnthropicMocks();
      mockCreate.mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Response text' }],
      });

      const agent = new SimpleAgent();
      await agent.chat('User message');
      const history = agent.memory.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.role).toBe('user');
      expect(history[0]?.content).toBe('User message');
      expect(history[1]?.role).toBe('assistant');
      expect(history[1]?.content).toBe('Response text');
    });

    it('should invoke tool and continue when stop_reason is tool_use', async () => {
      const { mockCreate } = await getAnthropicMocks();
      mockCreate
        .mockResolvedValueOnce({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'getWeather',
              input: { city: 'London' },
            },
          ],
        })
        .mockResolvedValueOnce({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'The weather in London is sunny.' }],
        });

      const agent = new WeatherAgent();
      const result = await agent.chat('What is the weather in London?');
      expect(result).toBe('The weather in London is sunny.');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw if tool method not found on agent', async () => {
      const { mockCreate } = await getAnthropicMocks();
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'nonExistentTool',
            input: {},
          },
        ],
      });

      const agent = new SimpleAgent();
      await expect(agent.chat('Use the unknown tool')).rejects.toThrow(
        'Tool method "nonExistentTool" not found',
      );
    });
  });

  describe('stream()', () => {
    it('should yield text chunks from the stream', async () => {
      const { mockStream } = await getAnthropicMocks();
      async function* fakeStream(): AsyncGenerator<unknown> {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ', world' } };
        yield { type: 'message_stop' };
      }
      mockStream.mockReturnValue(fakeStream());

      const agent = new SimpleAgent();
      const chunks: string[] = [];
      for await (const chunk of agent.stream('Hi')) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Hello', ', world']);
    });

    it('should add full response to memory after streaming', async () => {
      const { mockStream } = await getAnthropicMocks();
      async function* fakeStream(): AsyncGenerator<unknown> {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Full ' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'response' } };
      }
      mockStream.mockReturnValue(fakeStream());

      const agent = new SimpleAgent();
      for await (const _ of agent.stream('Hello')) {
        // consume
      }
      const history = agent.memory.getHistory();
      expect(history[1]?.content).toBe('Full response');
    });
  });

  describe('container', () => {
    it('should expose the IoC container', () => {
      new Application();
      const agent = new SimpleAgent();
      expect(agent.container).toBeDefined();
    });
  });
});
