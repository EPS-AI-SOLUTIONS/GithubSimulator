import { store } from '../store.js';

/**
 * GitHub-style Bearer token authentication middleware.
 *
 * Accepts:
 *   Authorization: Bearer <token>
 *   Authorization: token <token>
 *
 * If a valid token is found in the store, req.user is populated.
 * If no token is provided or the token is unknown, responds with 401
 * (unless the route is marked as public via req.skipAuth).
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // Allow unauthenticated access for public endpoints
    if (req.skipAuth) return next();
    return res.status(401).json({
      message: 'Requires authentication',
      documentation_url: 'https://docs.github.com/rest',
    });
  }

  // Support both "Bearer <token>" and "token <token>" (GitHub accepts both)
  const match = authHeader.match(/^(?:Bearer|token)\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      message: 'Bad credentials',
      documentation_url: 'https://docs.github.com/rest',
    });
  }

  const token = match[1];
  const user = store.getUser(token);

  if (!user) {
    // In simulator mode, accept any token and create a default user
    req.user = {
      login: 'simulator-user',
      id: 999999,
      type: 'User',
      name: 'Simulator User',
    };
  } else {
    req.user = user;
  }

  next();
}

/**
 * Mark a route handler to skip auth (for public endpoints like /repos/:owner/:repo on public repos).
 */
export function publicRoute(req, _res, next) {
  req.skipAuth = true;
  next();
}
