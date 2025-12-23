const userRequestCounts = new Map();
const REQUEST_WINDOW = 60000;
const MAX_REQUESTS = 20;

export function rateLimiter(req, res, next) {
  const identifier = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || 'unknown';

  if (identifier === 'unknown') {
    return next();
  }

  const now = Date.now();
  const userData = userRequestCounts.get(identifier) || { count: 0, resetTime: now + REQUEST_WINDOW };

  if (now > userData.resetTime) {
    userRequestCounts.set(identifier, { count: 1, resetTime: now + REQUEST_WINDOW });
    return next();
  }

  if (userData.count >= MAX_REQUESTS) {
    console.warn(`Rate limit exceeded for user: ${identifier}`);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  userData.count++;
  userRequestCounts.set(identifier, userData);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userRequestCounts.entries()) {
    if (now > value.resetTime) {
      userRequestCounts.delete(key);
    }
  }
}, REQUEST_WINDOW);
