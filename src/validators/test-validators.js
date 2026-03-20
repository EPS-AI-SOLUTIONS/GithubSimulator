/**
 * Unit tests for CI validators using mock data.
 * Does not require actual cargo/pnpm/git to be installed.
 */

import { validateNode } from './node.js';
import { validateSecrets } from './secrets.js';
import { validateBiome } from './biome.js';
import { validateCiWorkflows } from './ci-workflows.js';
import { validateWorktrees } from './worktrees.js';
import { validateDocker } from './docker.js';
import { validateVercel } from './vercel.js';
import { join } from 'path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'ghsim-test-'));
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

console.log('=== Validator Unit Tests ===\n');

// --- Node validator tests ---
console.log('1. Node validator — missing package.json');
{
  const dir = createTempDir();
  const results = validateNode(dir);
  // No package.json means no packageManager check, but lockfile and workspace checks still run
  check(results.length >= 1, `returns ${results.length} result(s)`);
  const lockResult = results.find(r => r.name === 'pnpm-lock.yaml');
  check(lockResult && lockResult.status === 'fail', 'pnpm-lock.yaml fails when missing');
  cleanup(dir);
}

console.log('\n2. Node validator — valid workspace');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test-workspace',
    packageManager: 'pnpm@10.5.0',
  }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
  const results = validateNode(dir);
  check(results.length === 4, `returns 4 results (got ${results.length})`);
  check(results.every(r => r.status === 'pass'), 'all checks pass');
  cleanup(dir);
}

console.log('\n3. Node validator — missing packageManager field');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  const results = validateNode(dir);
  const pmResult = results.find(r => r.name === 'packageManager field');
  check(pmResult && pmResult.status === 'fail', 'packageManager field fails when missing');
  check(pmResult && pmResult.errors[0].includes('Missing packageManager'), 'error message mentions missing field');
  cleanup(dir);
}

console.log('\n4. Node validator — non-pnpm packageManager');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test',
    packageManager: 'npm@10.0.0',
  }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  const results = validateNode(dir);
  const pmResult = results.find(r => r.name === 'packageManager field');
  check(pmResult && pmResult.status === 'warn', 'packageManager field warns for non-pnpm');
  cleanup(dir);
}

console.log('\n5. Node validator — missing pnpm-workspace.yaml');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test',
    packageManager: 'pnpm@10.5.0',
  }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  const results = validateNode(dir);
  const wsResult = results.find(r => r.name === 'pnpm-workspace.yaml');
  check(wsResult && wsResult.status === 'warn', 'pnpm-workspace.yaml warns when missing');
  cleanup(dir);
}

// --- Secrets validator tests ---
console.log('\n6. Secrets validator — clean workspace (no staged files)');
{
  const dir = createTempDir();
  // Initialize a bare git repo so git diff works
  try {
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    const results = validateSecrets(dir);
    check(results.length === 1, `returns 1 result (got ${results.length})`);
    check(results[0].status === 'pass', 'secrets scan passes with no staged secrets');
  } catch {
    console.log('  SKIP: git not available for secrets test');
  }
  cleanup(dir);
}

// --- Result structure tests ---
console.log('\n7. Result structure validation');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test',
    packageManager: 'pnpm@10.5.0',
  }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), '');
  const results = validateNode(dir);
  for (const r of results) {
    check(typeof r.name === 'string' && r.name.length > 0, `result "${r.name}" has a name`);
    check(['pass', 'fail', 'warn', 'skip'].includes(r.status), `result "${r.name}" has valid status: ${r.status}`);
    if (r.status === 'fail' || r.status === 'warn') {
      check(Array.isArray(r.errors), `result "${r.name}" has errors array when ${r.status}`);
    }
  }
  cleanup(dir);
}

// --- Biome validator tests ---
console.log('\n8. Biome validator — no biome.json');
{
  const dir = createTempDir();
  const results = validateBiome(dir);
  check(results.length === 1, `returns 1 result (got ${results.length})`);
  check(results[0].status === 'skip', 'returns skip when no biome.json');
  check(results[0].errors[0].includes('No biome.json'), 'error mentions missing biome.json');
  cleanup(dir);
}

console.log('\n9. Biome validator — invalid JSON');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'biome.json'), '{ invalid json }}}');
  const results = validateBiome(dir);
  check(results.length === 1, `returns 1 result (got ${results.length})`);
  check(results[0].status === 'fail', 'fails on invalid JSON');
  check(results[0].errors[0].includes('Invalid JSON'), 'error mentions invalid JSON');
  cleanup(dir);
}

