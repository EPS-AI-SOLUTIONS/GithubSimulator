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

  return results;
}
