// redisClient.js - optional Redis for multi-instance production
// If REDIS_URL is set, connect (lazy). Otherwise null => single-instance
// file-backed fallback (durable.js) with a startup warning.
// Requires `redis` package (pure JS, no native build).
let client = null;
let warned = false;

export async function getRedis() {
  const url = process.env.REDIS_URL || '';
  if (!url) {
    if (!warned) {
      console.warn('[REDIS] REDIS_URL not set — using single-instance fallback (durable.js). Set REDIS_URL for multi-instance rate-limit/quota/brute sync.');
      warned = true;
    }
    return null;
  }
  if (client) return client;
  try {
    const { createClient } = await import('redis');
    client = createClient({ url });
    client.on('error', (e) => console.error('[REDIS] error', e.message));
    await client.connect();
    console.log('[REDIS] connected');
    return client;
  } catch (e) {
    console.error('[REDIS] connect failed, fallback to durable:', e.message);
    return null;
  }
}
