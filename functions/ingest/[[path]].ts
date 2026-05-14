const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';

async function retrieveAsset(request: Request, pathWithSearch: string, ctx: ExecutionContext): Promise<Response> {
  const cacheKey = new Request(`https://${ASSET_HOST}${pathWithSearch}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://${ASSET_HOST}${pathWithSearch}`);
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
}

async function forwardRequest(request: Request, pathWithSearch: string): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.set('host', API_HOST);

  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);

  const body = request.method !== 'GET' && request.method !== 'HEAD'
    ? await request.arrayBuffer()
    : null;

  return fetch(`https://${API_HOST}${pathWithSearch}`, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
  });
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/^\/ingest/, '') || '/';
  const pathWithSearch = path + url.search;

  return path.startsWith('/static/') || path.startsWith('/array/')
    ? retrieveAsset(context.request, pathWithSearch, context)
    : forwardRequest(context.request, pathWithSearch);
};
