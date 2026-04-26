export interface JobContract {
  handle(...args: unknown[]): Promise<void> | void;
}

export interface QueueContract {
  dispatch(job: JobContract): Promise<void>;
  dispatchChain(jobs: JobContract[]): Promise<void>;
  dispatchWithDelay(job: JobContract, delayMs: number): Promise<void>;
}

export interface QueueConfig {
  readonly connection: {
    readonly host: string;
    readonly port: number;
    readonly password?: string;
  };
  readonly defaultQueue?: string;
}

export interface JobOptions {
  readonly delay?: number;
  readonly attempts?: number;
  readonly backoff?:
    | readonly number[]
    | { readonly type: 'exponential' | 'fixed'; readonly delay: number };
}

export interface FailedJobRecord {
  readonly id: string;
  readonly jobName: string;
  readonly payload: unknown;
  readonly error: string;
  readonly failedAt: Date;
}
