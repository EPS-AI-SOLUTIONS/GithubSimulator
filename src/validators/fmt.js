/**
 * Rust formatting validator — catches `cargo fmt --all --check` failures
 * before they reach CI.
 *
 * This is one of the most common CI failures: code compiles and passes
 * tests locally, but formatting diffs cause CI to reject the commit.
 */

import { execSync } from 'child_process';

export function validateFmt(workspacePath) {
  const results = [];

  try {
    execSync('cargo fmt --all --check 2>&1', {
      cwd: workspacePath,
      timeout: 120_000,
    });
    results.push({ name: 'cargo fmt', status: 'pass' });
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const diffFiles = [...output.matchAll(/Diff in .+?([^\s/\\]+\.rs)/g)].map(m => m[1]);
    const unique = [...new Set(diffFiles)];
    results.push({
      name: 'cargo fmt',
      status: 'fail',
      errors: unique.length > 0
        ? [`${unique.length} file(s) not formatted: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? '...' : ''}`]
        : ['Code not formatted — run: cargo fmt --all'],
      fix: 'cargo fmt --all',
    });
  }

  return results;
}
