import { Router } from 'express';
import { store } from '../store.js';
import { apiUrl, logger } from '../utils.js';

const router = Router();

/**
 * GET /repos/:owner/:repo/contents/:path(*)
 * Get file or directory contents.
 *
 * Returns base64-encoded file content (matching GitHub API format)
 * or an array of directory entries.
 */
router.get('/:owner/:repo/contents/:path(*)', (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params.path || '';
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const content = store.getContent(owner, repo, filePath);

  if (!content) {
    return res.status(404).json({
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest/repos/contents#get-repository-content',
    });
  }

  // Directory listing
  if (content.type === 'dir') {
    const entries = (content.entries || []).map((e) => ({
      ...e,
      url: apiUrl(req, `/repos/${owner}/${repo}/contents/${e.path}`),
      html_url: `https://github.com/${owner}/${repo}/tree/master/${e.path}`,
      git_url: apiUrl(req, `/repos/${owner}/${repo}/git/trees/${e.sha}`),
      download_url: e.type === 'file'
        ? `https://raw.githubusercontent.com/${owner}/${repo}/master/${e.path}`
        : null,
      _links: {
        self: apiUrl(req, `/repos/${owner}/${repo}/contents/${e.path}`),
        git: apiUrl(req, `/repos/${owner}/${repo}/git/trees/${e.sha}`),
        html: `https://github.com/${owner}/${repo}/tree/master/${e.path}`,
      },
    }));

    logger.github(`GET contents ${owner}/${repo}/${filePath || '(root)'} (dir, ${entries.length} entries)`);
    return res.json(entries);
  }

  // File content
  const ref = req.query.ref || repoData.default_branch || 'master';

  const response = {
    name: content.name,
    path: content.path,
    sha: content.sha,
    size: content.size,
    url: apiUrl(req, `/repos/${owner}/${repo}/contents/${filePath}`),
    html_url: content.html_url || `https://github.com/${owner}/${repo}/blob/${ref}/${filePath}`,
    git_url: apiUrl(req, `/repos/${owner}/${repo}/git/blobs/${content.sha}`),
    download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`,
    type: 'file',
    encoding: content.encoding || 'base64',
    content: content.content,
    _links: {
      self: apiUrl(req, `/repos/${owner}/${repo}/contents/${filePath}`),
      git: apiUrl(req, `/repos/${owner}/${repo}/git/blobs/${content.sha}`),
      html: `https://github.com/${owner}/${repo}/blob/${ref}/${filePath}`,
    },
  };

  logger.github(`GET contents ${owner}/${repo}/${filePath} (file, ${content.size} bytes)`);
  res.json(response);
});

/**
 * GET /repos/:owner/:repo/contents
 * Get root directory contents.
 */
router.get('/:owner/:repo/contents', (req, res) => {
  req.params.path = '';
  const { owner, repo } = req.params;
  const repoData = store.getRepo(owner, repo);

  if (!repoData) {
    return res.status(404).json({ message: 'Not Found' });
  }

  const content = store.getContent(owner, repo, '');

  if (!content) {
    return res.status(404).json({ message: 'Not Found' });
  }

  if (content.type === 'dir') {
    const entries = (content.entries || []).map((e) => ({
      ...e,
      url: apiUrl(req, `/repos/${owner}/${repo}/contents/${e.path}`),
      html_url: `https://github.com/${owner}/${repo}/tree/master/${e.path}`,
      download_url: e.type === 'file'
        ? `https://raw.githubusercontent.com/${owner}/${repo}/master/${e.path}`
        : null,
    }));

    logger.github(`GET contents ${owner}/${repo}/ (root, ${entries.length} entries)`);
    return res.json(entries);
  }

  res.json(content);
});

export default router;
