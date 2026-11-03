/**
 * CORS allowlist.
 *
 * CORS_ALLOWED_ORIGINS: comma-separated list of exact origins (scheme + host + port),
 * e.g. "https://premalkaizen.com,https://admin.premalkaizen.com". Falls back to the
 * local storefront (3000) and admin (3001) dev servers when unset, so local
 * development keeps working unchanged.
 *
 * A request with no Origin header at all (server-to-server calls - the Razorpay
 * webhook, curl, a mobile app, Postman) is not a browser CORS request and is always
 * allowed through; CORS only ever restricts browser-to-API calls with an Origin.
 */
export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.CORS_ALLOWED_ORIGINS;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  return ['http://localhost:3000', 'http://localhost:3001'];
}

export function createCorsOriginValidator(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin "${origin}" is not allowed by CORS policy`), false);
  };
}
