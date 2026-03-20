import { Router } from 'express';
import { store } from '../store.js';
import { paginate } from '../middleware/pagination.js';
import { apiUrl, logger } from '../utils.js';

const router = Router();

/**
 * GET /repos/:owner/:repo/actions/runs
 * List workflow runs.
 * Query params: status, branch, event, per_page, page
 */
router.get('/:owner/:repo/actions/runs', (req, res) => {
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  let runs = store.getWorkflowRuns(owner, repo);

  // Filter by status
  if (req.query.status) {
    runs = runs.filter((r) => r.status === req.query.status);
  }

  // Filter by branch
  if (req.query.branch) {
    runs = runs.filter((r) => r.head_branch === req.query.branch);
  }

  // Filter by event
  if (req.query.event) {
    runs = runs.filter((r) => r.event === req.query.event);
  }

  // Filter by conclusion
  if (req.query.conclusion) {
    runs = runs.filter((r) => r.conclusion === req.query.conclusion);
  }

  const { items, linkHeader, totalItems } = paginate(req, runs);
  if (linkHeader) res.set('Link', linkHeader);

  // Enrich with URLs
  const enriched = items.map((r) => ({
    ...r,
    url: apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}`),
    html_url: r.html_url || `https://github.com/${owner}/${repo}/actions/runs/${r.id}`,
    jobs_url: r.jobs_url || apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}/jobs`),
    logs_url: apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}/logs`),
    artifacts_url: apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}/artifacts`),
    cancel_url: apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}/cancel`),
    rerun_url: apiUrl(req, `/repos/${owner}/${repo}/actions/runs/${r.id}/rerun`),
    repository: {
      id: repoData.id,
      name: repoData.name,
      full_name: repoData.full_name,
    },
  }));

  logger.github(`GET actions/runs ${owner}/${repo} (${items.length}/${totalItems})`);

  // GitHub wraps workflow runs in a { total_count, workflow_runs } envelope
  res.json({
    total_count: totalItems,
    workflow_runs: enriched,
  });
});

/**
 * GET /repos/:owner/:repo/actions/runs/:run_id
 * Get a single workflow run.
 */
router.get('/:owner/:repo/actions/runs/:run_id', (req, res) => {
  const { owner, repo, run_id } = req.params;
  const id = parseInt(run_id, 10);
  const runs = store.getWorkflowRuns(owner, repo);
  const run = runs.find((r) => r.id === id);

  if (!run) {
    return res.status(404).json({ message: 'Not Found' });
  }

  logger.github(`GET actions/run ${owner}/${repo}#${id}`);
  res.json(run);
});

/**
 * POST /repos/:owner/:repo/actions/runs/:run_id/rerun
 * Re-run a workflow (simulated — just resets status).
 */
router.post('/:owner/:repo/actions/runs/:run_id/rerun', (req, res) => {
  const { owner, repo, run_id } = req.params;
  const id = parseInt(run_id, 10);
  const runs = store.getWorkflowRuns(owner, repo);
  const run = runs.find((r) => r.id === id);

  if (!run) {
    return res.status(404).json({ message: 'Not Found' });
  }

  run.status = 'queued';
  run.conclusion = null;
  run.run_attempt = (run.run_attempt || 1) + 1;
  run.updated_at = new Date().toISOString();

  // Simulate completion after 3 seconds
  setTimeout(() => {
    run.status = 'completed';
    run.conclusion = 'success';
    run.updated_at = new Date().toISOString();
    logger.github(`Workflow run ${owner}/${repo}#${id} completed (simulated)`);
  }, 3000);

  logger.github(`RERUN actions/run ${owner}/${repo}#${id}`);
  res.status(201).json({ message: 'Workflow run re-run initiated' });
});

export default router;
