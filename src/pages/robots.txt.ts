const preview = process.env.VERCEL_ENV === 'preview';
const body = preview
  ? 'User-agent: *\nDisallow: /\n'
  : 'User-agent: *\nAllow: /\nSitemap: https://happy-wheels-game.vercel.app/sitemap-index.xml\n';
export const GET = () => new Response(body, {headers:{'Content-Type':'text/plain'}});
