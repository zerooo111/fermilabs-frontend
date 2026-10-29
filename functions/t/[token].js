/**
 * Cloudflare Pages Function for /t/<token>, the link a PnL share posts to X.
 * Like /s/<token> for points, it returns a page that only carries the card
 * as its link preview, then sends visitors on to the app.
 *
 * The token comes from the gateway (POST /v2/pnl/share), which seals the
 * position into it; the gateway also draws the card at
 * /v2/pnl/share/<token>.png. Staging pages use the staging gateway.
 */

// base64url of the sealed position (nonce + wallet + prices + name + tag): ~165 characters.
const TOKEN = /^[A-Za-z0-9_-]{40,260}$/;

const gateway = host =>
  host === 'staging.fermi.trade' ? 'https://v1.fermi.trade/staging' : 'https://v1.fermi.trade';

// fermi.trade only serves the landing pages; trading lives on the app host.
const app = url =>
  url.hostname === 'fermi.trade' || url.hostname === 'www.fermi.trade'
    ? 'https://app.fermi.trade/perps'
    : `${url.origin}/perps`;

export function onRequestGet({ params, request }) {
  const url = new URL(request.url);
  const token = String(params.token ?? '');
  const target = app(url);
  if (!TOKEN.test(token)) return Response.redirect(target, 302);

  const image = `${gateway(url.hostname)}/v2/pnl/share/${token}.png`;
  const page = `${url.origin}/t/${token}`;
  const title = 'A trade on Fermi Trade';
  const description =
    'Perpetuals on Solana with instant finality. A fair FIFO orderbook: no mempool, no MEV, no front-running.';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Fermi Trade" />
    <meta property="og:url" content="${page}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="A position's PnL card" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@FermiLabs" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta http-equiv="refresh" content="0; url=${target}" />
  </head>
  <body>
    <script>location.replace(${JSON.stringify(target)});</script>
    <a href="${target}">Trade on Fermi Trade</a>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
