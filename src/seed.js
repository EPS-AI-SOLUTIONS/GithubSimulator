import { store } from './store.js';
import { logger } from './utils.js';

/**
 * Pre-seed the store with realistic JaskierWorkspace data.
 */
export function seedData() {
  logger.info('Seeding GitHub simulator with JaskierWorkspace data...');

  // --- Default authenticated user ---
  store.setUser('ghp_jaskier_simulator_token', {
    login: 'jaskier-dev',
    id: 100001,
    node_id: 'U_kgDOBYz1Mg',
    avatar_url: 'https://avatars.githubusercontent.com/u/100001?v=4',
    type: 'User',
    name: 'Jaskier Developer',
    company: 'EPS-AI-SOLUTIONS',
    blog: 'https://jaskier.dev',
    location: 'Gdansk, Poland',
    email: 'dev@jaskier.dev',
    bio: 'Full-stack Rust/TS developer building the Jaskier AI ecosystem',
    public_repos: 12,
    public_gists: 3,
    followers: 42,
    following: 15,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2026-03-20T08:00:00Z',
  });

  // --- Main repository ---
  const owner = 'EPS-AI-SOLUTIONS';
  const repo = 'JaskierWorkspace';

  store.setRepo(owner, repo, {
    id: 800001,
    node_id: 'R_kgDOLz1Abc',
    name: repo,
    full_name: `${owner}/${repo}`,
    private: true,
    owner: {
      login: owner,
      id: 200001,
      avatar_url: 'https://avatars.githubusercontent.com/u/200001?v=4',
      type: 'Organization',
    },
    html_url: `https://github.com/${owner}/${repo}`,
    description: 'Monorepo: 14 apps, 23 Rust crates, 14 TS packages, 9 services — AI-powered workspace',
    fork: false,
    url: `https://api.github.com/repos/${owner}/${repo}`,
    language: 'Rust',
    stargazers_count: 47,
    watchers_count: 47,
    forks_count: 3,
    open_issues_count: 5,
    default_branch: 'master',
    topics: ['rust', 'typescript', 'ai', 'monorepo', 'mcp', 'pnpm', 'turborepo'],
    visibility: 'private',
    created_at: '2025-11-01T12:00:00Z',
    updated_at: '2026-03-20T09:30:00Z',
    pushed_at: '2026-03-20T09:30:00Z',
    size: 245000,
    has_issues: true,
    has_projects: true,
    has_wiki: false,
    has_pages: false,
    has_discussions: false,
    archived: false,
    disabled: false,
    license: null,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
  });

  // --- Secondary repos ---
  const secondaryRepos = [
    { name: 'ClaudeHydra', language: 'TypeScript', stars: 12, desc: 'Claude-powered AI chat hydra frontend + Rust backend' },
    { name: 'GeminiHydra', language: 'TypeScript', stars: 8, desc: 'Gemini-powered AI chat hydra with browser automation' },
    { name: 'Tissaia', language: 'TypeScript', stars: 15, desc: 'Tissaia orchestrator — pipeline manager, photo restoration, AI tools' },
    { name: 'Keira', language: 'Rust', stars: 5, desc: 'Keira knowledge graph and RAG service' },
    { name: 'Regis', language: 'Rust', stars: 3, desc: 'Regis Rust daemon for background processing' },
  ];

  for (const r of secondaryRepos) {
    store.setRepo(owner, r.name, {
      id: 800002 + secondaryRepos.indexOf(r),
      name: r.name,
      full_name: `${owner}/${r.name}`,
      private: true,
      owner: { login: owner, id: 200001, type: 'Organization' },
      html_url: `https://github.com/${owner}/${r.name}`,
      description: r.desc,
      language: r.language,
      stargazers_count: r.stars,
      forks_count: 0,
      open_issues_count: 0,
      default_branch: r.name === 'GrokHydra' || r.name === 'OpenAIHydra' ? 'main' : 'master',
      topics: [],
      visibility: 'private',
      created_at: '2025-12-01T12:00:00Z',
      updated_at: '2026-03-20T08:00:00Z',
      pushed_at: '2026-03-20T08:00:00Z',
    });
  }

  // --- Issues (JaskierWorkspace) ---
  const issues = [
    {
      title: 'B06: Stealth browser fingerprint rotation for nodriver sessions',
      body: 'Implement automated fingerprint rotation in jaskier-nodriver-core to avoid detection. Includes canvas, WebGL, and audio context randomization.',
      labels: [{ id: 1, name: 'enhancement', color: 'a2eeef' }, { id: 5, name: 'stealth', color: 'e4e669' }],
      user: { login: 'jaskier-dev', id: 100001 },
      assignees: [{ login: 'jaskier-dev', id: 100001 }],
      milestone: { number: 1, title: 'v2.0 Consolidation' },
    },
    {
      title: 'Orchestrator process-compose health probes flaky on Windows',
      body: 'The liveness probes for gemini-browser-proxy and jaskier-vault-mcp occasionally timeout on Windows 11. Investigate TCP vs HTTP probe differences.',
      labels: [{ id: 2, name: 'bug', color: 'd73a4a' }, { id: 6, name: 'orchestrator', color: 'c5def5' }],
      user: { login: 'jaskier-dev', id: 100001 },
      assignees: [],
    },
    {
      title: 'JSP-fusion: Add semantic cache invalidation on vault rotate',
      body: 'When vault_auto_rotate fires, semantic-cache entries referencing old credentials should be invalidated. Currently stale cache can cause 401s.',
      labels: [{ id: 1, name: 'enhancement', color: 'a2eeef' }, { id: 7, name: 'jsp-fusion', color: '0075ca' }],
      user: { login: 'jaskier-dev', id: 100001 },
      assignees: [{ login: 'jaskier-dev', id: 100001 }],
    },
    {
      title: 'Migrate jaskier-graph to petgraph 0.7 with async traversal',
      body: 'petgraph 0.7 adds async graph traversal which would benefit our Knowledge Graph RAG pipeline. Currently blocking on neo4j-bolt-client compatibility.',
      labels: [{ id: 1, name: 'enhancement', color: 'a2eeef' }, { id: 8, name: 'crate', color: 'f9d0c4' }],
      user: { login: 'jaskier-dev', id: 100001 },
      assignees: [],
    },
    {
      title: 'E2E test 71/71: Fix Tissaia pipeline drag-and-drop flake',
      body: 'The 71st Playwright test (Tissaia pipeline node drag) fails intermittently due to animation timing. Need to add waitForAnimation or use force: true.',
      labels: [{ id: 2, name: 'bug', color: 'd73a4a' }, { id: 9, name: 'testing', color: 'bfd4f2' }],
      user: { login: 'jaskier-dev', id: 100001 },
      assignees: [{ login: 'jaskier-dev', id: 100001 }],
      state: 'open',
    },
  ];

  // We need to set the counter first to get proper numbering
  for (const issue of issues) {
    store.addIssue(owner, repo, issue);
  }

  // --- Pull Requests ---
  const prs = [
    {
      title: 'feat(jsp-fusion): fuse RAG proxy into unified MCP server',
      body: '## Summary\n- Merges standalone RAG proxy service into jsp-fusion\n- Adds 3 new MCP tools: rag_query, rag_index, rag_status\n- Removes services/jaskier-rag-proxy\n\n## Test plan\n- [x] Unit tests for RAG tools\n- [x] Integration test: query + index round-trip\n- [x] Verify jsp-fusion starts with RAG enabled',
      head: { ref: 'feat/rag-fusion', sha: 'abc1234567890' },
      base: { ref: 'master', sha: 'def0987654321' },
      user: { login: 'jaskier-dev', id: 100001 },
      labels: [{ id: 1, name: 'enhancement', color: 'a2eeef' }],
      draft: false,
      additions: 847,
      deletions: 312,
      changed_files: 23,
      commits: 4,
    },
    {
      title: 'fix(orchestrator): stabilize Windows health probes with TCP fallback',
      body: '## Summary\n- Adds TCP probe fallback when HTTP probe fails on Windows\n- Increases timeout from 5s to 10s for vault-mcp probe\n\n## Test plan\n- [x] Manual test on Windows 11\n- [x] CI passes on workspace-ci.yml',
      head: { ref: 'fix/win-probes', sha: 'fed9876543210' },
      base: { ref: 'master', sha: 'def0987654321' },
      user: { login: 'jaskier-dev', id: 100001 },
      labels: [{ id: 2, name: 'bug', color: 'd73a4a' }],
      draft: false,
      additions: 45,
      deletions: 12,
      changed_files: 3,
      commits: 2,
    },
    {
      title: 'docs: add Grantify promotional materials, pitch, and presentations',
      body: '## Summary\n- Adds pitch deck content for Grantify\n- Promotional copy and feature highlights\n- Presentation slides outline',
      head: { ref: 'docs/grantify-promo', sha: '6391e68abc123' },
      base: { ref: 'master', sha: '27d6fcadef456' },
      user: { login: 'jaskier-dev', id: 100001 },
      labels: [{ id: 10, name: 'documentation', color: '0075ca' }],
      draft: false,
      merged: true,
      merged_at: '2026-03-20T09:00:00Z',
      state: 'closed',
      additions: 256,
      deletions: 0,
      changed_files: 5,
      commits: 1,
    },
  ];

  for (const pr of prs) {
    store.addPull(owner, repo, pr);
  }

  // --- Commits (matching real git log) ---
  const commits = [
    {
      sha: '6391e68abc1234567890abcdef1234567890abcd',
      commit: {
        message: 'docs: add Grantify promotional materials, pitch, and presentations',
        author: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T09:30:00Z' },
        committer: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T09:30:00Z' },
      },
      author: { login: 'jaskier-dev', id: 100001 },
      committer: { login: 'jaskier-dev', id: 100001 },
      html_url: `https://github.com/${owner}/${repo}/commit/6391e68`,
    },
    {
      sha: '27d6fca1234567890abcdef1234567890abcdef0',
      commit: {
        message: 'fix(grantify): prepare for Vercel deployment without monorepo errors',
        author: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T08:45:00Z' },
        committer: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T08:45:00Z' },
      },
      author: { login: 'jaskier-dev', id: 100001 },
      committer: { login: 'jaskier-dev', id: 100001 },
      html_url: `https://github.com/${owner}/${repo}/commit/27d6fca`,
    },
    {
      sha: 'dfedd4c234567890abcdef1234567890abcdef01',
      commit: {
        message: 'docs: update mdbook quickwins + restructure todo after 50 QW completion',
        author: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T07:15:00Z' },
        committer: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-20T07:15:00Z' },
      },
      author: { login: 'jaskier-dev', id: 100001 },
      committer: { login: 'jaskier-dev', id: 100001 },
      html_url: `https://github.com/${owner}/${repo}/commit/dfedd4c`,
    },
    {
      sha: '4f0c7fe567890abcdef1234567890abcdef012345',
      commit: {
        message: 'chore(W4): Q18,Q19,Q28,Q29 biome config, bundle tracking, swarm/sandbox tests',
        author: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-19T22:00:00Z' },
        committer: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-19T22:00:00Z' },
      },
      author: { login: 'jaskier-dev', id: 100001 },
      committer: { login: 'jaskier-dev', id: 100001 },
      html_url: `https://github.com/${owner}/${repo}/commit/4f0c7fe`,
    },
    {
      sha: '778fff4890abcdef1234567890abcdef01234567',
      commit: {
        message: 'refactor(Vesemir): Q05,Q06 split mcp/server and planner modules',
        author: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-19T20:30:00Z' },
        committer: { name: 'Jaskier Developer', email: 'dev@jaskier.dev', date: '2026-03-19T20:30:00Z' },
      },
      author: { login: 'jaskier-dev', id: 100001 },
      committer: { login: 'jaskier-dev', id: 100001 },
      html_url: `https://github.com/${owner}/${repo}/commit/778fff4`,
    },
  ];

  for (const commit of commits) {
    store.addCommit(owner, repo, commit);
  }

  // --- Workflow Runs ---
  store.addWorkflowRun(owner, repo, {
    name: 'Workspace CI',
    head_branch: 'master',
    head_sha: '6391e68abc1234567890abcdef1234567890abcd',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 1,
    run_number: 147,
    run_attempt: 1,
    html_url: `https://github.com/${owner}/${repo}/actions/runs/1`,
    jobs_url: `https://api.github.com/repos/${owner}/${repo}/actions/runs/1/jobs`,
    created_at: '2026-03-20T09:31:00Z',
    updated_at: '2026-03-20T09:38:00Z',
    actor: { login: 'jaskier-dev', id: 100001 },
  });

  store.addWorkflowRun(owner, repo, {
    name: 'Deploy',
    head_branch: 'master',
    head_sha: '6391e68abc1234567890abcdef1234567890abcd',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 2,
    run_number: 89,
    run_attempt: 1,
    html_url: `https://github.com/${owner}/${repo}/actions/runs/2`,
    jobs_url: `https://api.github.com/repos/${owner}/${repo}/actions/runs/2/jobs`,
    created_at: '2026-03-20T09:39:00Z',
    updated_at: '2026-03-20T09:47:00Z',
    actor: { login: 'jaskier-dev', id: 100001 },
  });

  // --- File contents (a few key files) ---
  const cargoToml = `[workspace]
resolver = "2"
members = [
  "apps/ClaudeHydra/backend",
  "apps/GeminiHydra/backend",
  "apps/Tissaia/backend",
  "crates/*",
  "services/*",
]`;

  store.setContent(owner, repo, 'Cargo.toml', {
    name: 'Cargo.toml',
    path: 'Cargo.toml',
    sha: 'abc123def456',
    size: cargoToml.length,
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(cargoToml).toString('base64'),
    html_url: `https://github.com/${owner}/${repo}/blob/master/Cargo.toml`,
  });

  const packageJson = `{
  "name": "jaskier-workspace",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "dev:ch": "turbo run dev --filter=claude-hydra",
    "dev:gh": "turbo run dev --filter=gemini-hydra",
    "test": "turbo run test",
    "orch:start": "process-compose up"
  }
}`;

  store.setContent(owner, repo, 'package.json', {
    name: 'package.json',
    path: 'package.json',
    sha: 'def456abc789',
    size: packageJson.length,
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(packageJson).toString('base64'),
    html_url: `https://github.com/${owner}/${repo}/blob/master/package.json`,
  });

  store.setContent(owner, repo, 'CLAUDE.md', {
    name: 'CLAUDE.md',
    path: 'CLAUDE.md',
    sha: 'fed987654321',
    size: 12800,
    type: 'file',
    encoding: 'base64',
    content: Buffer.from('# Jaskier Workspace — Canonical Reference\n\n(truncated for simulator)').toString('base64'),
    html_url: `https://github.com/${owner}/${repo}/blob/master/CLAUDE.md`,
  });

  // Directory listing for root
  store.setContent(owner, repo, '', {
    type: 'dir',
    entries: [
      { name: 'apps', path: 'apps', type: 'dir', sha: 'aaa111' },
      { name: 'crates', path: 'crates', type: 'dir', sha: 'bbb222' },
      { name: 'packages', path: 'packages', type: 'dir', sha: 'ccc333' },
      { name: 'services', path: 'services', type: 'dir', sha: 'ddd444' },
      { name: 'monitoring', path: 'monitoring', type: 'dir', sha: 'eee555' },
      { name: 'docs', path: 'docs', type: 'dir', sha: 'fff666' },
      { name: 'Cargo.toml', path: 'Cargo.toml', type: 'file', sha: 'abc123def456', size: cargoToml.length },
      { name: 'package.json', path: 'package.json', type: 'file', sha: 'def456abc789', size: packageJson.length },
      { name: 'CLAUDE.md', path: 'CLAUDE.md', type: 'file', sha: 'fed987654321', size: 12800 },
      { name: 'pnpm-workspace.yaml', path: 'pnpm-workspace.yaml', type: 'file', sha: 'ggg777', size: 120 },
      { name: 'turbo.json', path: 'turbo.json', type: 'file', sha: 'hhh888', size: 450 },
    ],
  });

  logger.success(`Seeded: 1 org, ${store.repos.size} repos, ${store.getIssues(owner, repo).length} issues, ${store.getPulls(owner, repo).length} PRs, ${store.getCommits(owner, repo).length} commits, ${store.getWorkflowRuns(owner, repo).length} workflow runs`);
}
