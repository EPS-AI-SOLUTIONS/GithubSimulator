/**
 * GitHub Actions workflow validator — catches common CI configuration
 * mistakes before they cause pipeline failures.
 *
 * Common failure patterns:
 * - Hardcoded API keys/secrets in workflow files
 * - Missing native dependency installation (libasound2-dev, libssl-dev)
 * - pnpm cache enabled without lockfile reference
 * - cargo commands without workspace scope
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export function validateCiWorkflows(workspacePath) {
  const results = [];
  const workflowDir = join(workspacePath, '.github', 'workflows');

  if (!existsSync(workflowDir)) {
    results.push({ name: 'workflows dir', status: 'skip', errors: ['No .github/workflows/ found'] });
    return results;
  }

  let files;
  try {
    files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    results.push({ name: 'workflows dir', status: 'fail', errors: ['Cannot read .github/workflows/'] });
    return results;
  }

  results.push({ name: 'workflow files', status: 'pass', errors: [`${files.length} workflow(s) found`] });

  for (const file of files) {
    const content = readFileSync(join(workflowDir, file), 'utf-8');
    const prefix = `ci/${file}`;

    // 1. Check for hardcoded secrets (not using ${{ secrets.* }})
    const hardcodedKeys = content.match(
      /(?:OPENAI_API_KEY|XAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN)\s*[:=]\s*["'][^$]/g
    );
    if (hardcodedKeys) {
      results.push({
        name: `${prefix}/hardcoded-secrets`,
        status: 'fail',
        errors: ['Hardcoded API keys in workflow — use ${{ secrets.* }}'],
        fix: 'Replace hardcoded values with ${{ secrets.KEY_NAME }}',
      });
    }

    // 2. Check for pnpm cache without lock file reference
    if (content.includes('cache: pnpm') && !content.includes('pnpm-lock')) {
      results.push({
        name: `${prefix}/pnpm-cache`,
        status: 'warn',
        errors: ['pnpm cache enabled but pnpm-lock.yaml not referenced — cache may miss'],
        fix: 'Add pnpm-lock.yaml to the cache key or restore-keys',
      });
    }

    // 3. Check for cargo commands without --workspace or -p flag
    const cargoLines = content.match(/cargo\s+(check|test|clippy|build)(?!\s+--workspace|\s+-p\s)/g);
    if (cargoLines && !content.includes('--workspace') && !content.includes('-p ')) {
      results.push({
        name: `${prefix}/cargo-scope`,
        status: 'warn',
        errors: ['cargo commands without --workspace or -p flag may miss workspace members'],
        fix: 'Add --workspace to cargo check/test/clippy/build commands',
      });
    }

    // 4. Check for missing native deps for Rust builds
    if (content.includes('cargo') && !content.includes('apt-get') && !content.includes('brew install')) {
      const needsNative = checkNativeDeps(workspacePath);
      if (needsNative.length > 0) {
        results.push({
          name: `${prefix}/native-deps`,
          status: 'warn',
          errors: [
            `Cargo.lock has native deps (${needsNative.join(', ')}) but workflow has no apt-get install step`,
          ],
          fix: 'Add: sudo apt-get install -y libasound2-dev libssl-dev pkg-config',
        });
      }
    }

    // 5. Check for deprecated actions versions
    const oldActions = content.match(/uses:\s+actions\/(checkout|setup-node|cache)@v[12]\b/g);
    if (oldActions) {
      results.push({
        name: `${prefix}/old-actions`,
        status: 'warn',
        errors: [`${oldActions.length} deprecated action version(s): ${oldActions.slice(0, 3).join(', ')}`],
        fix: 'Update to actions/checkout@v4, actions/setup-node@v4, actions/cache@v4',
      });
    }
  }

  return results;
}

/**
 * Check Cargo.lock for crates that require native system libraries.
 */
function checkNativeDeps(workspacePath) {
  const nativeCrates = ['rodio', 'alsa-sys', 'openssl-sys', 'libz-sys', 'bzip2-sys'];
  const found = [];

  try {
    const cargoLock = readFileSync(join(workspacePath, 'Cargo.lock'), 'utf-8');
    for (const dep of nativeCrates) {
      if (cargoLock.includes(`name = "${dep}"`)) {
        found.push(dep);
      }
    }
  } catch {
    /* no Cargo.lock */
  }

  return found;
}
