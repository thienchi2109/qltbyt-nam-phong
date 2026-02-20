#!/usr/bin/env node
/**
 * gen-types.js - Safe Supabase type generation script
 *
 * Replaces: supabase gen types typescript --linked > src/types/database.ts
 *
 * Why not the raw shell redirect:
 *   On Windows, `>` truncates the target file BEFORE the command runs.
 *   If supabase is not linked or fails for any reason, the target becomes empty.
 *   This script captures output to memory first, validates it, then writes atomically.
 *
 * Output target: src/types/database.generated.ts
 * This is SEPARATE from src/types/database.ts (hand-written domain types).
 * Do NOT change the output target to database.ts.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.resolve(__dirname, '../src/types/database.generated.ts');
const MIN_VALID_BYTES = 200;
const REQUIRED_MARKER = 'export type Json';

let output;
try {
  const isWindows = process.platform === 'win32';
  const bin = isWindows ? 'npx.cmd' : 'npx';
  output = execSync(`${bin} supabase gen types typescript --linked`, {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..'),
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (err) {
  console.error('\nERROR: supabase gen types failed.');
  if (err.stderr) console.error(err.stderr.trim());
  console.error('\nCommon causes:');
  console.error('  - Not linked (run: npx supabase link)');
  console.error('  - Not logged in (run: npx supabase login)');
  console.error('  - No network access to Supabase project');
  console.error('\nsrc/types/database.generated.ts was NOT modified.');
  process.exit(1);
}

if (!output || output.length < MIN_VALID_BYTES || !output.includes(REQUIRED_MARKER)) {
  console.error('\nERROR: Output is empty or invalid (missing "export type Json" marker).');
  console.error(`Output length: ${output?.length ?? 0} bytes (minimum expected: ${MIN_VALID_BYTES}).`);
  console.error('\nsrc/types/database.generated.ts was NOT modified.');
  process.exit(1);
}

fs.writeFileSync(OUTPUT, output, 'utf8');
console.log(`Written: ${path.relative(process.cwd(), OUTPUT)} (${(output.length / 1024).toFixed(1)} KB)`);
