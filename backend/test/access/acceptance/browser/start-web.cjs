/**
 * Starts the web app for the browser acceptance run on :3100, talking to the
 * acceptance API on :5100 (never the developer's :3000 / :5000).
 * Usage: node ../backend/test/access/acceptance/browser/start-web.cjs   (from web-app/)
 */
const { spawn } = require('child_process');
const child = spawn('npx', ['vite', 'dev', '--port', '3100', '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_API_BASE_URL: 'http://localhost:5100' },
});
child.on('exit', (code) => process.exit(code ?? 0));
