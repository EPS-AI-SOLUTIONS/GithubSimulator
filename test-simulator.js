import { createServer } from './src/server.js';
import { seedData } from './src/seed.js';
import http from 'http';

const TOKEN = 'ghp_jaskier_simulator_token';

function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : null;

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

async function runTests() {
  console.log('=== GitHub Simulator Smoke Tests ===\n');

  // Seed data
  seedData();

  // Start server on random port
  const app = createServer();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  console.log(`Server running on port ${port}\n`);

  let passed = 0;
  let failed = 0;

  function check(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('1. Health check');
    const health = await request(port, '/health');
    check(health.status === 200, 'GET /health returns 200');
    check(health.body.simulator === 'github', 'simulator field is "github"');

    // 2. Get authenticated user
    console.log('\n2. Authenticated user');
    const user = await request(port, '/user');
    check(user.status === 200, 'GET /user returns 200');
    check(user.body.login === 'jaskier-dev', 'user login is jaskier-dev');
    check(user.body.company === 'EPS-AI-SOLUTIONS', 'user company is EPS-AI-SOLUTIONS');

    // 3. Get repository
    console.log('\n3. Repository info');
    const repo = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace');
    check(repo.status === 200, 'GET /repos/EPS-AI-SOLUTIONS/JaskierWorkspace returns 200');
    check(repo.body.language === 'Rust', 'repo language is Rust');
    check(repo.body.default_branch === 'master', 'default branch is master');
    check(repo.body.stargazers_count === 47, 'stars count is 47');

    // 4. List issues
    console.log('\n4. Issues');
    const issues = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/issues');
    check(issues.status === 200, 'GET issues returns 200');
    check(Array.isArray(issues.body), 'issues body is an array');
    check(issues.body.length === 5, `issues count is 5 (got ${issues.body.length})`);

    // 5. Create issue
    console.log('\n5. Create issue');
    const newIssue = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/issues', {
      method: 'POST',
      body: { title: 'Test issue from simulator', body: 'This is a test', labels: ['test'] },
    });
    check(newIssue.status === 201, 'POST issue returns 201');
    check(newIssue.body.title === 'Test issue from simulator', 'issue title matches');
    check(newIssue.body.number > 0, `issue has number ${newIssue.body.number}`);

    // 6. List pull requests
    console.log('\n6. Pull requests');
    const pulls = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/pulls?state=all');
    check(pulls.status === 200, 'GET pulls returns 200');
    check(Array.isArray(pulls.body), 'pulls body is an array');
    check(pulls.body.length >= 2, `pulls count >= 2 (got ${pulls.body.length})`);

    // 7. Create pull request
    console.log('\n7. Create PR');
    const newPR = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/pulls', {
      method: 'POST',
      body: { title: 'Test PR', head: 'test-branch', base: 'master', body: 'Test pull request' },
    });
    check(newPR.status === 201, 'POST pull returns 201');
    check(newPR.body.title === 'Test PR', 'PR title matches');

    // 8. List commits
    console.log('\n8. Commits');
    const commits = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/commits');
    check(commits.status === 200, 'GET commits returns 200');
    check(Array.isArray(commits.body), 'commits body is an array');
    check(commits.body.length === 5, `commits count is 5 (got ${commits.body.length})`);

    // 9. Workflow runs
    console.log('\n9. Workflow runs');
    const runs = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/actions/runs');
    check(runs.status === 200, 'GET actions/runs returns 200');
    check(runs.body.total_count === 2, `workflow runs count is 2 (got ${runs.body.total_count})`);
    check(Array.isArray(runs.body.workflow_runs), 'workflow_runs is an array');

    // 10. File contents
    console.log('\n10. File contents');
    const contents = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/contents/Cargo.toml');
    check(contents.status === 200, 'GET contents/Cargo.toml returns 200');
    check(contents.body.encoding === 'base64', 'content encoding is base64');
    check(contents.body.name === 'Cargo.toml', 'file name is Cargo.toml');

    // 11. Root directory contents
    console.log('\n11. Root directory listing');
    const rootDir = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/contents/');
    check(rootDir.status === 200, 'GET contents/ returns 200');
    check(Array.isArray(rootDir.body), 'root dir is an array');

    // 12. Rate limit headers
    console.log('\n12. Rate limit headers');
    check(health.headers['x-ratelimit-limit'] === '5000', 'X-RateLimit-Limit is 5000');
    check(health.headers['x-ratelimit-remaining'] !== undefined, 'X-RateLimit-Remaining is present');
    check(health.headers['x-ratelimit-used'] !== undefined, 'X-RateLimit-Used is present');

    // 13. 404 for non-existent repo
    console.log('\n13. Error handling');
    const notFound = await request(port, '/repos/nobody/nothing');
    check(notFound.status === 404, 'GET non-existent repo returns 404');
    check(notFound.body.message === 'Not Found', 'error message is "Not Found"');

    // 14. 401 without auth
    console.log('\n14. Auth required');
    const noAuth = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: 'localhost', port, path: '/user', method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });
    check(noAuth.status === 401, 'GET /user without auth returns 401');

    // 15. Issue filtering by state
    console.log('\n15. Issue filtering');
    const closedIssues = await request(port, '/repos/EPS-AI-SOLUTIONS/JaskierWorkspace/issues?state=closed');
    check(closedIssues.status === 200, 'GET closed issues returns 200');
    check(Array.isArray(closedIssues.body), 'closed issues is an array');

    // 16. CI Validator — POST /validate returns results
    console.log('\n16. CI Validator endpoint');
    const validateResult = await request(port, '/validate', {
      method: 'POST',
      body: { workspace_path: process.cwd() },
    });
    check(validateResult.status === 200, 'POST /validate returns 200');
    check(typeof validateResult.body.passed === 'number', 'result has passed count');
    check(typeof validateResult.body.failed === 'number', 'result has failed count');
    check(typeof validateResult.body.warned === 'number', 'result has warned count');
    check(Array.isArray(validateResult.body.results), 'result has results array');
    check(typeof validateResult.body.ok === 'boolean', 'result has ok boolean');

    // 17. CI Validator — missing workspace_path returns 400
    console.log('\n17. CI Validator error handling');
    const validateBad = await request(port, '/validate', {
      method: 'POST',
      body: {},
    });
    check(validateBad.status === 400, 'POST /validate without workspace_path returns 400');
    check(validateBad.body.error === 'workspace_path required', 'error message is correct');

  } finally {
    server.close();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
