# Installation

FaberJS is scaffolded with a single command. Like Laravel's `laravel new`, `npm create faberjs@latest` gives you a production-ready project structure in seconds.

## Requirements

- Node.js >= 20 LTS
- pnpm (recommended) or npm
- A database — PostgreSQL, MySQL, or SQLite (see options below)

## Creating a new project

```bash
npm create faberjs@latest my-app
cd my-app
```

The scaffolder asks three questions, then writes the project in one shot:

```
  ? Database driver [sqlite/sqlite-wasm/postgres/mysql]:
  ? Include auth scaffolding? (y/n):
  ? Coding agent support [claude/cursor/copilot/windsurf/none]:
```

After answering you'll see each step complete in sequence:

```
  ✔ Scaffolding project structure
  ✔ Creating app skeleton
  ✔ Configuring SQLite database
  ✔ Setting up authentication        ← only when auth = y
  ✔ Wiring agent integrations        ← only when an agent is selected
  ✔ Creating project directories

  ✔ Done in 1.2s
```

### Database driver options

| Driver | Package | Notes |
|---|---|---|
| `sqlite` | `better-sqlite3` | Default. Fast native binary. Recommended for local dev on macOS/Linux/Windows. |
| `sqlite-wasm` | `sql.js` | Pure WebAssembly — no native compilation. Works on **Termux**, ARM, and edge environments. |
| `postgres` | `pg` | Recommended for production. |
| `mysql` | `mysql2` | MySQL / MariaDB. |

## What gets scaffolded

After running the create command you have:

```
my-app/
├── app/
│   ├── controllers/
│   ├── models/
│   ├── services/
│   ├── jobs/
│   ├── events/
│   ├── listeners/
│   ├── policies/
│   ├── providers/
│   └── commands/
├── bootstrap/
│   └── app.ts          ← application boot file
├── config/
│   ├── app.ts
│   └── database.ts
├── database/
│   └── migrations/
├── routes/
│   └── api.ts
├── storage/
├── tests/
├── .env
└── tsconfig.json
```

### Coding agent integrations

Selecting a coding agent adds context files that give the agent a full understanding of FaberJS conventions:

| Agent | Files added |
|---|---|
| `claude` | `CLAUDE.md`, `.mcp.json` (auto-connects `@faber-js/mcp`), `.claude/commands/` slash commands |
| `cursor` | `.cursorrules` |
| `copilot` | `.github/copilot-instructions.md` |
| `windsurf` | `.windsurfrules` |

The Claude integration wires the `@faber-js/mcp` server automatically — Claude Code will have `faber_make`, `faber_docs`, `faber_migrate`, and `faber_route_list` tools available without any manual setup.

## Application key

The scaffolder automatically generates a unique `APP_KEY` in your `.env` file during project creation — you don't need to do anything. If you ever need to rotate the key (e.g. after a credential leak), run:

```bash
npx faber key:generate
```

## First run

Install dependencies, run migrations, and start the dev server:

```bash
pnpm install
npx faber db:migrate
npx faber serve
```

The dev server starts on port `3000` by default with hot reload powered by `tsx --watch`.

```
Server running at http://localhost:3000
```

To use a different port:

```bash
npx faber serve --port 8080
```

## Installing into an existing project

If you want to add FaberJS packages incrementally rather than using the scaffolder:

```bash
pnpm add @faber-js/core @faber-js/config @faber-js/http @faber-js/router @faber-js/orm
```

Then add the packages you need:

```bash
pnpm add @faber-js/queue @faber-js/events @faber-js/auth @faber-js/validation
```

Install the CLI globally to get the `faber` command:

```bash
pnpm add -g @faber-js/console
```

## TypeScript configuration

Your `tsconfig.json` must enable decorators and decorator metadata:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist"
  }
}
```

`experimentalDecorators` and `emitDecoratorMetadata` are required for `@Injectable()` and the IoC container to work. The scaffolder uses `CommonJS` + `ts-node` for full decorator metadata support — `tsx` and `esbuild` do not emit decorator metadata.
