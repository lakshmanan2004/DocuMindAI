/**
 * Rate Limiting Middleware
 * In-memory sliding window rate limiter for authentication routes
 */

const rateLimits = new Map();

const rateLimit = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const max = options.max || 15; // Max 15 attempts default
  const message = options.message || 'Too many login attempts, please try again later';

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}_${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    rateLimits.set(key, record);

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ message });
    }

    next();
  };
};

module.exports = rateLimit;