console.log('\n10. Biome validator — valid config with vcs.useIgnoreFile');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'biome.json'), JSON.stringify({
    vcs: { clientKind: 'git', useIgnoreFile: true },
    linter: { enabled: true },
  }));
  const results = validateBiome(dir);
  const jsonResult = results.find(r => r.name === 'biome.json');
  check(jsonResult && jsonResult.status === 'pass', 'biome.json passes');
  const vcsResult = results.find(r => r.name === 'biome vcs.useIgnoreFile');
  check(vcsResult && vcsResult.status === 'pass', 'vcs.useIgnoreFile passes when enabled');
  cleanup(dir);
}

console.log('\n11. Biome validator — missing vcs.useIgnoreFile');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'biome.json'), JSON.stringify({
    linter: { enabled: true },
  }));
  const results = validateBiome(dir);
  const vcsResult = results.find(r => r.name === 'biome vcs.useIgnoreFile');
  check(vcsResult && vcsResult.status === 'warn', 'warns when vcs.useIgnoreFile not enabled');
  check(vcsResult && vcsResult.fix, 'provides a fix suggestion');
  cleanup(dir);
}

console.log('\n12. Biome validator — nested biome.json in worktree dir');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'biome.json'), JSON.stringify({
    vcs: { clientKind: 'git', useIgnoreFile: true },
  }));
  // Create a nested worktree-like structure
  const nestedDir = join(dir, '.claude', 'worktrees', 'agent-abc123');
  mkdirSync(nestedDir, { recursive: true });
  writeFileSync(join(nestedDir, 'biome.json'), '{}');
  const results = validateBiome(dir);
  const nestedResult = results.find(r => r.name === 'nested biome.json');
  check(nestedResult && nestedResult.status === 'fail', 'fails when nested biome.json in worktree dir');
  check(nestedResult && nestedResult.errors[0].includes('unexpected'), 'error mentions unexpected dirs');
  cleanup(dir);
}

// --- CI Workflows validator tests ---
console.log('\n13. CI Workflows validator — no .github/workflows/');
{
  const dir = createTempDir();
  const results = validateCiWorkflows(dir);
  check(results.length === 1, `returns 1 result (got ${results.length})`);
  check(results[0].status === 'skip', 'returns skip when no workflows dir');
  cleanup(dir);
}

console.log('\n14. CI Workflows validator — valid workflow file');
{
  const dir = createTempDir();
  const wfDir = join(dir, '.github', 'workflows');
  mkdirSync(wfDir, { recursive: true });
  writeFileSync(join(wfDir, 'ci.yml'), `
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo test --workspace
`);
  const results = validateCiWorkflows(dir);
  const filesResult = results.find(r => r.name === 'workflow files');
  check(filesResult && filesResult.status === 'pass', 'finds workflow files');
  check(filesResult && filesResult.errors[0].includes('1 workflow'), 'reports 1 workflow found');
  cleanup(dir);
}

console.log('\n15. CI Workflows validator — hardcoded secrets');
{
  const dir = createTempDir();
  const wfDir = join(dir, '.github', 'workflows');
  mkdirSync(wfDir, { recursive: true });
  writeFileSync(join(wfDir, 'deploy.yml'), `
name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      OPENAI_API_KEY: "sk-test1234567890"
    steps:
      - run: echo "deploying"
`);
  const results = validateCiWorkflows(dir);
  const secretsResult = results.find(r => r.name?.includes('hardcoded-secrets'));
  check(secretsResult && secretsResult.status === 'fail', 'fails on hardcoded secrets');
  check(secretsResult && secretsResult.errors[0].includes('Hardcoded API keys'), 'error mentions hardcoded keys');
  cleanup(dir);
}

console.log('\n16. CI Workflows validator — deprecated action versions');
{
  const dir = createTempDir();
  const wfDir = join(dir, '.github', 'workflows');
  mkdirSync(wfDir, { recursive: true });
  writeFileSync(join(wfDir, 'old.yml'), `
name: Old
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
`);
  const results = validateCiWorkflows(dir);
  const oldResult = results.find(r => r.name?.includes('old-actions'));
  check(oldResult && oldResult.status === 'warn', 'warns on deprecated action versions');
  check(oldResult && oldResult.errors[0].includes('deprecated'), 'error mentions deprecated');
  cleanup(dir);
}

// --- Worktrees validator tests ---
console.log('\n17. Worktrees validator — no worktrees');
{
  const dir = createTempDir();
  const results = validateWorktrees(dir);
  const staleResult = results.find(r => r.name === 'stale worktrees');
  check(staleResult && staleResult.status === 'pass', 'passes when no .claude/worktrees/');
  cleanup(dir);
}

