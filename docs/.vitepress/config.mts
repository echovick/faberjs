import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'FaberJS',
  description: 'A Laravel-inspired backend framework for Node.js and TypeScript.',
  lang: 'en-US',
  cleanUrls: true,
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'FaberJS',

    nav: [
      { text: 'Guide', link: '/getting-started/installation' },
      { text: 'CLI', link: '/cli/commands' },
      { text: 'GitHub', link: 'https://github.com/faberjs/faberjs' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/getting-started/installation' },
          { text: 'Directory Structure', link: '/getting-started/directory-structure' },
          { text: 'Configuration', link: '/getting-started/configuration' },
        ],
      },
      {
        text: 'The Basics',
        items: [
          { text: 'Routing', link: '/basics/routing' },
          { text: 'Controllers', link: '/basics/controllers' },
          { text: 'Requests', link: '/basics/requests' },
          { text: 'Responses', link: '/basics/responses' },
          { text: 'Middleware', link: '/basics/middleware' },
        ],
      },
      {
        text: 'ORM',
        items: [
          { text: 'Models', link: '/orm/models' },
          { text: 'Queries', link: '/orm/queries' },
          { text: 'Migrations', link: '/orm/migrations' },
          { text: 'Relationships', link: '/orm/relationships' },
        ],
      },
      {
        text: 'Digging Deeper',
        items: [
          { text: 'Services', link: '/digging-deeper/services' },
          { text: 'Jobs & Queues', link: '/digging-deeper/jobs-queues' },
          { text: 'Events & Listeners', link: '/digging-deeper/events-listeners' },
          { text: 'Validation', link: '/digging-deeper/validation' },
          { text: 'Authentication', link: '/digging-deeper/auth' },
          { text: 'AI Agents', link: '/digging-deeper/ai-agents' },
        ],
      },
      {
        text: 'CLI Reference',
        items: [{ text: 'Commands', link: '/cli/commands' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/faberjs/faberjs' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 FaberJS Contributors',
    },

    search: {
      provider: 'local',
    },
  },
});
