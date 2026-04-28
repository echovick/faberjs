import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { faberMake, makeToolDefinition } from './tools/make.js';
import {
  faberMigrate,
  faberRollback,
  faberDbStatus,
  faberDbSeed,
  faberDbFresh,
  faberDbRefresh,
  migrateToolDefinition,
  rollbackToolDefinition,
  dbStatusToolDefinition,
  dbSeedToolDefinition,
  dbFreshToolDefinition,
  dbRefreshToolDefinition,
} from './tools/migrate.js';
import { faberRouteList, routeListToolDefinition } from './tools/routes.js';
import { faberDocs, docsToolDefinition } from './tools/docs.js';

const TOOLS = [
  makeToolDefinition,
  migrateToolDefinition,
  rollbackToolDefinition,
  dbStatusToolDefinition,
  dbSeedToolDefinition,
  dbFreshToolDefinition,
  dbRefreshToolDefinition,
  routeListToolDefinition,
  docsToolDefinition,
];

export async function startServer(): Promise<void> {
  const server = new Server({ name: 'faberjs', version: '1.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'faber_make': {
          const flags = (args as { withMigration?: boolean }).withMigration ? ['-m'] : [];
          result = await faberMake(
            (args as { type: string }).type,
            (args as { name: string }).name,
            flags,
          );
          break;
        }

        case 'faber_migrate':
          result = await faberMigrate();
          break;

        case 'faber_rollback':
          result = await faberRollback();
          break;

        case 'faber_db_status':
          result = await faberDbStatus();
          break;

        case 'faber_db_seed':
          result = await faberDbSeed();
          break;

        case 'faber_db_fresh':
          result = await faberDbFresh();
          break;

        case 'faber_db_refresh':
          result = await faberDbRefresh();
          break;

        case 'faber_route_list':
          result = await faberRouteList();
          break;

        case 'faber_docs':
          result = await faberDocs((args as { query: string }).query);
          break;

        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
