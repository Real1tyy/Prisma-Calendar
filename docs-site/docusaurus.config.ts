import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// Docusaurus config for Prisma Calendar docs

const config: Config = {
  title: 'Prisma Calendar',
  tagline: 'A feature-rich, fully configurable calendar for Obsidian.',
  favicon: 'img/favicon.ico',

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

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Prisma Calendar',
      logo: {
        alt: 'Prisma Calendar Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/features/overview',
          label: 'Features',
          position: 'left',
        },
        {
          href: 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID',
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
              label: 'Introduction',
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
              label: 'Obsidian Forum Thread',
              href: 'https://forum.obsidian.md/',
            },
            {
              label: 'Issues',
              href: 'https://github.com/Real1tyy/Prisma-Calendar/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Demo Video',
              href: 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID',
            },
            {
              label: 'Donate',
              href: 'https://buymeacoffee.com/<your-handle>',
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
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_PUBLIC_API_KEY',
      indexName: 'prisma_calendar',
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
