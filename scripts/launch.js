// Launches Electron with ELECTRON_RUN_AS_NODE removed from the env.
// Without this, an exported ELECTRON_RUN_AS_NODE=1 in the user's shell
// causes the Electron binary to run as plain Node — no app, no window,
// and `require('electron')` returns the binary path string, which makes
// `app.whenReady()` fail with "Cannot read properties of undefined".
const { spawn } = require('child_process');
const electronBinary = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
if (args.length === 0) args.push('.');

const child = spawn(electronBinary, args, { stdio: 'inherit', env });

child.on('exit', (code, signal) => {
  if (signal) { process.kill(process.pid, signal); return; }
  process.exit(code == null ? 1 : code);
});

child.on('error', (error) => {
  console.error('[launch] failed to spawn Electron:', error && error.message ? error.message : error);
  process.exit(1);
});
