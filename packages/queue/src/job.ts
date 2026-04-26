import type { JobContract } from './types';

export abstract class Job implements JobContract {
  readonly queue: string = 'default';
  readonly tries: number = 3;
  readonly backoff: readonly number[] = [60, 300, 600]; // seconds between retries

  abstract handle(): Promise<void>;

  async failed(_error: Error): Promise<void> {
    // Override in subclasses to handle failure
  }

  toJSON(): Record<string, unknown> {
    return {
      __jobClass: this.constructor.name,
      ...this.#serializePayload(),
    };
  }

  #serializePayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this)) {
      if (key !== 'queue' && key !== 'tries' && key !== 'backoff') {
        payload[key] = value;
      }
    }
    return payload;
  }
}
