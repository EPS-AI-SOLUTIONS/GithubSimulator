import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import reposRouter from './routes/repos.js';
import issuesRouter from './routes/issues.js';
import pullsRouter from './routes/pulls.js';
import actionsRouter from './routes/actions.js';
import contentsRouter from './routes/contents.js';
import usersRouter from './routes/users.js';
import { store } from './store.js';
import { logger } from './utils.js';

export function createServer() {
  const app = express();

  // --- Global middleware ---

  // 1. Logging
  app.use(morgan('dev'));

  // 2. Security & Performance
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());

  // 3. Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Hide Express
  app.disable('x-powered-by');

  // 5. GitHub-style response headers on every request
  app.use((_req, res, next) => {
    res.set('X-GitHub-Media-Type', 'github.v3; format=json');
    res.set('X-GitHub-Request-Id', crypto.randomUUID());
    res.set('Access-Control-Expose-Headers',
      'ETag, Link, Location, Retry-After, X-GitHub-OTP, ' +
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, ' +
      'X-RateLimit-Resource, X-RateLimit-Reset, X-GitHub-Request-Id'
    );
    next();
  });

  // 6. Rate limiting (GitHub-style headers)
  app.use(rateLimitMiddleware);

  // 7. Auth (all API routes require auth)
  app.use(authMiddleware);

  // --- Health check (no auth needed) ---
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      simulator: 'github',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // --- GitHub API root ---
  app.get('/', (_req, res) => {
    res.json({
      current_user_url: '/user',
      repository_url: '/repos/{owner}/{repo}',
      issue_search_url: '/search/issues?q={query}',
      organization_repositories_url: '/orgs/{org}/repos',
      emojis_url: '/emojis',
      rate_limit_url: '/rate_limit',
    });
  });

  // --- Rate limit endpoint ---
  app.get('/rate_limit', (_req, res) => {
    res.json({
      resources: {
        core: {
          limit: 5000,
          remaining: parseInt(res.get('X-RateLimit-Remaining') || '4999', 10),
          reset: parseInt(res.get('X-RateLimit-Reset') || '0', 10),
          used: parseInt(res.get('X-RateLimit-Used') || '1', 10),
        },
        search: { limit: 30, remaining: 30, reset: 0, used: 0 },
        graphql: { limit: 5000, remaining: 5000, reset: 0, used: 0 },
      },
      rate: {
        limit: 5000,
        remaining: parseInt(res.get('X-RateLimit-Remaining') || '4999', 10),
        reset: parseInt(res.get('X-RateLimit-Reset') || '0', 10),
        used: parseInt(res.get('X-RateLimit-Used') || '1', 10),
      },
    });
  });

  // --- CI Validation endpoint ---
  app.post('/validate', async (req, res) => {
    const { workspace_path } = req.body;
    if (!workspace_path) return res.status(400).json({ error: 'workspace_path required' });

    const { runAllValidators } = await import('./validators/runner.js');
    const result = await runAllValidators(workspace_path);
    res.json(result);
  });

  // --- Organization repos (mounted before /repos to avoid conflict) ---
  app.get('/orgs/:org/repos', (req, res) => {
    const { org } = req.params;
    const repos = store.listRepos(org);

    logger.github(`GET /orgs/${org}/repos (${repos.length})`);
    res.json(repos);
  });

  // --- API Routes ---
  app.use('/repos', reposRouter);
  app.use('/repos', issuesRouter);
  app.use('/repos', pullsRouter);
  app.use('/repos', actionsRouter);
  app.use('/repos', contentsRouter);
  app.use('/user', usersRouter);
  app.use('/users', usersRouter);

  // --- 404 fallback ---
  app.use((_req, res) => {
    res.status(404).json({
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest',
    });
  });

  // --- Error handler ---
  app.use((err, _req, res, _next) => {
    logger.error(`Unhandled error: ${err.stack || err.message}`);
    res.status(500).json({
      message: 'Internal Server Error',
    });
  });

  return app;
}
