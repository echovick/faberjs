export const stubs: Record<string, string> = {
  controller: `import { Injectable } from '@faberjs/core';
import { Controller } from '@faberjs/router';
import type { Request } from '@faberjs/http';
import { Response } from '@faberjs/http';

@Injectable()
export class {{Name}}Controller extends Controller {
  async index(_req: Request): Promise<Response> {
    return this.json({ data: [] });
  }

  async show(req: Request): Promise<Response> {
    const id = req.route('id');
    return this.json({ data: { id } });
  }

  async store(_req: Request): Promise<Response> {
    return this.json({ data: {} }, 201);
  }

  async update(_req: Request): Promise<Response> {
    return this.json({ data: {} });
  }

  async destroy(_req: Request): Promise<Response> {
    return this.noContent();
  }
}
`,

  service: `import { Injectable, Service } from '@faberjs/core';

@Injectable()
export class {{Name}}Service extends Service {
  // Add your business logic here
}
`,

  model: `import { Model } from '@faberjs/orm';

export class {{Name}} extends Model {
  static override table = '{{table}}';
  static override fillable: readonly string[] = [];
}
`,

  migration: `import { Migration, Schema } from '@faberjs/orm';

export default class {{ClassName}} extends Migration {
  async up(): Promise<void> {
    await Schema.create('{{migrationTable}}', (table) => {
      table.id();
      table.timestamps();
    });
  }

  async down(): Promise<void> {
    await Schema.dropIfExists('{{migrationTable}}');
  }
}
`,

  job: `export class {{Name}}Job {
  readonly queue = 'default';
  readonly tries = 3;

  async handle(): Promise<void> {
    // Add your job logic here
  }
}
`,

  event: `export interface {{Name}}Event {
  readonly type: '{{Name}}';
  // Add event payload fields here
}
`,

  listener: `export class {{Name}}Listener {
  async handle(event: Record<string, unknown>): Promise<void> {
    // Handle the event here
    void event;
  }
}
`,

  middleware: `import type { Middleware, NextFunction } from '@faberjs/http';
import type { Request } from '@faberjs/http';
import { Response } from '@faberjs/http';

export class {{Name}}Middleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    return next(request);
  }
}
`,

  command: `import { Command } from '@faberjs/console';

export class {{Name}}Command extends Command {
  readonly signature = '{{name}}';
  readonly description = '{{Name}} command description';

  async handle(): Promise<void> {
    this.info('Running {{name}}...');
  }
}
`,

  provider: `import { ServiceProvider } from '@faberjs/core';

export class {{Name}}ServiceProvider extends ServiceProvider {
  register(): void {
    // Bind your services into the container here
  }

  override boot(): void {
    // Perform post-registration tasks here
  }
}
`,
};
