import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({ site: "https://happy-wheels.vercel.app/", integrations: [sitemap()] });
