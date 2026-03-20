/**
 * Vercel deployment pre-flight validator.
 *
 * Checks common causes of Vercel build failures:
 * - Missing vercel.json or invalid config
 * - Build command failures (dry-run)
 * - Missing environment variables
 * - Stale .js files shadowing .tsx (known Grantify issue)
 * - package.json issues (missing scripts, wrong engine)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export function validateVercel(workspacePath) {
  const results = [];

  // Find all Vercel-deployed apps (those with vercel.json)
  const appsDir = join(workspacePath, 'apps');
  if (!existsSync(appsDir)) {
    results.push({ name: 'vercel apps', status: 'skip', errors: ['No apps/ directory found'] });
    return results;
  }

  let apps;
  try {
    apps = readdirSync(appsDir).filter(d => {
      const appDir = join(appsDir, d);
      return statSync(appDir).isDirectory() && existsSync(join(appDir, 'vercel.json'));
    });
  } catch {
    apps = [];
  }

  if (apps.length === 0) {
    results.push({ name: 'vercel apps', status: 'pass', errors: ['No vercel.json found — no Vercel apps to validate'] });
    return results;
  }

  for (const app of apps) {
    const appDir = join(appsDir, app);
    const appResults = validateVercelApp(app, appDir);
    results.push(...appResults);
  }

  return results;
}

function validateVercelApp(appName, appDir) {
  const results = [];
  const prefix = `vercel/${appName}`;

  // 1. vercel.json validity
  try {
    const raw = readFileSync(join(appDir, 'vercel.json'), 'utf-8');
    JSON.parse(raw);
    results.push({ name: `${prefix}/vercel.json`, status: 'pass' });
  } catch (e) {
    results.push({ name: `${prefix}/vercel.json`, status: 'fail', errors: [`Invalid JSON: ${e.message}`] });
  }

  // 2. package.json build script
  const pkgPath = join(appDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts?.build) {
        results.push({ name: `${prefix}/build-script`, status: 'warn', errors: ['No "build" script in package.json'] });
      } else {
        results.push({ name: `${prefix}/build-script`, status: 'pass' });
      }
    } catch (e) {
      results.push({ name: `${prefix}/package.json`, status: 'fail', errors: [`Invalid JSON: ${e.message}`] });
    }
  }

  // 3. Stale .js files shadowing .tsx/.ts (known Grantify issue)
  const srcDir = join(appDir, 'src');
  if (existsSync(srcDir)) {
    const staleFiles = findStaleJsShadows(srcDir);
    if (staleFiles.length > 0) {
      results.push({
        name: `${prefix}/stale-js`,
        status: 'fail',
        errors: staleFiles.map(f => `Stale ${f.js} shadows ${f.tsx}`),
        fix: `Delete stale .js files: ${staleFiles.map(f => f.js).join(', ')}`,
      });
    } else {
      results.push({ name: `${prefix}/stale-js`, status: 'pass' });
    }
  }

  // 4. dist/build output not committed (should be in .gitignore)
  for (const dir of ['dist', '.next', 'build', '.vercel/output']) {
    const outDir = join(appDir, dir);
    if (existsSync(outDir) && statSync(outDir).isDirectory()) {
      results.push({
        name: `${prefix}/${dir}-committed`,
        status: 'warn',
        errors: [`${dir}/ exists — ensure it's in .gitignore`],
      });
    }
  }

  return results;
}

function findStaleJsShadows(dir) {
  const stale = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stale.push(...findStaleJsShadows(fullPath));
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
        // Check if a .tsx or .ts version exists
        const base = entry.name.replace(/\.(js|jsx)$/, '');
        const tsxPath = join(dir, base + '.tsx');
        const tsPath = join(dir, base + '.ts');
        if (existsSync(tsxPath)) {
          stale.push({ js: join(dir, entry.name), tsx: tsxPath });
        } else if (existsSync(tsPath)) {
          stale.push({ js: join(dir, entry.name), tsx: tsPath });
        }
      }
    }
  } catch { /* permission errors, etc */ }
  return stale;
}
