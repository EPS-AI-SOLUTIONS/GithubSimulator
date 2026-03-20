import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, findAvailablePort } from './utils.js';
import { createServer } from './server.js';
import { seedData } from './seed.js';
import { store } from './store.js';
import { resetRateLimits } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function run() {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  program
    .name('github-simulator')
    .description('Local GitHub API simulator for Jaskier Workspace')
    .version(pkg.version);

  // --- start command ---
  program
    .command('start')
    .description('Start the GitHub API simulator server')
    .option('-p, --port <number>', 'Port to run on', '8200')
    .option('--no-seed', 'Start without pre-seeded data')
    .action(async (options) => {
      // Seed data
      if (options.seed !== false) {
        seedData();
      }

      // Find available port
      let port = parseInt(options.port, 10);
      if (process.env.PORT) port = parseInt(process.env.PORT, 10);
      port = await findAvailablePort(port);

      // Create and start server
      const app = createServer();

      const server = app.listen(port, () => {
        console.log();
        logger.success(`GitHub Simulator running at http://localhost:${port}`);
        logger.info(`API Base URL: http://localhost:${port}`);
        logger.info(`Auth Token: ghp_jaskier_simulator_token`);
        logger.info(`Seeded: ${store.repos.size} repos, ${store.getIssues('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length} issues, ${store.getPulls('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length} PRs`);
        console.log();
        logger.info('Example:');
        logger.info(`  curl -H "Authorization: Bearer ghp_jaskier_simulator_token" http://localhost:${port}/repos/EPS-AI-SOLUTIONS/JaskierWorkspace`);
        console.log();
      });

      // Graceful shutdown
      const shutdown = () => {
        logger.info('Shutting down gracefully...');
        server.close(() => {
          logger.info('Closed out remaining connections.');
          process.exit(0);
        });
        setTimeout(() => {
          logger.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 5000);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    });

  // --- seed command ---
  program
    .command('seed')
    .description('Display the pre-seeded data summary')
    .action(() => {
      seedData();
      console.log();
      logger.info('Repos:');
      for (const [key, repo] of store.repos) {
        logger.info(`  ${key} (${repo.language || 'unknown'}, ${repo.stargazers_count || 0} stars)`);
      }
      console.log();
      logger.info(`Issues (EPS-AI-SOLUTIONS/JaskierWorkspace): ${store.getIssues('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length}`);
      logger.info(`PRs (EPS-AI-SOLUTIONS/JaskierWorkspace): ${store.getPulls('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length}`);
      logger.info(`Commits (EPS-AI-SOLUTIONS/JaskierWorkspace): ${store.getCommits('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length}`);
      logger.info(`Workflow Runs (EPS-AI-SOLUTIONS/JaskierWorkspace): ${store.getWorkflowRuns('EPS-AI-SOLUTIONS', 'JaskierWorkspace').length}`);
      console.log();
      logger.success('Seed data loaded. Run "node index.js start" to start the server.');
    });

  // --- validate command ---
  program
    .command('validate [workspace]')
    .description('Run CI validators against a workspace (default: auto-detect)')
    .option('--skip-rust', 'Skip Rust checks')
    .option('--skip-node', 'Skip Node.js checks')
    .option('--skip-licenses', 'Skip license checks')
    .option('--skip-secrets', 'Skip secrets scan')
    .action(async (workspace, opts) => {
      const workspacePath = workspace || process.cwd();
      const { runAllValidators } = await import('./validators/runner.js');
      const result = await runAllValidators(workspacePath, {
        skipRust: opts.skipRust,
        skipNode: opts.skipNode,
        skipLicenses: opts.skipLicenses,
        skipSecrets: opts.skipSecrets,
      });
      process.exit(result.ok ? 0 : 1);
    });

  // --- reset command ---
  program
    .command('reset')
    .description('Reset all in-memory data and re-seed')
    .action(() => {
      store.reset();
      resetRateLimits();
      seedData();
      logger.success('All data has been reset and re-seeded.');
    });

  // Default to start if no command specified
  if (process.argv.length <= 2) {
    process.argv.push('start');
  }

  program.parse(process.argv);
}
