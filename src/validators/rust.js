import { execSync } from 'child_process';

export function validateRust(workspacePath) {
  const results = [];

  // 1. cargo check
  try {
    execSync('cargo check --workspace 2>&1', { cwd: workspacePath, timeout: 300000 });
    results.push({ name: 'cargo check', status: 'pass' });
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || '';
    // Parse common errors
    const errors = [];
    if (output.includes('alsa-sys')) errors.push('Missing libasound2-dev (Linux audio headers)');
    if (output.includes('cannot explicitly dereference')) errors.push('Rust 2024 edition pattern dereference error');
    if (output.includes('E0063')) errors.push('Missing struct field in initializer');
    if (output.includes('E0277')) errors.push('Trait bound not satisfied');
    if (output.includes('E0004')) errors.push('Non-exhaustive match patterns');
    results.push({ name: 'cargo check', status: 'fail', errors, raw: output.slice(-500) });
  }

  // 2. cargo clippy
  try {
    execSync('cargo clippy --workspace --all-targets -- -W clippy::all 2>&1', { cwd: workspacePath, timeout: 300000 });
    results.push({ name: 'cargo clippy', status: 'pass' });
  } catch (e) {
    const output = e.stdout?.toString() || '';
    const warnings = (output.match(/warning\[/g) || []).length;
    results.push({ name: 'cargo clippy', status: 'warn', warnings, raw: output.slice(-500) });
  }

  // 3. cargo fmt check
  try {
    execSync('cargo fmt --all --check 2>&1', { cwd: workspacePath, timeout: 60000 });
    results.push({ name: 'cargo fmt', status: 'pass' });
  } catch (e) {
    results.push({ name: 'cargo fmt', status: 'fail', errors: ['Code not formatted — run cargo fmt'] });
  }

  // 4. Check Cargo.toml license fields
  try {
    const metadata = execSync('cargo metadata --no-deps --format-version 1 2>/dev/null', { cwd: workspacePath, timeout: 30000 });
    const parsed = JSON.parse(metadata.toString());
    const unlicensed = parsed.packages.filter(p => !p.license && !p.publish === false && p.source === null);
    if (unlicensed.length > 0) {
      results.push({
        name: 'license fields',
        status: 'fail',
        errors: unlicensed.map(p => `${p.name} missing license field in Cargo.toml`),
      });
    } else {
      results.push({ name: 'license fields', status: 'pass' });
    }
  } catch (e) {
    results.push({ name: 'license fields', status: 'skip', errors: ['cargo metadata failed'] });
  }

  return results;
}
