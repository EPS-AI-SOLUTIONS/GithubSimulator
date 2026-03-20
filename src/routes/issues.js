import { Router } from 'express';
import { store } from '../store.js';
import { paginate } from '../middleware/pagination.js';
import { apiUrl, logger } from '../utils.js';

const router = Router();

/**
 * GET /repos/:owner/:repo/issues
 * List issues.
 * Query params: state (open|closed|all), labels (comma-separated), sort, direction, per_page, page
 */
router.get('/:owner/:repo/issues', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  let issues = store.getIssues(owner, repo);

  // Filter by state
  const state = req.query.state || 'open';
  if (state !== 'all') {
    issues = issues.filter((i) => i.state === state);
  }

  // Filter by labels
  if (req.query.labels) {
    const filterLabels = req.query.labels.split(',').map((l) => l.trim().toLowerCase());
    issues = issues.filter((i) =>
      i.labels && i.labels.some((label) => filterLabels.includes(label.name.toLowerCase()))
    );
  }

  // Filter by assignee
  if (req.query.assignee) {
    issues = issues.filter((i) =>
      i.assignees && i.assignees.some((a) => a.login === req.query.assignee)
    );
  }

  // Filter by milestone
  if (req.query.milestone) {
    issues = issues.filter((i) =>
      i.milestone && String(i.milestone.number) === String(req.query.milestone)
    );
  }

  // Sort
  const sort = req.query.sort || 'created';
  const direction = req.query.direction || 'desc';
  issues.sort((a, b) => {
    const fieldA = sort === 'updated' ? a.updated_at : a.created_at;
    const fieldB = sort === 'updated' ? b.updated_at : b.created_at;
    return direction === 'asc'
      ? new Date(fieldA) - new Date(fieldB)
      : new Date(fieldB) - new Date(fieldA);
  });

  const { items, linkHeader } = paginate(req, issues);
  if (linkHeader) res.set('Link', linkHeader);

  // Enrich with URLs
  const enriched = items.map((i) => ({
    ...i,
    url: apiUrl(req, `/repos/${owner}/${repo}/issues/${i.number}`),
    html_url: `https://github.com/${owner}/${repo}/issues/${i.number}`,
    repository_url: apiUrl(req, `/repos/${owner}/${repo}`),
    labels_url: apiUrl(req, `/repos/${owner}/${repo}/issues/${i.number}/labels{/name}`),
    comments_url: apiUrl(req, `/repos/${owner}/${repo}/issues/${i.number}/comments`),
  }));

  logger.github(`GET issues ${owner}/${repo} state=${state} (${items.length})`);
  res.json(enriched);
});

/**
 * GET /repos/:owner/:repo/issues/:issue_number
 * Get a single issue.
 */
router.get('/:owner/:repo/issues/:issue_number', (req, res) => {
  const { owner, repo, issue_number } = req.params;
  const num = parseInt(issue_number, 10);
  const issue = store.getIssue(owner, repo, num);

  if (!issue) {
    return res.status(404).json({ message: 'Not Found' });
  }

  logger.github(`GET issue ${owner}/${repo}#${num}`);
  res.json({
    ...issue,
    url: apiUrl(req, `/repos/${owner}/${repo}/issues/${num}`),
    html_url: `https://github.com/${owner}/${repo}/issues/${num}`,
  });
});

/**
 * POST /repos/:owner/:repo/issues
 * Create an issue.
 */
router.post('/:owner/:repo/issues', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const { title, body, labels, assignees, milestone } = req.body;

  if (!title) {
    return res.status(422).json({
      message: 'Validation Failed',
      errors: [{ resource: 'Issue', code: 'missing_field', field: 'title' }],
    });
  }

  const issue = store.addIssue(owner, repo, {
    title,
    body: body || '',
    labels: (labels || []).map((l) =>
      typeof l === 'string' ? { id: 0, name: l, color: 'ededed' } : l
    ),
    assignees: (assignees || []).map((a) =>
      typeof a === 'string' ? { login: a, id: 0 } : a
    ),
    milestone: milestone || null,
    user: req.user || { login: 'simulator-user', id: 999999 },
  });

  logger.github(`POST issue ${owner}/${repo}#${issue.number}: ${title}`);

  res.status(201).json({
    ...issue,
    url: apiUrl(req, `/repos/${owner}/${repo}/issues/${issue.number}`),
    html_url: `https://github.com/${owner}/${repo}/issues/${issue.number}`,
  });
});

/**
 * PATCH /repos/:owner/:repo/issues/:issue_number
 * Update an issue (state, title, body, labels, assignees).
 */
router.patch('/:owner/:repo/issues/:issue_number', (req, res) => {
  const { owner, repo, issue_number } = req.params;
  const num = parseInt(issue_number, 10);

  const updated = store.updateIssue(owner, repo, num, req.body);

  if (!updated) {
    return res.status(404).json({ message: 'Not Found' });
  }

  logger.github(`PATCH issue ${owner}/${repo}#${num}`);
  res.json(updated);
});

/**
 * GET /repos/:owner/:repo/issues/:issue_number/comments
 * List comments on an issue.
 */
router.get('/:owner/:repo/issues/:issue_number/comments', (req, res) => {
  const { owner, repo, issue_number } = req.params;
  const num = parseInt(issue_number, 10);

  const issue = store.getIssue(owner, repo, num);
  if (!issue) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const comments = store.getComments(owner, repo, num);
  const { items, linkHeader } = paginate(req, comments);
  if (linkHeader) res.set('Link', linkHeader);

  logger.github(`GET comments ${owner}/${repo}#${num} (${items.length})`);
  res.json(items);
});

/**
 * POST /repos/:owner/:repo/issues/:issue_number/comments
 * Create a comment on an issue.
 */
router.post('/:owner/:repo/issues/:issue_number/comments', (req, res) => {
  const { owner, repo, issue_number } = req.params;
  const num = parseInt(issue_number, 10);

  const issue = store.getIssue(owner, repo, num);
  if (!issue) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const { body } = req.body;
  if (!body) {
    return res.status(422).json({
      message: 'Validation Failed',
      errors: [{ resource: 'IssueComment', code: 'missing_field', field: 'body' }],
    });
  }

  const comment = store.addComment(owner, repo, num, {
    body,
    user: req.user || { login: 'simulator-user', id: 999999 },
  });

  // Increment issue comment count
  store.updateIssue(owner, repo, num, { comments: (issue.comments || 0) + 1 });

  logger.github(`POST comment ${owner}/${repo}#${num}`);
  res.status(201).json(comment);
});

export default router;