console.log('\n18. Worktrees validator — stale worktrees present');
{
  const dir = createTempDir();
  const wtDir = join(dir, '.claude', 'worktrees', 'agent-abc123');
  mkdirSync(wtDir, { recursive: true });
  writeFileSync(join(wtDir, 'dummy.txt'), 'stale');
  const results = validateWorktrees(dir);
  const staleResult = results.find(r => r.name === 'stale worktrees');
  check(staleResult && staleResult.status === 'fail', 'fails when stale worktrees found');
  check(staleResult && staleResult.errors[0].includes('1 stale'), 'error mentions count');
  check(staleResult && staleResult.fix.includes('git worktree prune'), 'fix mentions git worktree prune');
  cleanup(dir);
}

console.log('\n19. Worktrees validator — empty .claude/worktrees/');
{
  const dir = createTempDir();
  mkdirSync(join(dir, '.claude', 'worktrees'), { recursive: true });
  const results = validateWorktrees(dir);
  const staleResult = results.find(r => r.name === 'stale worktrees');
  check(staleResult && staleResult.status === 'pass', 'passes when .claude/worktrees/ exists but is empty');
  cleanup(dir);
}

// --- Docker validator tests ---
console.log('\n20. Docker validator — no Docker files');
{
  const dir = createTempDir();
  const results = validateDocker(dir);
  check(results.length === 1, `returns 1 result (got ${results.length})`);
  check(results[0].status === 'skip', 'returns skip when no Docker files found');
  cleanup(dir);
}

console.log('\n21. Docker validator — Dockerfile with :latest tag');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'Dockerfile'), `
FROM node:latest
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
`);
  const results = validateDocker(dir);
  const latestResult = results.find(r => r.name?.includes('latest-tag'));
  check(latestResult && latestResult.status === 'warn', 'warns on :latest tag');
  cleanup(dir);
}

console.log('\n22. Docker validator — Dockerfile with hardcoded secrets');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'Dockerfile'), `
FROM node:22-slim
ENV API_KEY=sk-mysecretkey123
WORKDIR /app
CMD ["node", "index.js"]
`);
  const results = validateDocker(dir);
  const secretsResult = results.find(r => r.name?.includes('env-secrets'));
  check(secretsResult && secretsResult.status === 'fail', 'fails on hardcoded ENV secrets');
  check(secretsResult && secretsResult.errors[0].includes('Secrets hardcoded'), 'error mentions hardcoded secrets');
  cleanup(dir);
}

console.log('\n23. Docker validator — Dockerfile without HEALTHCHECK');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'Dockerfile'), `
FROM node:22-slim
WORKDIR /app
COPY . .
CMD ["node", "index.js"]
`);
  const results = validateDocker(dir);
  const healthResult = results.find(r => r.name?.includes('healthcheck'));
  check(healthResult && healthResult.status === 'warn', 'warns on missing HEALTHCHECK');
  cleanup(dir);
}

console.log('\n24. Docker validator — Dockerfile without USER');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'Dockerfile'), `
FROM node:22-slim
WORKDIR /app
CMD ["node", "index.js"]
`);
  const results = validateDocker(dir);
  const userResult = results.find(r => r.name?.includes('non-root'));
  check(userResult && userResult.status === 'warn', 'warns on missing USER instruction');
  cleanup(dir);
}

// --- Vercel validator tests ---
console.log('\n25. Vercel validator — stale .js shadowing .tsx');
{
  const dir = createTempDir();
  const appDir = join(dir, 'apps', 'TestApp');
  const srcDir = join(appDir, 'src');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(appDir, 'vercel.json'), '{}');
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { build: 'vite build' } }));
  writeFileSync(join(srcDir, 'App.tsx'), 'export default function App() {}');
  writeFileSync(join(srcDir, 'App.js'), 'module.exports = function App() {}');
  const results = validateVercel(dir);
  const staleResult = results.find(r => r.name?.includes('stale-js'));
  check(staleResult && staleResult.status === 'fail', 'fails when stale .js shadows .tsx');
  cleanup(dir);
}

console.log('\n26. Node validator — bun in scripts');
{
  const dir = createTempDir();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'test',
    packageManager: 'pnpm@10.5.0',
    scripts: { prepare: 'bun run build', test: 'node test.js' },
  }));
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), '');
  const results = validateNode(dir);
  const bunResult = results.find(r => r.name === 'bun in scripts');
  check(bunResult && bunResult.status === 'fail', 'fails when bun used in scripts');
  check(bunResult && bunResult.errors[0].includes('bun'), 'error mentions bun');
  cleanup(dir);
}

console.log(`\n=== Validator Tests: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exitCode = 1;
