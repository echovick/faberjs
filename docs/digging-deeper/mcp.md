# MCP Server (AI Coding Agents)

`@faber-js/mcp` ships an [Model Context Protocol](https://modelcontextprotocol.io) server that turns your FaberJS project into a first-class environment for Claude Code, Cursor, and Claude Desktop. Once connected, the agent can scaffold files, run migrations, list routes, and search the framework docs — directly through tool calls, without you copying commands into the terminal.

If you scaffolded with `npm create faberjs@latest` and selected the Claude integration, the server is already wired up — `.mcp.json` lives at your project root and Claude Code picks it up automatically.

---

## What you get

The MCP server exposes nine tools to the connected agent:

| Tool               | What it does                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faber_make`       | Generate a controller, model, service, job, event, listener, middleware, migration, provider, command, agent, schema, view, channel, mail, or policy |
| `faber_migrate`    | Run all pending database migrations (`db:migrate`)                                                                                                   |
| `faber_rollback`   | Roll back the last migration batch (`db:rollback`)                                                                                                   |
| `faber_db_status`  | Show migration status — what has run, what is pending                                                                                                |
| `faber_db_seed`    | Run all database seeders                                                                                                                             |
| `faber_db_fresh`   | Drop every table and re-run all migrations from scratch — destructive                                                                                |
| `faber_db_refresh` | Roll back every migration, then re-run them — preserves the database, resets data                                                                    |
| `faber_route_list` | List every registered route — method, path, controller, middleware                                                                                   |
| `faber_docs`       | Search the bundled framework knowledge base for API references and patterns                                                                          |

Every tool is a thin wrapper over the equivalent `npx faber` command, run in your project's working directory. No hidden behaviour — what you'd type in the terminal is what the agent runs.

---

## Auto-setup (via the scaffolder)

When you run the project scaffolder and pick the **Claude** integration:

```bash
npm create faberjs@latest my-app
# → Coding agent support: claude
```

Three files get written for you:

- **`.mcp.json`** — auto-connects the MCP server when Claude Code opens the project
- **`CLAUDE.md`** — project-level conventions and patterns the agent reads on every turn
- **`.claude/commands/`** — slash commands for common tasks (`/make`, `/migrate`, `/route-list`, `/docs`)

Open the project in Claude Code and the agent will already have all nine tools available. No additional setup.

---

## Manual setup

If you didn't scaffold with the Claude option, or you want to add the server to an existing project, drop a `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "faberjs": {
      "command": "npx",
      "args": ["-y", "@faber-js/mcp"]
    }
  }
}
```

That's the entire setup — the package is fetched on demand via `npx -y`. Restart your editor's MCP integration (or reload the MCP servers from Claude Code's settings) and the tools will appear.

### Claude Desktop

Edit your Claude Desktop MCP config (location depends on your OS — **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`; **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "faberjs": {
      "command": "npx",
      "args": ["-y", "@faber-js/mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

Claude Desktop doesn't auto-discover `.mcp.json` from project roots, so you must give it an absolute `cwd`. Restart the app to apply.

### Cursor

Cursor reads MCP config from its global settings or from a project `.mcp.json`. The same one-line config above works — point Cursor at your project and the tools become available in the Composer.

---

## Tool reference

### `faber_make`

Generates a single file using the `faber` CLI.

| Parameter       | Type               | Description                                                                                                                                                                    |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`          | string (enum)      | One of: `controller`, `model`, `service`, `job`, `event`, `listener`, `middleware`, `migration`, `provider`, `command`, `agent`, `schema`, `view`, `channel`, `mail`, `policy` |
| `name`          | string             | PascalCase for class generators, snake_case for migrations. Examples: `"PostController"`, `"create_posts_table"`                                                               |
| `withMigration` | boolean (optional) | Only valid for `type: "model"` — passes the `-m` flag so a migration is generated alongside the model                                                                          |

Example invocation the agent might make:

```json
{
  "type": "model",
  "name": "Post",
  "withMigration": true
}
```

Equivalent to running:

```bash
npx faber make:model Post -m
```

### `faber_migrate` / `faber_rollback` / `faber_db_status` / `faber_db_seed`

No parameters. Each runs the corresponding `npx faber db:*` command and returns the CLI output as a string.

### `faber_db_fresh`

::: warning Destructive
Drops every table in the database before re-running migrations. **All data is lost.** The agent will only call this when you explicitly ask it to "wipe and rebuild" or similar.
:::

### `faber_db_refresh`

Rolls back every migration in reverse order, then re-runs them. The database itself is preserved, but all data inserted by migrations is reset. Less destructive than `faber_db_fresh` (no `DROP TABLE`).

### `faber_route_list`

No parameters. Returns the same table you'd see from `npx faber route:list` — method, path, controller, middleware. Useful when the agent needs to understand what's already wired before adding new routes.

### `faber_docs`

| Parameter | Type   | Description                                                                                                                                                                |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`   | string | What you want to know about FaberJS — a topic, an API name, a pattern. Examples: `"how to define routes"`, `"ORM relationships"`, `"dispatch a job"`, `"validation rules"` |

Returns up to three matching sections from the bundled knowledge base. The knowledge base is shipped inside the MCP package — no network call, no API key. The agent uses this to ground its answers in actual FaberJS conventions instead of guessing at general Node.js patterns.

---

## A real conversation

A typical exchange when building a new feature:

> **You:** Add a CRUD for Comments. They belong to Posts and Users.

The agent will:

1. Call `faber_docs` with `"hasMany belongsTo relationships"` to confirm the ORM API.
2. Call `faber_make` with `{ type: "model", name: "Comment", withMigration: true }`.
3. Call `faber_make` with `{ type: "controller", name: "CommentController" }`.
4. Edit the generated migration to add `post_id` and `user_id` columns.
5. Edit the model to declare the `post()` and `user()` `belongsTo` relations.
6. Edit `routes/api.ts` to register the resource routes.
7. Call `faber_migrate` to apply the migration.
8. Call `faber_route_list` to confirm everything wired correctly.

Each step is a real tool call — auditable, revertable, and using your project's actual code.

---

## Troubleshooting

### Tools don't appear in Claude Code

- Make sure `.mcp.json` lives at the project root (alongside `package.json`), not inside `.claude/`.
- Open the MCP panel in Claude Code (`/mcp`) and confirm `faberjs` shows as connected. If it shows an error, expand it for the stderr output.
- Run `npx -y @faber-js/mcp` directly in a terminal — it should hang on stdin (that's correct; the server speaks JSON-RPC over stdio). If it errors instead, the package didn't install cleanly.

### `faber_make` fails with "command not found"

The MCP server runs `npx faber` in your project's working directory. If `npx faber` doesn't work in your terminal either, you're missing `@faber-js/console`:

```bash
pnpm add @faber-js/console
```

### Stale tools

The MCP server is invoked via `npx -y @faber-js/mcp`, which fetches the latest published version on first run. If a new tool was added in a release and you don't see it, clear the npx cache or pin a specific version in `.mcp.json`:

```json
{
  "mcpServers": {
    "faberjs": {
      "command": "npx",
      "args": ["-y", "@faber-js/mcp@latest"]
    }
  }
}
```
