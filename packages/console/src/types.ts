export interface CommandMeta {
  readonly signature: string;
  readonly description: string;
}

export interface GeneratorOptions {
  readonly name: string;
  readonly outputDir: string;
  readonly migration?: boolean;
}

export interface RouteEntry {
  readonly method: string;
  readonly path: string;
  readonly name?: string;
  readonly handler: string;
}

export interface MigrationStatus {
  readonly name: string;
  readonly batch: number | null;
  readonly ran: boolean;
}
