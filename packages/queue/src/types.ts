export interface JobContract {
  handle(...args: unknown[]): Promise<void> | void;
}

export interface QueueContract {
  dispatch(job: JobContract): Promise<void>;
}
