/**
 * Biome linting/formatting validator — catches biome check failures
 * before they reach CI.
 *
 * Common failure patterns:
 * - vcs.useIgnoreFile not enabled => biome scans gitignored dirs (90+ errors)
 * - Nested biome.json in worktrees => "nested root" errors
 * - Actual lint/format violations in source code
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export function validateBiome(workspacePath) {
  const results = [];

  // 1. Check biome.json exists and is valid
  const biomePath = join(workspacePath, 'biome.json');
  if (!existsSync(biomePath)) {
    results.push({ name: 'biome.json', status: 'skip', errors: ['No biome.json found'] });
    return results;
  }

  let config;
  try {
    config = JSON.parse(readFileSync(biomePath, 'utf-8'));
    results.push({ name: 'biome.json', status: 'pass' });
  } catch (e) {
    results.push({ name: 'biome.json', status: 'fail', errors: [`Invalid JSON: ${e.message}`] });
    return results;
  }

  // 2. Check VCS ignore is enabled (prevents scanning .gitignore'd dirs)
  if (!config.vcs?.useIgnoreFile) {
    results.push({
      name: 'biome vcs.useIgnoreFile',
      status: 'warn',
      errors: ['vcs.useIgnoreFile not enabled — biome may scan gitignored dirs'],
      fix: 'Add "vcs": { "clientKind": "git", "useIgnoreFile": true } to biome.json',
    });
  } else {
    results.push({ name: 'biome vcs.useIgnoreFile', status: 'pass' });
  }

  // 3. Check VCS clientKind is set (required alongside useIgnoreFile)
  if (config.vcs?.useIgnoreFile && !config.vcs?.clientKind) {
    results.push({
      name: 'biome vcs.clientKind',
      status: 'warn',
      errors: ['vcs.useIgnoreFile enabled but vcs.clientKind not set — biome cannot detect VCS type'],
      fix: 'Add "clientKind": "git" to the "vcs" section of biome.json',
    });
  }

  // 4. Check for nested biome.json in subdirs (causes "nested root" errors)
  try {
    const nestedFiles = findNestedBiomeConfigs(workspacePath);
    if (nestedFiles.length > 0) {
      // Check if any are in unexpected locations (worktrees, temp dirs)
      const unexpected = nestedFiles.filter(
        (f) => f.includes('.claude') || f.includes('worktree') || f.includes('temp')
      );
      if (unexpected.length > 0) {
        results.push({
          name: 'nested biome.json',
          status: 'fail',
          errors: [
            `Found ${unexpected.length} biome.json in unexpected dirs: ${unexpected.slice(0, 3).join(', ')}`,
          ],
          fix: 'Remove stale worktrees: rm -rf .claude/worktrees/ && git worktree prune',
        });
      } else {
        results.push({ name: 'nested biome.json', status: 'pass' });
      }
    } else {
      results.push({ name: 'nested biome.json', status: 'pass' });
    }
  } catch {
    results.push({ name: 'nested biome.json', status: 'pass' });
  }

  // 5. Run biome check (scoped to non-gitignored dirs)
  try {
    execSync('npx @biomejs/biome check packages/ --no-errors-on-unmatched 2>&1', {
      cwd: workspacePath,
      timeout: 60000,
    });
    results.push({ name: 'biome check', status: 'pass' });
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const errorCount = output.match(/Found (\d+) errors/)?.[1] || '?';
    results.push({
      name: 'biome check',
      status: 'fail',
      errors: [`${errorCount} biome errors found`],
      fix: 'npx @biomejs/biome check --write .',
    });
  }

  return results;
}

/**
 * Recursively find biome.json files in subdirectories,
 * excluding the root, node_modules, .git, and target dirs.
 */
function findNestedBiomeConfigs(rootPath, currentPath, depth = 0) {
  if (depth > 5) return []; // limit recursion depth
  const dir = currentPath || rootPath;
  const results = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip common large/irrelevant dirs
      if (['node_modules', '.git', 'target', 'dist', '.next', 'build'].includes(entry.name)) continue;

      const subDir = join(dir, entry.name);
      const biomePath = join(subDir, 'biome.json');
      if (existsSync(biomePath)) {
        // Return relative path from root
        results.push(subDir.replace(rootPath, '.'));
      }
      results.push(...findNestedBiomeConfigs(rootPath, subDir, depth + 1));
    }
  } catch {
    /* permission errors, etc */
  }
  return results;
}
