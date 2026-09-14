import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
const site = process.env.SITE_URL ?? 'https://happy-wheels-game.vercel.app';
export default defineConfig({site, devToolbar:{enabled:false}, trailingSlash:'always', integrations:[sitemap({filter:page => !/\/(search|category|404)\/?$/.test(page)})]});
