export const stubs: Record<string, string> = {
  controller: `import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

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

  service: `import { Injectable, Service } from '@faber-js/core';

@Injectable()
export class {{Name}}Service extends Service {
  // Add your business logic here
}
`,

  model: `import { Model } from '@faber-js/orm';

export class {{Name}} extends Model {
  static override table = '{{table}}';
  static override fillable: readonly string[] = [];
}
`,

  migration: `import { Migration, Schema } from '@faber-js/orm';

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

  job: `import { Job } from '@faber-js/queue';

export class {{Name}}Job extends Job {
  override readonly queue = 'default';
  override readonly tries = 3;

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

  middleware: `import type { Middleware, NextFunction } from '@faber-js/http';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';

export class {{Name}}Middleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    return next(request);
  }
}
`,

  command: `import { Command } from '@faber-js/console';

export class {{Name}}Command extends Command {
  readonly signature = '{{name}}';
  readonly description = '{{Name}} command description';

  async handle(): Promise<void> {
    this.info('Running {{name}}...');
  }
}
`,

  provider: `import { ServiceProvider } from '@faber-js/core';

export class {{Name}}ServiceProvider extends ServiceProvider {
  register(): void {
    // Bind your services into the container here
  }

  override boot(): void {
    // Perform post-registration tasks here
  }
}
`,

  agent: `// Run: npm install @faber-js/ai  (or: pnpm add @faber-js/ai)
import { Injectable } from '@faber-js/core';
import { Agent, Tool } from '@faber-js/ai';

@Injectable()
export class {{Name}}Agent extends Agent {
  override model = 'claude-sonnet-4-6';
  override systemPrompt = 'You are a helpful assistant.';

  @Tool({ description: 'Example tool — replace with your own' })
  async exampleTool(_input: Record<string, unknown>): Promise<string> {
    return 'result';
  }
}
`,

  schema: `import { schema, t } from '@faber-js/schema';

export const {{Name}} = schema('{{table}}', {
  id:        t.id(),
  // Add your fields here:
  // name:   t.string().min(2).max(255),
  // email:  t.email().unique(),
  // bio:    t.text().nullable(),
  // role:   t.enum(['admin', 'editor', 'viewer'] as const).default('viewer'),
  createdAt: t.timestamp().auto(),
  updatedAt: t.timestamp().auto(),
});
`,

  view: `/** @jsxImportSource @faber-js/view */

interface Props {
  // TODO: define props
}

export default function {{Name}}(_props: Props) {
  return (
    <div>
      <h1>{{Name}}</h1>
    </div>
  );
}
`,

  channel: `import { Injectable } from '@faber-js/core';
import { Channel, Socket } from '@faber-js/channels';

@Injectable()
export class {{Name}}Channel extends Channel {
  async handle(socket: Socket): Promise<void> {
    socket.on('disconnect', () => {
      // cleanup
    });
  }
}
`,

  mail: `import { Mailable } from '@faber-js/mail';

export class {{Name}}Mail extends Mailable {
  constructor(private readonly to: string) {
    super();
  }

  build(): void {
    this.to(this.to)
      .subject('{{Name}}')
      .html('<p>Hello from FaberJS!</p>');
  }
}
`,
};
