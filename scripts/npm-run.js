#!/usr/bin/env node
/**
 * npm-run.js - Helper script to run npm/npx commands with proper output capture on Windows
 *
 * Problem: On Windows, npm.cmd and npx.cmd don't return stdout properly when
 * executed through certain shell contexts (like Claude Code's Bash tool).
 *
 * Solution: This script uses Node's child_process.spawn to properly capture
 * and stream all output.
 *
 * Usage:
 *   node scripts/npm-run.js <command> [args...]
 *   node scripts/npm-run.js run typecheck
 *   node scripts/npm-run.js run build
 *   node scripts/npm-run.js install lodash
 *   node scripts/npm-run.js npx prisma generate
 *
 * Special commands:
 *   node scripts/npm-run.js npx <args>  - Runs npx instead of npm
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/npm-run.js <command> [args...]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/npm-run.js run typecheck');
  console.log('  node scripts/npm-run.js run build');
  console.log('  node scripts/npm-run.js install lodash');
  console.log('  node scripts/npm-run.js npx prisma generate');
  process.exit(0);
}

// Determine if we're running npx or npm
let command = 'npm';
let commandArgs = args;

if (args[0] === 'npx') {
  command = 'npx';
  commandArgs = args.slice(1);
}

// On Windows, we need to use the .cmd extension
const isWindows = process.platform === 'win32';
const executable = isWindows ? `${command}.cmd` : command;

// Spawn the process with inherited stdio for real-time output
const child = spawn(executable, commandArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    FORCE_COLOR: '1', // Preserve colors in output
  },
});

child.on('error', (err) => {
  console.error(`Failed to start ${command}:`, err.message);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
