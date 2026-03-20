import { execSync } from 'child_process';

export function validateLicenses(workspacePath) {
  const results = [];

  try {
    execSync('cargo deny check licenses 2>&1', { cwd: workspacePath, timeout: 120000 });
    results.push({ name: 'cargo deny licenses', status: 'pass' });
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    const unlicensed = [...output.matchAll(/error\[unlicensed\]: (.+?) is unlicensed/g)].map(m => m[1]);
    const denied = [...output.matchAll(/error\[license-not-allowed\]: (.+)/g)].map(m => m[1]);
    results.push({
      name: 'cargo deny licenses',
      status: 'fail',
      errors: [...unlicensed.map(c => `Unlicensed: ${c}`), ...denied],
      fix: 'Add license = "MIT" and publish = false to Cargo.toml, or update deny.toml allow list',
    });
  }

  return results;
}
