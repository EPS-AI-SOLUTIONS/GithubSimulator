import { Router } from 'express';
import { logger } from '../utils.js';

const router = Router();

/**
 * GET /user
 * Get the authenticated user.
 * Returns the user object attached by the auth middleware.
 */
router.get('/', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Requires authentication',
      documentation_url: 'https://docs.github.com/rest/users/users#get-the-authenticated-user',
    });
  }

  logger.github(`GET /user -> ${req.user.login}`);

  res.json({
    login: req.user.login,
    id: req.user.id,
    node_id: req.user.node_id || 'U_simulated',
    avatar_url: req.user.avatar_url || `https://avatars.githubusercontent.com/u/${req.user.id}?v=4`,
    gravatar_id: '',
    url: `https://api.github.com/users/${req.user.login}`,
    html_url: `https://github.com/${req.user.login}`,
    followers_url: `https://api.github.com/users/${req.user.login}/followers`,
    following_url: `https://api.github.com/users/${req.user.login}/following{/other_user}`,
    gists_url: `https://api.github.com/users/${req.user.login}/gists{/gist_id}`,
    starred_url: `https://api.github.com/users/${req.user.login}/starred{/owner}{/repo}`,
    repos_url: `https://api.github.com/users/${req.user.login}/repos`,
    events_url: `https://api.github.com/users/${req.user.login}/events{/privacy}`,
    type: req.user.type || 'User',
    site_admin: false,
    name: req.user.name || req.user.login,
    company: req.user.company || null,
    blog: req.user.blog || '',
    location: req.user.location || null,
    email: req.user.email || null,
    bio: req.user.bio || null,
    twitter_username: req.user.twitter_username || null,
    public_repos: req.user.public_repos || 0,
    public_gists: req.user.public_gists || 0,
    followers: req.user.followers || 0,
    following: req.user.following || 0,
    created_at: req.user.created_at || '2024-01-01T00:00:00Z',
    updated_at: req.user.updated_at || new Date().toISOString(),
    private_repos: 12,
    total_private_repos: 12,
    owned_private_repos: 8,
    disk_usage: 245000,
    collaborators: 3,
    two_factor_authentication: true,
    plan: {
      name: 'pro',
      space: 976562499,
      collaborators: 0,
      private_repos: 9999,
    },
  });
});

/**
 * GET /users/:username
 * Get a user by username (public info only).
 */
router.get('/:username', (req, res) => {
  const { username } = req.params;

  logger.github(`GET /users/${username}`);

  // Return a generic user profile
  res.json({
    login: username,
    id: Math.abs(hashCode(username)),
    avatar_url: `https://avatars.githubusercontent.com/u/${Math.abs(hashCode(username))}?v=4`,
    type: 'User',
    name: username,
    company: null,
    blog: '',
    location: null,
    email: null,
    bio: null,
    public_repos: 5,
    public_gists: 0,
    followers: 10,
    following: 5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  });
});

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

export default router;
