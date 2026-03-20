# GitHub Simulator

A local Express-based server that simulates the GitHub REST API for Jaskier Workspace development and testing. Runs entirely in-memory with pre-seeded data matching the actual workspace.

## Features

- Full GitHub REST API v3 simulation (repos, issues, PRs, actions, contents, users)
- Bearer token authentication (simulated)
- GitHub-style rate limiting headers (`X-RateLimit-*`, 5000 req/hour)
- Link header pagination (same format as GitHub)
- Pre-seeded with JaskierWorkspace data (EPS-AI-SOLUTIONS org)
- Webhook simulation with ping events
- CLI with start, seed, and reset commands
- In-memory store (no database required)

## Quick Start

```bash
cd apps/GithubSimulator
npm install
node index.js start
```

The server starts on `http://localhost:8200` by default.

## CLI Commands

```bash
# Start the server (default port 8200)
node index.js start
node index.js start --port 9000

# Start without pre-seeded data
node index.js start --no-seed

# Show seeded data summary
node index.js seed

# Reset all data and re-seed
node index.js reset
```

## API Endpoints

### Repositories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/:owner/:repo` | Get repository info |
| GET | `/repos/:owner/:repo/commits` | List commits |
| GET | `/repos/:owner/:repo/hooks` | List webhooks |
| POST | `/repos/:owner/:repo/hooks` | Create webhook (fires ping) |
| GET | `/orgs/:org/repos` | List organization repos |

### Issues
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/:owner/:repo/issues` | List issues (filter: state, labels, assignee) |
| GET | `/repos/:owner/:repo/issues/:number` | Get single issue |
| POST | `/repos/:owner/:repo/issues` | Create issue |
| PATCH | `/repos/:owner/:repo/issues/:number` | Update issue |
| GET | `/repos/:owner/:repo/issues/:number/comments` | List comments |
| POST | `/repos/:owner/:repo/issues/:number/comments` | Add comment |

### Pull Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/:owner/:repo/pulls` | List PRs (filter: state, head, base) |
| GET | `/repos/:owner/:repo/pulls/:number` | Get single PR |
| POST | `/repos/:owner/:repo/pulls` | Create PR |
| PUT | `/repos/:owner/:repo/pulls/:number/merge` | Merge PR |

### Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/:owner/:repo/actions/runs` | List workflow runs |
| GET | `/repos/:owner/:repo/actions/runs/:id` | Get single run |
| POST | `/repos/:owner/:repo/actions/runs/:id/rerun` | Re-run workflow |

### Contents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos/:owner/:repo/contents/:path` | Get file (base64) or directory listing |
| GET | `/repos/:owner/:repo/contents` | Get root directory |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/user` | Get authenticated user |
| GET | `/users/:username` | Get user by username |

### Meta
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/rate_limit` | Rate limit status |
| GET | `/` | API root (resource URLs) |

## Authentication

All endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer ghp_jaskier_simulator_token" http://localhost:8200/user
```

The default seeded token is `ghp_jaskier_simulator_token`. Any other token is accepted with a generic user profile.

## Pre-seeded Data

- **Org**: EPS-AI-SOLUTIONS
- **Repos**: JaskierWorkspace, ClaudeHydra, GeminiHydra, Tissaia, Keira, Regis
- **Issues**: 5 (B06 stealth, orchestrator probes, JSP cache, petgraph migration, E2E flake)
- **Pull Requests**: 3 (RAG fusion, Windows probes fix, Grantify docs)
- **Commits**: 5 (matching real git log)
- **Workflow Runs**: 2 (Workspace CI, Deploy)
- **File Contents**: Cargo.toml, package.json, CLAUDE.md, root directory listing

## CI Validation

Pre-push validation module that catches common CI failures locally before pushing to GitHub.

### CLI

```bash
# Validate the current directory
node index.js validate

# Validate a specific workspace path
node index.js validate /path/to/workspace

# Skip specific validators
node index.js validate --skip-rust
node index.js validate --skip-node
node index.js validate --skip-biome
node index.js validate --skip-ci
node index.js validate --skip-worktrees
node index.js validate --skip-docker

# Combine skip flags
node index.js validate --skip-rust --skip-licenses

# Output JSON results to file
node index.js validate --json
node index.js validate --json ./results.json
```

### REST API

```bash
# POST /validate — run all CI validators against a workspace
curl -X POST -H "Authorization: Bearer ghp_jaskier_simulator_token" \
  -H "Content-Type: application/json" \
  -d '{"workspace_path": "/path/to/workspace"}' \
  http://localhost:8200/validate
```

Response:
```json
{
  "passed": 8,
  "failed": 1,
  "warned": 2,
  "skipped": 0,
  "ok": false,
  "timings": [
    { "name": "Node.js / pnpm", "ms": 5, "skipped": false }
  ],
  "results": [
    { "name": "packageManager field", "status": "pass" },
    { "name": "cargo check", "status": "fail", "errors": ["Trait bound not satisfied"] }
  ]
}
```

### Validators

| Validator | Checks | Skip Flag |
|-----------|--------|-----------|
| **Node.js / pnpm** | `packageManager` field, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `bun` in scripts | `--skip-node` |
| **Secrets Scan** | AWS keys, OpenAI/Stripe keys, GitHub tokens, xAI keys, hardcoded passwords | `--skip-secrets` |
| **Biome Lint/Format** | `biome.json` validity, `vcs.useIgnoreFile`, nested configs, `biome check` | `--skip-biome` |
| **CI Workflows** | Hardcoded secrets, pnpm cache, cargo scope, native deps, deprecated actions | `--skip-ci` |
| **Worktrees** | Stale `.claude/worktrees/`, orphaned git worktrees | `--skip-worktrees` |
| **Docker** | `:latest` tags, missing `.dockerignore`, ENV secrets, HEALTHCHECK, USER | `--skip-docker` |
| **Rust Formatting** | `cargo fmt --all --check` | `--skip-rust` |
| **Rust Workspace** | `cargo check`, `cargo clippy`, `cargo fmt --check`, license fields in Cargo.toml | `--skip-rust` |
| **License Compliance** | `cargo deny check licenses` (unlicensed crates, denied licenses) | `--skip-licenses` |
| **Vercel Deployments** | `vercel.json`, build script, stale `.js` shadows, committed build output | `--skip-vercel` |

### Validator Unit Tests

```bash
node src/validators/test-validators.js
```

Tests 26 cases across all validators with mock data — no cargo, pnpm, or git required.

## Testing

```bash
node test-simulator.js
```

Runs 17 smoke tests covering all major endpoints, auth, pagination, error handling, and CI validation. Validator unit tests cover 26 cases across 10 validators.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `8200` | Server port |

## Usage with jaskier-tools

Point the GitHub tool crate to this simulator:

```rust
// In jaskier-tools or test configuration
let github_api_base = "http://localhost:8200";
```

Or set `GITHUB_API_URL=http://localhost:8200` in your environment.
