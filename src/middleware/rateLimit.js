/**
 * GitHub-style rate limiting middleware.
 *
 * Simulates the X-RateLimit-* headers that GitHub returns on every response:
 *   X-RateLimit-Limit:     5000  (requests per hour for authenticated)
 *   X-RateLimit-Remaining: N
 *   X-RateLimit-Reset:     Unix timestamp when the window resets
 *   X-RateLimit-Used:      requests used so far
 *   X-RateLimit-Resource:  "core"
 */

const LIMIT = 5000;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Per-token counters
const counters = new Map();

function getCounter(token) {
  const key = token || '__anonymous__';
  if (!counters.has(key)) {
    counters.set(key, {
      used: 0,
      resetAt: Date.now() + WINDOW_MS,
    });
  }
  const counter = counters.get(key);

  // Reset if window expired
  if (Date.now() >= counter.resetAt) {
    counter.used = 0;
    counter.resetAt = Date.now() + WINDOW_MS;
  }

  return counter;
}

export function rateLimitMiddleware(req, res, next) {
  const token = req.headers.authorization || '__anonymous__';
  const counter = getCounter(token);

  counter.used++;
  const remaining = Math.max(0, LIMIT - counter.used);
  const resetEpoch = Math.floor(counter.resetAt / 1000);

  // Set GitHub-style rate limit headers
  res.set('X-RateLimit-Limit', String(LIMIT));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(resetEpoch));
  res.set('X-RateLimit-Used', String(counter.used));
  res.set('X-RateLimit-Resource', 'core');

  if (remaining <= 0) {
    return res.status(403).json({
      message: 'API rate limit exceeded for this token.',
      documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
    });
  }

  next();
}

/**
 * Reset all rate limit counters (used by CLI reset command).
 */
export function resetRateLimits() {
  counters.clear();
}
