// Type declarations for Cloudflare Workers runtime bindings.
// Generated manually — run `wrangler types` to regenerate if bindings change.
declare module 'cloudflare:workers' {
  const env: {
    PUBLIC_POSTHOG_KEY?: string;
    PUBLIC_ZOHO_BOOKING_WORKSPACE?: string;
    PUBLIC_ZOHO_BOOKING_SERVICE?: string;
    ZOHO_CLIENT_ID?: string;
    ZOHO_CLIENT_SECRET?: string;
    ZOHO_REFRESH_TOKEN?: string;
    OG_WORKER_URL?: string;
    PODCAST_RSS_URL?: string;
    ANTHROPIC_API_KEY?: string;
  };
  export { env };
}
