type PipelineStage<T> = (passable: T, next: (input: T) => T | Promise<T>) => T | Promise<T>;

export class Pipeline<T> {
  private passable!: T;
  private stages: Array<PipelineStage<T>> = [];

  static make<T>(): Pipeline<T> {
    return new Pipeline<T>();
  }

  send(passable: T): this {
    this.passable = passable;
    return this;
  }

  through(...stages: Array<PipelineStage<T>>): this {
    this.stages = [...this.stages, ...stages];
    return this;
  }

  pipe(...stages: Array<PipelineStage<T>>): this {
    return this.through(...stages);
  }

  then(destination: (passable: T) => T | Promise<T>): Promise<T> {
    const pipeline = this.stages.reduceRight(
      (next: (input: T) => T | Promise<T>, stage) => (passable: T) => stage(passable, next),
      destination,
    );
    return Promise.resolve(pipeline(this.passable));
  }

  thenReturn(): Promise<T> {
    return this.then((x) => x);
  }
}
