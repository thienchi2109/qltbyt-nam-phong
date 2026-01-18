#!/usr/bin/env node
/**
 * run-cmd.js - Universal helper script to run CLI commands with proper output capture on Windows
 *
 * Problem: On Windows, some CLI commands (npm.cmd, npx.cmd, and even .exe files)
 * don't return stdout properly when executed through certain shell contexts
 * (like Claude Code's Bash tool).
 *
 * Solution: This script uses Node's child_process.execSync to properly capture
 * and return all output.
 *
 * Usage:
 *   node scripts/run-cmd.js <command> [args...]
 *
 * Examples:
 *   node scripts/run-cmd.js npm run typecheck
 *   node scripts/run-cmd.js npx prisma generate
 *   node scripts/run-cmd.js bd ready
 *   node scripts/run-cmd.js bd create --title="New task" --type=task
 *   node scripts/run-cmd.js bd list --status=open
 */

const { execSync } = require('child_process');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/run-cmd.js <command> [args...]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/run-cmd.js npm run typecheck');
  console.log('  node scripts/run-cmd.js npx prisma generate');
  console.log('  node scripts/run-cmd.js bd ready');
  console.log('  node scripts/run-cmd.js bd list --status=open');
  console.log('  node scripts/run-cmd.js bd create --title="Task" --type=task');
  process.exit(0);
}

// Build the command string
const command = args.join(' ');

try {
  const output = execSync(command, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer
  });

  if (output) {
    process.stdout.write(output);
  }
} catch (error) {
  // Print any output that was captured before the error
  if (error.stdout) {
    process.stdout.write(error.stdout);
  }
  if (error.stderr) {
    process.stderr.write(error.stderr);
  }

  // Exit with the same code as the failed command
  process.exit(error.status || 1);
}
