import chalk from 'chalk';
import { validateRust } from './rust.js';
import { validateFmt } from './fmt.js';
import { validateNode } from './node.js';
import { validateLicenses } from './licenses.js';
import { validateSecrets } from './secrets.js';
import { validateVercel } from './vercel.js';

export async function runAllValidators(workspacePath, options = {}) {
  const startTime = Date.now();
  console.log(chalk.bold.yellow('\n[GitHub CI Validator] Pre-push validation starting...\n'));

  const allResults = [];

  const validators = [
    { name: 'Node.js / pnpm', fn: () => validateNode(workspacePath), skip: options.skipNode },
    { name: 'Secrets Scan', fn: () => validateSecrets(workspacePath), skip: options.skipSecrets },
    { name: 'Rust Formatting', fn: () => validateFmt(workspacePath), skip: options.skipRust },
    { name: 'Rust Workspace', fn: () => validateRust(workspacePath), skip: options.skipRust },
    { name: 'License Compliance', fn: () => validateLicenses(workspacePath), skip: options.skipLicenses },
    { name: 'Vercel Deployments', fn: () => validateVercel(workspacePath), skip: options.skipVercel },
  ];

  for (const v of validators) {
    if (v.skip) {
      console.log(chalk.dim(`  ⊘ ${v.name} (skipped)`));
      continue;
    }
    console.log(chalk.cyan(`  ▶ ${v.name}...`));
    try {
      const results = v.fn();
      allResults.push(...results);
      for (const r of results) {
        const icon = r.status === 'pass' ? chalk.green('✓') : r.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
        console.log(`    ${icon} ${r.name}${r.errors ? ': ' + r.errors[0] : ''}`);
        if (r.fix) console.log(chalk.dim(`      Fix: ${r.fix}`));
      }
    } catch (e) {
      console.log(chalk.red(`    ✗ ${v.name} crashed: ${e.message}`));
      allResults.push({ name: v.name, status: 'fail', errors: [e.message] });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const warned = allResults.filter(r => r.status === 'warn').length;

  console.log(chalk.bold(`\n  Results: ${passed} passed, ${failed} failed, ${warned} warnings (${elapsed}s)\n`));

  return { passed, failed, warned, results: allResults, ok: failed === 0 };
}
