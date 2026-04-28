import 'reflect-metadata';
import type { StoredToolMeta, ToolInputSchema, ToolOptions } from './types';
import { schemaShapeToJsonSchema } from './structured-output';

const TOOLS_KEY = Symbol('faberjs:ai:tools');

const DEFAULT_SCHEMA: ToolInputSchema = { type: 'object', properties: {} };

export function Tool(options: ToolOptions): MethodDecorator {
  return (target, propertyKey): void => {
    const existing = (Reflect.getMetadata(TOOLS_KEY, target) as StoredToolMeta[] | undefined) ?? [];
    const inputSchema = options.input
      ? schemaShapeToJsonSchema(options.input)
      : (options.inputSchema ?? DEFAULT_SCHEMA);
    existing.push({
      methodName: String(propertyKey),
      name: String(propertyKey),
      description: options.description,
      inputSchema,
    });
    Reflect.defineMetadata(TOOLS_KEY, existing, target);
  };
}

export function getToolMeta(instance: object): StoredToolMeta[] {
  return (
    (Reflect.getMetadata(TOOLS_KEY, Object.getPrototypeOf(instance)) as
      | StoredToolMeta[]
      | undefined) ?? []
  );
}
