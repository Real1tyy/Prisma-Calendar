import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Docusaurus config for Prisma Calendar docs

const config: Config = {
  title: 'Prisma Calendar',
  tagline: 'A feature-rich, fully configurable calendar for Obsidian.',
  favicon: 'img/PrismaCalendar.png',

  // Set the production url of your site here
  url: 'https://Real1tyy.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/Prisma-Calendar/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Real1tyy', // Usually your GitHub org/user name.
  projectName: 'Prisma-Calendar', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  trailingSlash: false,

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/Real1tyy/Prisma-Calendar/edit/main/docs-site/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        // Your docs are at '/' route
        docsRouteBasePath: '/',
        indexDocs: true,
        indexBlog: false,
        indexPages: true,
        highlightSearchTermsOnTargetPage: true,
        // Optional: Customize search placeholder
        searchBarShortcutHint: false,
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/PrismaCalendar.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Prisma Calendar',
      logo: {
        alt: 'Prisma Calendar Logo',
        src: 'img/PrismaCalendar.png',
        href: '/', // Fix: Make logo/title link to root
      },
      items: [
        {
          to: '/features/overview',
          label: 'Features',
          position: 'left',
        },
        {
          href: 'https://www.youtube.com/watch?v=JjZmNJkQlnc',
          label: 'Demo',
          position: 'right',
        },
        {
          href: 'https://github.com/Real1tyy/Prisma-Calendar',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Prisma Calendar',
              to: '/',
            },
            {
              label: 'Installation',
              to: '/installation',
            },
            {
              label: 'Quick Start',
              to: '/quickstart',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Contributing & Support',
              to: '/contributing',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/Real1tyy/Prisma-Calendar/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Demo Video',
              href: 'https://www.youtube.com/watch?v=JjZmNJkQlnc',
            },
            {
              label: 'Repository',
              href: 'https://github.com/Real1tyy/Prisma-Calendar',
            },
            {
              label: 'Releases',
              href: 'https://github.com/Real1tyy/Prisma-Calendar/releases',
            },
          ],
        },
        {
          title: 'Support',
          items: [
            {
              label: 'Sponsor on GitHub',
              href: 'https://github.com/sponsors/Real1tyy',
            },
            {
              label: 'Buy Me a Coffee',
              href: 'https://www.buymeacoffee.com/real1ty',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Prisma Calendar`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
    metadata: [
      { name: 'algolia-site-verification', content: '6D4AC65541FD3B7E' },
    ],
    // Disable search until properly configured
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_PUBLIC_API_KEY',
    //   indexName: 'prisma_calendar',
    // },
  } satisfies Preset.ThemeConfig,
};

export default config;
