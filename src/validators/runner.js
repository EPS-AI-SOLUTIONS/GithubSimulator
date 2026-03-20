import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { validateRust } from './rust.js';
import { validateFmt } from './fmt.js';
import { validateNode } from './node.js';
import { validateLicenses } from './licenses.js';
import { validateSecrets } from './secrets.js';
import { validateVercel } from './vercel.js';
import { validateBiome } from './biome.js';
import { validateCiWorkflows } from './ci-workflows.js';
import { validateWorktrees } from './worktrees.js';
import { validateDocker } from './docker.js';

export async function runAllValidators(workspacePath, options = {}) {
  const startTime = Date.now();
  console.log(chalk.bold.yellow('\n[GitHub CI Validator] Pre-push validation starting...\n'));

  const allResults = [];
  const timings = [];

  const validators = [
    { name: 'Node.js / pnpm', fn: () => validateNode(workspacePath), skip: options.skipNode },
    { name: 'Secrets Scan', fn: () => validateSecrets(workspacePath), skip: options.skipSecrets },
    { name: 'Biome Lint/Format', fn: () => validateBiome(workspacePath), skip: options.skipBiome },
    { name: 'CI Workflows', fn: () => validateCiWorkflows(workspacePath), skip: options.skipCi },
    { name: 'Worktrees', fn: () => validateWorktrees(workspacePath), skip: options.skipWorktrees },
    { name: 'Docker', fn: () => validateDocker(workspacePath), skip: options.skipDocker },
    { name: 'Rust Formatting', fn: () => validateFmt(workspacePath), skip: options.skipRust },
    { name: 'Rust Workspace', fn: () => validateRust(workspacePath), skip: options.skipRust },
    { name: 'License Compliance', fn: () => validateLicenses(workspacePath), skip: options.skipLicenses },
    { name: 'Vercel Deployments', fn: () => validateVercel(workspacePath), skip: options.skipVercel },
  ];

  for (const v of validators) {
    if (v.skip) {
      console.log(chalk.dim(`  ⊘ ${v.name} (skipped)`));
      timings.push({ name: v.name, ms: 0, skipped: true, status: 'skip' });
      continue;
    }
    console.log(chalk.cyan(`  ▶ ${v.name}...`));
    const vStart = Date.now();
    try {
      const results = v.fn();
      const vElapsed = Date.now() - vStart;

      // Determine validator-level status from its results
      const hasFail = results.some((r) => r.status === 'fail');
      const hasWarn = results.some((r) => r.status === 'warn');
      const vStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

      timings.push({ name: v.name, ms: vElapsed, skipped: false, status: vStatus });
      allResults.push(...results);
      for (const r of results) {
        const icon =
          r.status === 'pass'
            ? chalk.green('✓')
            : r.status === 'warn'
              ? chalk.yellow('⚠')
              : r.status === 'skip'
                ? chalk.dim('⊘')
                : chalk.red('✗');
        const timeStr = chalk.dim(` (${vElapsed}ms)`);
        console.log(`    ${icon} ${r.name}${r.errors ? ': ' + r.errors[0] : ''}${timeStr}`);
        if (r.fix) console.log(chalk.dim(`      Fix: ${r.fix}`));
      }
    } catch (e) {
      const vElapsed = Date.now() - vStart;
      timings.push({ name: v.name, ms: vElapsed, skipped: false, status: 'fail' });
      console.log(chalk.red(`    ✗ ${v.name} crashed: ${e.message}`));
      allResults.push({ name: v.name, status: 'fail', errors: [e.message] });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = allResults.filter((r) => r.status === 'pass').length;
  const failed = allResults.filter((r) => r.status === 'fail').length;
  const warned = allResults.filter((r) => r.status === 'warn').length;
  const skipped = allResults.filter((r) => r.status === 'skip').length;

  // Summary ASCII table
  console.log(chalk.bold('\n  ┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.bold('  │               CI Validation Summary                  │'));
  console.log(chalk.bold('  ├────────────────────────┬──────────┬─────────────────┤'));
  console.log(chalk.bold('  │ Validator              │ Status   │ Time            │'));
  console.log(chalk.bold('  ├────────────────────────┼──────────┼─────────────────┤'));

  for (const t of timings) {
    const name = t.name.padEnd(22);
    let status;
    if (t.status === 'skip' || t.skipped) {
      status = chalk.dim('SKIP'.padEnd(8));
    } else if (t.status === 'fail') {
      status = chalk.red('FAIL'.padEnd(8));
    } else if (t.status === 'warn') {
      status = chalk.yellow('WARN'.padEnd(8));
    } else {
      status = chalk.green('PASS'.padEnd(8));
    }
    const time = t.skipped ? chalk.dim('—'.padEnd(15)) : `${t.ms}ms`.padEnd(15);
    console.log(`  │ ${name} │ ${status} │ ${time} │`);
  }

  console.log(chalk.bold('  └────────────────────────┴──────────┴─────────────────┘'));
  console.log(
    chalk.bold(
      `\n  Results: ${chalk.green(passed + ' passed')}, ${chalk.red(failed + ' failed')}, ${chalk.yellow(warned + ' warnings')}, ${chalk.dim(skipped + ' skipped')} (${elapsed}s)\n`
    )
  );

  const result = { passed, failed, warned, skipped, results: allResults, timings, ok: failed === 0 };

  // --json output: write results to file
  if (options.json) {
    const jsonPath = typeof options.json === 'string' ? options.json : join(workspacePath, 'ci-validation-results.json');
    try {
      writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      console.log(chalk.dim(`  JSON results written to: ${jsonPath}\n`));
    } catch (e) {
      console.log(chalk.red(`  Failed to write JSON results: ${e.message}\n`));
    }
  }

  return result;
}
