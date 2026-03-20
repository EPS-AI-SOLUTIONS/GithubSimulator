import { execSync } from 'child_process';

const PATTERNS = [
  { pattern: 'AKIA[A-Z0-9]{16}', name: 'AWS Access Key' },
  { pattern: 'sk-[a-zA-Z0-9]{20,}', name: 'OpenAI/Stripe Secret Key' },
  { pattern: 'ghp_[a-zA-Z0-9]{36}', name: 'GitHub Personal Access Token' },
  { pattern: 'gho_[a-zA-Z0-9]{36}', name: 'GitHub OAuth Token' },
  { pattern: 'xai-[a-zA-Z0-9]{20,}', name: 'xAI API Key' },
  { pattern: 'password\\s*=\\s*"[^"]{8,}"', name: 'Hardcoded Password' },
];

export function validateSecrets(workspacePath) {
  const results = [];
  const found = [];

  for (const { pattern, name } of PATTERNS) {
    try {
      const output = execSync(
        `git diff --cached --diff-filter=ACM -S "${pattern}" -- "*.rs" "*.py" "*.js" "*.ts" "*.toml" "*.json" 2>/dev/null || true`,
        { cwd: workspacePath, timeout: 30000 },
      ).toString();
      if (output.trim()) {
        found.push({ name, pattern, files: output.split('\n').filter(l => l.startsWith('diff --git')).map(l => l.split(' b/')[1]) });
      }
    } catch { /* ignore */ }
  }

  if (found.length > 0) {
    results.push({
      name: 'secrets scan',
      status: 'fail',
      errors: found.map(f => `${f.name} found in: ${f.files.join(', ')}`),
    });
  } else {
    results.push({ name: 'secrets scan', status: 'pass' });
  }

  return results;
}
