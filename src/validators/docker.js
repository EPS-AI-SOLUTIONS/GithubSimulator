/**
 * Dockerfile and docker-compose validator — catches common container
 * configuration mistakes before they cause build/deploy failures.
 *
 * Common failure patterns:
 * - :latest tag usage => non-reproducible builds
 * - COPY . . without .dockerignore => bloated images
 * - Hardcoded secrets in ENV instructions
 * - Missing multi-stage build optimization
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function validateDocker(workspacePath) {
  const results = [];

  // Locations to check for Docker files
  const locations = [
    'docker/Dockerfile.backend',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.monitoring.yml',
  ];

  let filesChecked = 0;

  for (const loc of locations) {
    const filePath = join(workspacePath, loc);
    if (!existsSync(filePath)) continue;

    filesChecked++;
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      results.push({ name: `docker/${loc}`, status: 'fail', errors: [`Cannot read ${loc}`] });
      continue;
    }

    const prefix = `docker/${loc}`;

    // 1. Check for :latest tag usage in FROM instructions
    if (content.match(/FROM\s+\S+:latest/)) {
      results.push({
        name: `${prefix}/latest-tag`,
        status: 'warn',
        errors: ['Using :latest tag — pin to specific version for reproducible builds'],
        fix: 'Replace :latest with a specific version tag (e.g., :3.21, :22-slim)',
      });
    }

    // 2. Check for COPY . . without .dockerignore
    if (content.includes('COPY . .') && !existsSync(join(workspacePath, '.dockerignore'))) {
      results.push({
        name: `${prefix}/dockerignore`,
        status: 'warn',
        errors: ['COPY . . without .dockerignore — may include node_modules, target/, .git/'],
        fix: 'Create a .dockerignore file with node_modules, target, .git, dist',
      });
    }

    // 3. Check for exposed secrets in ENV
    if (content.match(/ENV\s+(API_KEY|SECRET|PASSWORD|TOKEN)\s*=/i)) {
      results.push({
        name: `${prefix}/env-secrets`,
        status: 'fail',
        errors: ['Secrets hardcoded in Dockerfile ENV — use build args or runtime secrets'],
        fix: 'Use ARG for build-time secrets or mount secrets at runtime',
      });
    }

    // 4. Check for missing HEALTHCHECK in Dockerfiles
    if (loc.includes('Dockerfile') && !content.includes('HEALTHCHECK')) {
      results.push({
        name: `${prefix}/healthcheck`,
        status: 'warn',
        errors: ['No HEALTHCHECK instruction — container orchestrators cannot detect unhealthy state'],
        fix: 'Add HEALTHCHECK CMD curl -f http://localhost:PORT/health || exit 1',
      });
    }

    // 5. Check for running as root (no USER instruction)
    if (loc.includes('Dockerfile') && !content.includes('USER ')) {
      results.push({
        name: `${prefix}/non-root`,
        status: 'warn',
        errors: ['No USER instruction — container runs as root by default'],
        fix: 'Add USER nonroot or USER 1000 before CMD/ENTRYPOINT',
      });
    }
  }

  if (filesChecked === 0) {
    results.push({ name: 'docker', status: 'skip', errors: ['No Docker files found'] });
  } else if (results.length === 0) {
    results.push({ name: 'docker', status: 'pass', errors: ['No Docker issues found'] });
  }

  return results;
}
