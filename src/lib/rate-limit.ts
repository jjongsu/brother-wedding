import 'server-only';

type RateLimitOptions = {
    keyPrefix: string;
    limit: number;
    windowMs: number;
};

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 1000;

const getClientIp = (request: Request) => {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip')?.trim();

    return forwardedFor || realIp || 'unknown';
};

const pruneBuckets = (now: number) => {
    if (buckets.size < MAX_BUCKETS) return;

    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
};

export const checkRateLimit = (request: Request, options: RateLimitOptions) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${getClientIp(request)}`;
    const bucket = buckets.get(key);

    pruneBuckets(now);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, {
            count: 1,
            resetAt: now + options.windowMs,
        });

        return {
            limited: false,
            retryAfterSeconds: 0,
        };
    }

    if (bucket.count >= options.limit) {
        return {
            limited: true,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
    }

    bucket.count += 1;

    return {
        limited: false,
        retryAfterSeconds: 0,
    };
};
