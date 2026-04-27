import 'reflect-metadata';
import Anthropic from '@anthropic-ai/sdk';
import { Application, Injectable } from '@faberjs/core';
import type { ApplicationContract } from '@faberjs/core';
import { getToolMeta } from './tool';
import { InMemoryConversationMemory } from './memory';
import type { ConversationMemory, MemoryMessage } from './types';

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicToolParam = Anthropic.Tool;
type AnthropicContentBlock = Anthropic.ContentBlock;

function getApiKey(): string {
  return process.env['ANTHROPIC_API_KEY'] ?? '';
}

@Injectable()
export abstract class Agent {
  model = 'claude-sonnet-4-6';
  systemPrompt = '';
  maxTokens = 4096;
  memory: ConversationMemory = new InMemoryConversationMemory();

  get container(): ApplicationContract {
    return Application.getInstance();
  }

  #createClient(): Anthropic {
    return new Anthropic({ apiKey: getApiKey() });
  }

  #buildAnthropicTools(): AnthropicToolParam[] {
    return getToolMeta(this).map((meta) => ({
      name: meta.name,
      description: meta.description,
      input_schema: meta.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }

  #buildHistory(extra?: MemoryMessage): AnthropicMessage[] {
    const messages: AnthropicMessage[] = this.memory
      .getHistory()
      .map((m) => ({ role: m.role, content: m.content }));
    if (extra) messages.push({ role: extra.role, content: extra.content });
    return messages;
  }

  async #invokeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const self = this as Record<string, unknown>;
    const method = self[name];
    if (typeof method !== 'function') {
      throw new Error(`Tool method "${name}" not found on agent ${this.constructor.name}.`);
    }
    return (method as (input: Record<string, unknown>) => Promise<unknown>).call(this, input);
  }

  async chat(message: string): Promise<string> {
    const client = this.#createClient();
    const tools = this.#buildAnthropicTools();

    this.memory.add({ role: 'user', content: message });

    const history: AnthropicMessage[] = this.#buildHistory();

    const createParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: history,
      ...(this.systemPrompt ? { system: this.systemPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    };

    let response = await client.messages.create(createParams);

    while (response.stop_reason === 'tool_use') {
      const assistantContent: AnthropicContentBlock[] = response.content;
      history.push({ role: 'assistant', content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          const result = await this.#invokeTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: String(result),
          });
        }
      }

      history.push({ role: 'user', content: toolResults });

      response = await client.messages.create({ ...createParams, messages: history });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    this.memory.add({ role: 'assistant', content: text });
    return text;
  }

  async *stream(message: string): AsyncGenerator<string> {
    const client = this.#createClient();

    this.memory.add({ role: 'user', content: message });

    const messageStream = client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: this.#buildHistory(),
      ...(this.systemPrompt ? { system: this.systemPrompt } : {}),
    });

    let fullText = '';
    for await (const chunk of messageStream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullText += text;
        yield text;
      }
    }

    this.memory.add({ role: 'assistant', content: fullText });
  }
}
