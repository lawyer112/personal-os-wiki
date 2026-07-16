type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  scope?: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_WRITE_LIMIT = 300;
const DEFAULT_WINDOW_MS = 60_000;
const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(request: Request, options: RateLimitOptions = {}) {
  const limit = options.limit ?? configuredPositiveInt("PERSONAL_OS_WRITE_RATE_LIMIT", DEFAULT_WRITE_LIMIT);
  if (limit <= 0) {
    return { allowed: true };
  }

  const windowMs = options.windowMs ?? configuredPositiveInt(
    "PERSONAL_OS_WRITE_RATE_WINDOW_MS",
    DEFAULT_WINDOW_MS,
  );
  const now = Date.now();
  const key = `${options.scope ?? "write"}:${clientAddress(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    pruneExpiredBuckets(now);
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimitForTests() {
  buckets.clear();
}

function configuredPositiveInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clientAddress(request: Request) {
  if (process.env.PERSONAL_OS_TRUST_PROXY_HEADERS?.trim().toLowerCase() !== "true") {
    return "shared";
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 10_000) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
