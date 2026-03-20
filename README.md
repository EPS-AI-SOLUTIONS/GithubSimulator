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

## Testing

```bash
node test-simulator.js
```

Runs 15 smoke tests covering all major endpoints, auth, pagination, and error handling.

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
