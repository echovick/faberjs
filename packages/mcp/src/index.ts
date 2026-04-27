import { startServer } from './server.js';

startServer().catch((err: unknown) => {
  process.stderr.write(`FaberJS MCP server error: ${String(err)}\n`);
  process.exit(1);
});
