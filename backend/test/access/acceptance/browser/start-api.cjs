/**
 * Starts the API for the browser acceptance run on port 5100 against the
 * `acceptit` schema only (never `public`), allowing the web app on :3100.
 * Usage: node test/access/acceptance/browser/start-api.cjs   (from backend/)
 */
require('dotenv').config();
const { spawn } = require('child_process');
const url = new URL(process.env.DATABASE_URL);
url.hostname = url.hostname.replace('-pooler', '');
url.searchParams.delete('channel_binding');
url.searchParams.set('options', '-c search_path=acceptit,public');
const env = {
  ...process.env,
  PORT: '5100',
  CORS_ORIGIN: 'http://localhost:3100',
  DATABASE_URL: url.toString(),
  NODE_ENV: 'development',
};
const child = spawn('npx', ['nest', 'start'], { stdio: 'inherit', shell: true, env });
child.on('exit', (code) => process.exit(code ?? 0));
