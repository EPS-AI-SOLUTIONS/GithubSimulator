import chalk from 'chalk';

export const logger = {
  info: (msg) => console.log(chalk.blue('i info ') + msg),
  success: (msg) => console.log(chalk.green('v success ') + msg),
  warn: (msg) => console.log(chalk.yellow('! warn ') + msg),
  error: (msg) => console.error(chalk.red('x error ') + msg),
  request: (method, url, status, ms) => {
    const color = status >= 500 ? chalk.red : status >= 400 ? chalk.yellow : status >= 300 ? chalk.cyan : chalk.green;
    console.log(`${chalk.gray(new Date().toISOString())} ${chalk.bold(method)} ${url} ${color(status)} ${ms}ms`);
  },
  github: (msg) => console.log(chalk.magenta('[GitHub] ') + msg),
};

export function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    import('net').then(({ default: net }) => {
      const server = net.createServer();
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve(findAvailablePort(startPort + 1));
        else reject(err);
      });
    });
  });
}

/**
 * Build a GitHub API URL for a resource.
 */
export function apiUrl(req, path) {
  const proto = req.protocol;
  const host = req.get('host');
  return `${proto}://${host}${path}`;
}
