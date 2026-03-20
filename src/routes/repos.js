import { Router } from 'express';
import { store } from '../store.js';
import { paginate } from '../middleware/pagination.js';
import { apiUrl, logger } from '../utils.js';

const router = Router();

/**
 * GET /repos/:owner/:repo
 * Get repository info.
 */
router.get('/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest/repos/repos#get-a-repository',
    });
  }

  logger.github(`GET repo ${owner}/${repo}`);
  res.json(repoData);
});

/**
 * GET /repos/:owner/:repo/commits
 * List commits.
 * Query params: sha, per_page, page
 */
router.get('/:owner/:repo/commits', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  let commits = store.getCommits(owner, repo);

  // Filter by sha (branch) — simplified: just return all
  if (req.query.sha) {
    // In a real API this filters by branch; we just tag it
    commits = commits.filter((c) =>
      c.sha.startsWith(req.query.sha) || c.commit?.message?.includes(req.query.sha) || true
    );
  }

  const { items, linkHeader } = paginate(req, commits);
  if (linkHeader) res.set('Link', linkHeader);

  logger.github(`GET commits ${owner}/${repo} (${items.length}/${commits.length})`);
  res.json(items);
});

/**
 * GET /repos/:owner/:repo/hooks
 * List webhooks.
 */
router.get('/:owner/:repo/hooks', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const webhooks = store.getWebhooks(owner, repo);
  logger.github(`GET webhooks ${owner}/${repo} (${webhooks.length})`);
  res.json(webhooks);
});

/**
 * POST /repos/:owner/:repo/hooks
 * Create a webhook and fire a test event.
 */
router.post('/:owner/:repo/hooks', async (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const { name, config, events, active } = req.body;

  if (!config || !config.url) {
    return res.status(422).json({
      message: 'Validation Failed',
      errors: [{ resource: 'Hook', code: 'custom', field: 'config', message: 'config.url is required' }],
    });
  }

  const webhook = store.addWebhook(owner, repo, {
    name: name || 'web',
    config,
    events: events || ['push'],
    active: active !== false,
  });

  logger.github(`POST webhook ${owner}/${repo} -> ${config.url}`);

  // Fire a test ping event asynchronously
  if (webhook.active && config.url) {
    setTimeout(async () => {
      try {
        const payload = {
          zen: 'Jaskier says: Toss a coin to your witcher!',
          hook_id: webhook.id,
          hook: webhook,
          repository: repoData,
          sender: req.user || { login: 'simulator-user' },
        };

        await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Event': 'ping',
            'X-GitHub-Delivery': crypto.randomUUID(),
            'X-Hub-Signature-256': 'sha256=simulated',
          },
          body: JSON.stringify(payload),
        });

        logger.github(`Webhook ping sent to ${config.url}`);
      } catch (err) {
        logger.warn(`Webhook ping failed for ${config.url}: ${err.message}`);
      }
    }, 100);
  }

  res.status(201).json(webhook);
});

/**
 * GET /orgs/:org/repos
 * List organization repositories.
 */
router.get('/../../orgs/:org/repos', (req, res) => {
  const { org } = req.params;
  const repos = store.listRepos(org);

  const { items, linkHeader } = paginate(req, repos);
  if (linkHeader) res.set('Link', linkHeader);

  logger.github(`GET org repos ${org} (${items.length})`);
  res.json(items);
});

export default router;
