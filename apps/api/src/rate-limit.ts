type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}
