/**
 * Cloudflare Pages Function for /s/<token>, the link a points share posts to
 * X. It returns a page that only carries the wallet's card as its link
 * preview, then sends visitors on to /points. It's the only function in the
 * project, so every other page (/points included) stays static.
 *
 * The token comes from the gateway (POST /v2/points/share); the gateway also
 * draws the card at /v2/points/share/<token>.png. Staging pages use the
 * staging gateway.
 */

// base64url of the sealed card (nonce + wallet + tag): 84 characters today.
const TOKEN = /^[A-Za-z0-9_-]{40,200}$/;

const gateway = host =>
  host === 'staging.fermi.trade' ? 'https://v1.fermi.trade/staging' : 'https://v1.fermi.trade';

export function onRequestGet({ params, request }) {
  const url = new URL(request.url);
  const token = String(params.token ?? '');
  if (!TOKEN.test(token)) return Response.redirect(`${url.origin}/points`, 302);

  const image = `${gateway(url.hostname)}/v2/points/share/${token}.png`;
  const page = `${url.origin}/s/${token}`;
  const title = 'ALIEN Points on Fermi Trade';
  const description = 'How many points has your wallet earned? Check yours.';

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
    <meta property="og:image:height" content="675" />
    <meta property="og:image:alt" content="A wallet's ALIEN points card" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@FermiLabs" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta http-equiv="refresh" content="0; url=/points" />
  </head>
  <body>
    <script>location.replace('/points');</script>
    <a href="/points">Check your ALIEN points</a>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
