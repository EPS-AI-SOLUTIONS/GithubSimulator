import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function validateNode(workspacePath) {
  const results = [];
  const pkgPath = join(workspacePath, 'package.json');

  // 1. package.json packageManager field
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (!pkg.packageManager) {
      results.push({ name: 'packageManager field', status: 'fail', errors: ['Missing packageManager in root package.json'] });
    } else if (!pkg.packageManager.startsWith('pnpm@')) {
      results.push({ name: 'packageManager field', status: 'warn', errors: [`packageManager is "${pkg.packageManager}" — CI expects pnpm`] });
    } else {
      results.push({ name: 'packageManager field', status: 'pass' });
    }
  }

  // 2. pnpm-lock.yaml exists
  if (existsSync(join(workspacePath, 'pnpm-lock.yaml'))) {
    results.push({ name: 'pnpm-lock.yaml', status: 'pass' });
  } else {
    results.push({ name: 'pnpm-lock.yaml', status: 'fail', errors: ['Missing pnpm-lock.yaml — CI cache requires it. Run: pnpm install --lockfile-only'] });
  }

  // 3. pnpm-workspace.yaml exists (for pnpm workspaces)
  if (existsSync(join(workspacePath, 'pnpm-workspace.yaml'))) {
    results.push({ name: 'pnpm-workspace.yaml', status: 'pass' });
  } else {
    results.push({ name: 'pnpm-workspace.yaml', status: 'warn', errors: ['Missing pnpm-workspace.yaml — pnpm may warn about "workspaces" field'] });
  }

  // 4. Check for "bun" in scripts (CI has no bun — use "node" or "npx")
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};
    const bunScripts = Object.entries(scripts)
      .filter(([, cmd]) => /\bbun\b/.test(cmd))
      .map(([name, cmd]) => `"${name}": "${cmd}"`);
    if (bunScripts.length > 0) {
      results.push({
        name: 'bun in scripts',
        status: 'fail',
        errors: [`${bunScripts.length} script(s) use "bun" which is not available on CI: ${bunScripts.slice(0, 3).join(', ')}${bunScripts.length > 3 ? '...' : ''}`],
        fix: 'Replace "bun" with "node" or "npx" in package.json scripts (especially "prepare")',
      });
    } else {
      results.push({ name: 'bun in scripts', status: 'pass' });
    }
  }

  return results;
}
