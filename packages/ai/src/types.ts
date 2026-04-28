import type { SchemaShape } from '@faber-js/schema';

export type MessageRole = 'user' | 'assistant';

export interface MemoryMessage {
  readonly role: MessageRole;
  readonly content: string;
}

export interface ConversationMemory {
  add(message: MemoryMessage, sessionId?: string): void;
  getHistory(sessionId?: string): Promise<readonly MemoryMessage[]>;
  clear(sessionId?: string): Promise<void>;
}

export interface ToolInputProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly format?: string;
  readonly nullable?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties: Record<string, ToolInputProperty>;
  readonly required?: readonly string[];
}

export interface ToolOptions {
  readonly description: string;
  readonly input?: SchemaShape;
  readonly inputSchema?: ToolInputSchema;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: ToolInputSchema;
}

export interface AgentConfig {
  readonly model?: string;
  readonly systemPrompt?: string;
  readonly maxTokens?: number;
}

export interface TokenBudgetConfig {
  readonly maxTokens: number;
}

export interface StoredToolMeta {
  readonly methodName: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
}

export interface AiValidationConfig {
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly failOpen?: boolean;
}
