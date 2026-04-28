import 'reflect-metadata';
import Anthropic from '@anthropic-ai/sdk';
import { Application, Injectable } from '@faber-js/core';
import type { ApplicationContract } from '@faber-js/core';
import { getCurrentRequest, ForbiddenException } from '@faber-js/http';
import type { AuthUser } from '@faber-js/http';
import { getToolMeta } from './tool';
import { InMemoryConversationMemory } from './memory';
import type { ConversationMemory, MemoryMessage } from './types';
import type { SchemaShape } from '@faber-js/schema';
import { schemaShapeToJsonSchema } from './structured-output';

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicToolParam = Anthropic.Tool;
type AnthropicContentBlock = Anthropic.ContentBlock;

interface GateResolvable {
  allows(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean>;
}

function getApiKey(): string {
  return process.env['ANTHROPIC_API_KEY'] ?? '';
}

const STRUCTURED_OUTPUT_TOOL = '__structured_output__';

@Injectable()
export abstract class Agent {
  model = 'claude-sonnet-4-6';
  systemPrompt = '';
  maxTokens = 4096;
  output?: SchemaShape;
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

  async #buildHistory(extra?: MemoryMessage, sessionId?: string): Promise<AnthropicMessage[]> {
    const messages: AnthropicMessage[] = (await this.memory.getHistory(sessionId)).map((m) => ({
      role: m.role,
      content: m.content,
    }));
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

  protected async authorize(ability: string, resource?: unknown): Promise<void> {
    const request = getCurrentRequest();
    const user = request?.user ?? null;

    const app = Application.getInstance();
    if (app.bound('gate')) {
      const gate = app.make<GateResolvable>('gate');
      const allowed = await gate.allows(ability, user, resource);
      if (!allowed) throw new ForbiddenException('Not authorized to perform this action');
    }
  }

  async chat(message: string, sessionId?: string): Promise<string> {
    const client = this.#createClient();

    this.memory.add({ role: 'user', content: message }, sessionId);

    const history = await this.#buildHistory(undefined, sessionId);

    if (this.output) {
      return this.#chatWithStructuredOutput(client, history, sessionId);
    }

    const tools = this.#buildAnthropicTools();

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

    this.memory.add({ role: 'assistant', content: text }, sessionId);
    return text;
  }

  async #chatWithStructuredOutput(
    client: Anthropic,
    history: AnthropicMessage[],
    sessionId?: string,
  ): Promise<string> {
    if (!this.output) return '{}';
    const outputSchema = this.output;
    const jsonSchema = schemaShapeToJsonSchema(outputSchema);

    const structuredTool: AnthropicToolParam = {
      name: STRUCTURED_OUTPUT_TOOL,
      description: 'Return the structured output in the required format',
      input_schema: jsonSchema as Anthropic.Tool['input_schema'],
    };

    const response = await client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: history,
      ...(this.systemPrompt ? { system: this.systemPrompt } : {}),
      tools: [structuredTool],
      tool_choice: { type: 'tool', name: STRUCTURED_OUTPUT_TOOL },
    });

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === STRUCTURED_OUTPUT_TOOL) {
        const result = JSON.stringify(block.input);
        this.memory.add({ role: 'assistant', content: result }, sessionId);
        return result;
      }
    }

    const fallback = '';
    this.memory.add({ role: 'assistant', content: fallback }, sessionId);
    return fallback;
  }

  async *stream(message: string, sessionId?: string): AsyncGenerator<string> {
    const client = this.#createClient();

    this.memory.add({ role: 'user', content: message }, sessionId);

    const history = await this.#buildHistory(undefined, sessionId);

    const messageStream = client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: history,
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

    this.memory.add({ role: 'assistant', content: fullText }, sessionId);
  }
}
