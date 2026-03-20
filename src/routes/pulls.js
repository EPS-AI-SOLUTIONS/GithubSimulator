import { Router } from 'express';
import { store } from '../store.js';
import { paginate } from '../middleware/pagination.js';
import { apiUrl, logger } from '../utils.js';

const router = Router();

/**
 * GET /repos/:owner/:repo/pulls
 * List pull requests.
 * Query params: state (open|closed|all), head, base, sort, direction, per_page, page
 */
router.get('/:owner/:repo/pulls', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  let pulls = store.getPulls(owner, repo);

  // Filter by state
  const state = req.query.state || 'open';
  if (state !== 'all') {
    pulls = pulls.filter((p) => p.state === state);
  }

  // Filter by head branch
  if (req.query.head) {
    const headRef = req.query.head.includes(':')
      ? req.query.head.split(':')[1]
      : req.query.head;
    pulls = pulls.filter((p) => p.head && p.head.ref === headRef);
  }

  // Filter by base branch
  if (req.query.base) {
    pulls = pulls.filter((p) => p.base && p.base.ref === req.query.base);
  }

  // Sort
  const sort = req.query.sort || 'created';
  const direction = req.query.direction || 'desc';
  pulls.sort((a, b) => {
    let fieldA, fieldB;
    if (sort === 'updated') {
      fieldA = a.updated_at;
      fieldB = b.updated_at;
    } else if (sort === 'popularity') {
      fieldA = a.comments || 0;
      fieldB = b.comments || 0;
      return direction === 'asc' ? fieldA - fieldB : fieldB - fieldA;
    } else {
      fieldA = a.created_at;
      fieldB = b.created_at;
    }
    return direction === 'asc'
      ? new Date(fieldA) - new Date(fieldB)
      : new Date(fieldB) - new Date(fieldA);
  });

  const { items, linkHeader } = paginate(req, pulls);
  if (linkHeader) res.set('Link', linkHeader);

  // Enrich with URLs
  const enriched = items.map((p) => ({
    ...p,
    url: apiUrl(req, `/repos/${owner}/${repo}/pulls/${p.number}`),
    html_url: `https://github.com/${owner}/${repo}/pull/${p.number}`,
    issue_url: apiUrl(req, `/repos/${owner}/${repo}/issues/${p.number}`),
    commits_url: apiUrl(req, `/repos/${owner}/${repo}/pulls/${p.number}/commits`),
    review_comments_url: apiUrl(req, `/repos/${owner}/${repo}/pulls/${p.number}/comments`),
    diff_url: `https://github.com/${owner}/${repo}/pull/${p.number}.diff`,
    patch_url: `https://github.com/${owner}/${repo}/pull/${p.number}.patch`,
  }));

  logger.github(`GET pulls ${owner}/${repo} state=${state} (${items.length})`);
  res.json(enriched);
});

/**
 * GET /repos/:owner/:repo/pulls/:pull_number
 * Get a single pull request.
 */
router.get('/:owner/:repo/pulls/:pull_number', (req, res) => {
  const { owner, repo, pull_number } = req.params;
  const num = parseInt(pull_number, 10);
  const pr = store.getPull(owner, repo, num);

  if (!pr) {
    return res.status(404).json({ message: 'Not Found' });
  }

  logger.github(`GET pull ${owner}/${repo}#${num}`);
  res.json({
    ...pr,
    url: apiUrl(req, `/repos/${owner}/${repo}/pulls/${num}`),
    html_url: `https://github.com/${owner}/${repo}/pull/${num}`,
    mergeable: pr.mergeable !== undefined ? pr.mergeable : true,
    mergeable_state: pr.merged ? 'merged' : 'clean',
  });
});

/**
 * POST /repos/:owner/:repo/pulls
 * Create a pull request.
 */
router.post('/:owner/:repo/pulls', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const { title, body, head, base, draft } = req.body;

  if (!title || !head || !base) {
    return res.status(422).json({
      message: 'Validation Failed',
      errors: [
        ...(!title ? [{ resource: 'PullRequest', code: 'missing_field', field: 'title' }] : []),
        ...(!head ? [{ resource: 'PullRequest', code: 'missing_field', field: 'head' }] : []),
        ...(!base ? [{ resource: 'PullRequest', code: 'missing_field', field: 'base' }] : []),
      ],
    });
  }

  const pr = store.addPull(owner, repo, {
    title,
    body: body || '',
    head: { ref: head, sha: 'simulated_' + Date.now().toString(36) },
    base: { ref: base, sha: 'simulated_base_' + Date.now().toString(36) },
    user: req.user || { login: 'simulator-user', id: 999999 },
    draft: draft || false,
    labels: [],
  });

  logger.github(`POST pull ${owner}/${repo}#${pr.number}: ${title}`);

  res.status(201).json({
    ...pr,
    url: apiUrl(req, `/repos/${owner}/${repo}/pulls/${pr.number}`),
    html_url: `https://github.com/${owner}/${repo}/pull/${pr.number}`,
  });
});

/**
 * PUT /repos/:owner/:repo/pulls/:pull_number/merge
 * Merge a pull request (simulated).
 */
router.put('/:owner/:repo/pulls/:pull_number/merge', (req, res) => {
  const { owner, repo, pull_number } = req.params;
  const num = parseInt(pull_number, 10);
  const pr = store.getPull(owner, repo, num);

  if (!pr) {
    return res.status(404).json({ message: 'Not Found' });
  }

  if (pr.merged) {
    return res.status(405).json({ message: 'Pull Request is not mergeable' });
  }

  if (pr.state === 'closed') {
    return res.status(422).json({ message: 'Pull Request is closed' });
  }

  // Merge it
  pr.merged = true;
  pr.merged_at = new Date().toISOString();
  pr.state = 'closed';
  pr.closed_at = new Date().toISOString();
  pr.updated_at = new Date().toISOString();

  const mergeCommitSha = 'merge_' + Date.now().toString(36);

  logger.github(`MERGE pull ${owner}/${repo}#${num}`);
  res.json({
    sha: mergeCommitSha,
    merged: true,
    message: 'Pull Request successfully merged',
  });
});

export default router;
