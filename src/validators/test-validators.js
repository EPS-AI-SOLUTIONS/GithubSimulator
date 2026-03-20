/**
 * Unit tests for CI validators using mock data.
 * Does not require actual cargo/pnpm/git to be installed.
 */

import { validateNode } from './node.js';
import { validateSecrets } from './secrets.js';
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
  check(results.length === 3, `returns 3 results (got ${results.length})`);
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

console.log(`\n=== Validator Tests: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exitCode = 1;
