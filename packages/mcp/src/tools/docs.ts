import { searchKnowledge } from '../knowledge.js';

export async function faberDocs(query: string): Promise<string> {
  const results = searchKnowledge(query);

  if (results.length === 0) {
    return `No documentation found for "${query}". Try searching for: routing, controller, model, orm, migration, queue, job, event, listener, auth, validation, config, cli, agent, bootstrap, patterns`;
  }

  return results
    .slice(0, 3)
    .map((s) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');
}

export const docsToolDefinition = {
  name: 'faber_docs',
  description:
    'Search the FaberJS framework documentation. Returns API references, code examples, and usage patterns. Use this whenever you need to know how to use any FaberJS feature — routing, ORM, queues, auth, validation, CLI, AI agents, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'What you want to know about FaberJS. Examples: "how to define routes", "ORM relationships", "dispatch a job", "auth middleware", "validation rules", "migration columns"',
      },
    },
    required: ['query'],
  },
} as const;
