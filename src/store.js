import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory data store for the GitHub simulator.
 * All data lives here — no database required.
 */
class Store {
  constructor() {
    this.repos = new Map();
    this.issues = new Map();       // key: "owner/repo"  -> Issue[]
    this.pulls = new Map();        // key: "owner/repo"  -> PR[]
    this.commits = new Map();      // key: "owner/repo"  -> Commit[]
    this.workflowRuns = new Map(); // key: "owner/repo"  -> Run[]
    this.contents = new Map();     // key: "owner/repo/path" -> FileContent
    this.users = new Map();        // key: token -> User
    this.webhooks = new Map();     // key: "owner/repo"  -> Webhook[]
    this.comments = new Map();     // key: "owner/repo/issue_number" -> Comment[]

    // Counters for auto-incrementing IDs
    this._issueCounters = new Map();
    this._prCounters = new Map();
    this._runCounters = new Map();
  }

  // --- Repos ---

  getRepo(owner, repo) {
    return this.repos.get(`${owner}/${repo}`) || null;
  }

  setRepo(owner, repo, data) {
    this.repos.set(`${owner}/${repo}`, data);
  }

  listRepos(owner) {
    const results = [];
    for (const [key, val] of this.repos) {
      if (key.startsWith(`${owner}/`)) {
        results.push(val);
      }
    }
    return results;
  }

  // --- Issues ---

  getIssues(owner, repo) {
    return this.issues.get(`${owner}/${repo}`) || [];
  }

  addIssue(owner, repo, issue) {
    const key = `${owner}/${repo}`;
    if (!this._issueCounters.has(key)) this._issueCounters.set(key, 0);
    const num = this._issueCounters.get(key) + 1;
    this._issueCounters.set(key, num);

    const full = {
      id: parseInt(uuidv4().replace(/-/g, '').slice(0, 8), 16),
      number: num,
      state: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      comments: 0,
      ...issue,
      number: num,
    };

    const list = this.issues.get(key) || [];
    list.push(full);
    this.issues.set(key, list);
    return full;
  }

  getIssue(owner, repo, number) {
    const list = this.getIssues(owner, repo);
    return list.find((i) => i.number === number) || null;
  }

  updateIssue(owner, repo, number, updates) {
    const list = this.getIssues(owner, repo);
    const idx = list.findIndex((i) => i.number === number);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
    if (updates.state === 'closed') list[idx].closed_at = new Date().toISOString();
    return list[idx];
  }

  // --- Pull Requests ---

  getPulls(owner, repo) {
    return this.pulls.get(`${owner}/${repo}`) || [];
  }

  addPull(owner, repo, pr) {
    const key = `${owner}/${repo}`;
    // PRs share the issue number space on GitHub
    if (!this._issueCounters.has(key)) this._issueCounters.set(key, 0);
    const num = this._issueCounters.get(key) + 1;
    this._issueCounters.set(key, num);

    if (!this._prCounters.has(key)) this._prCounters.set(key, 0);
    const prId = this._prCounters.get(key) + 1;
    this._prCounters.set(key, prId);

    const full = {
      id: parseInt(uuidv4().replace(/-/g, '').slice(0, 8), 16),
      number: num,
      state: 'open',
      merged: false,
      mergeable: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      merged_at: null,
      comments: 0,
      commits: 1,
      additions: 0,
      deletions: 0,
      changed_files: 0,
      ...pr,
      number: num,
    };

    const list = this.pulls.get(key) || [];
    list.push(full);
    this.pulls.set(key, list);
    return full;
  }

  getPull(owner, repo, number) {
    const list = this.getPulls(owner, repo);
    return list.find((p) => p.number === number) || null;
  }

  // --- Commits ---

  getCommits(owner, repo) {
    return this.commits.get(`${owner}/${repo}`) || [];
  }

  addCommit(owner, repo, commit) {
    const key = `${owner}/${repo}`;
    const list = this.commits.get(key) || [];
    list.unshift(commit); // newest first
    this.commits.set(key, list);
    return commit;
  }

  // --- Workflow Runs ---

  getWorkflowRuns(owner, repo) {
    return this.workflowRuns.get(`${owner}/${repo}`) || [];
  }

  addWorkflowRun(owner, repo, run) {
    const key = `${owner}/${repo}`;
    if (!this._runCounters.has(key)) this._runCounters.set(key, 0);
    const runId = this._runCounters.get(key) + 1;
    this._runCounters.set(key, runId);

    const full = {
      id: runId,
      status: 'completed',
      conclusion: 'success',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...run,
      id: runId,
    };

    const list = this.workflowRuns.get(key) || [];
    list.unshift(full);
    this.workflowRuns.set(key, list);
    return full;
  }

  // --- Contents ---

  getContent(owner, repo, filePath) {
    return this.contents.get(`${owner}/${repo}/${filePath}`) || null;
  }

  setContent(owner, repo, filePath, data) {
    this.contents.set(`${owner}/${repo}/${filePath}`, data);
  }

  // --- Users ---

  getUser(token) {
    return this.users.get(token) || null;
  }

  setUser(token, user) {
    this.users.set(token, user);
  }

  // --- Webhooks ---

  getWebhooks(owner, repo) {
    return this.webhooks.get(`${owner}/${repo}`) || [];
  }

  addWebhook(owner, repo, webhook) {
    const key = `${owner}/${repo}`;
    const list = this.webhooks.get(key) || [];
    const full = {
      id: list.length + 1,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...webhook,
    };
    list.push(full);
    this.webhooks.set(key, list);
    return full;
  }

  // --- Comments ---

  getComments(owner, repo, issueNumber) {
    return this.comments.get(`${owner}/${repo}/${issueNumber}`) || [];
  }

  addComment(owner, repo, issueNumber, comment) {
    const key = `${owner}/${repo}/${issueNumber}`;
    const list = this.comments.get(key) || [];
    const full = {
      id: parseInt(uuidv4().replace(/-/g, '').slice(0, 8), 16),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...comment,
    };
    list.push(full);
    this.comments.set(key, list);
    return full;
  }

  // --- Reset ---

  reset() {
    this.repos.clear();
    this.issues.clear();
    this.pulls.clear();
    this.commits.clear();
    this.workflowRuns.clear();
    this.contents.clear();
    this.users.clear();
    this.webhooks.clear();
    this.comments.clear();
    this._issueCounters.clear();
    this._prCounters.clear();
    this._runCounters.clear();
  }
}

// Singleton
export const store = new Store();
