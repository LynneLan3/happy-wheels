import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
const site = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.SITE_URL ?? 'http://localhost:4321');
export default defineConfig({site, devToolbar:{enabled:false}, trailingSlash:'always', integrations:[sitemap({filter:page => !/\/(search|category|404)\/?$/.test(page)})]});
