/**
 * Stale worktree detector — catches leftover git worktrees that cause
 * biome "nested root" errors and waste disk space.
 *
 * Common failure patterns:
 * - .claude/worktrees/ accumulates stale agent worktrees
 * - git worktree list shows orphaned worktrees
 * - Nested biome.json/Cargo.toml in worktrees confuse tooling
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export function validateWorktrees(workspacePath) {
  const results = [];

  // 1. Check for stale .claude/worktrees/
  const worktreeDir = join(workspacePath, '.claude', 'worktrees');
  if (existsSync(worktreeDir)) {
    try {
      const dirs = readdirSync(worktreeDir).filter((d) => {
        try {
          return statSync(join(worktreeDir, d)).isDirectory();
        } catch {
          return false;
        }
      });
      if (dirs.length > 0) {
        results.push({
          name: 'stale worktrees',
          status: 'fail',
          errors: [
            `${dirs.length} stale worktree(s) found in .claude/worktrees/ — these cause biome "nested root" errors and waste disk`,
          ],
          fix: 'rm -rf .claude/worktrees/ && git worktree prune',
        });
      } else {
        results.push({ name: 'stale worktrees', status: 'pass' });
      }
    } catch {
      results.push({ name: 'stale worktrees', status: 'pass' });
    }
  } else {
    results.push({ name: 'stale worktrees', status: 'pass' });
  }

  // 2. Check git worktree list for orphans
  try {
    const output = execSync('git worktree list --porcelain 2>/dev/null', {
      cwd: workspacePath,
      timeout: 5000,
    }).toString();
    const worktrees = output.split('\n').filter((l) => l.startsWith('worktree ')).length;
    if (worktrees > 1) {
      results.push({
        name: 'git worktrees',
        status: 'warn',
        errors: [`${worktrees} git worktrees active (expected 1 = main). Run: git worktree prune`],
      });
    } else {
      results.push({ name: 'git worktrees', status: 'pass' });
    }
  } catch {
    results.push({ name: 'git worktrees', status: 'pass' });
  }

  return results;
}
