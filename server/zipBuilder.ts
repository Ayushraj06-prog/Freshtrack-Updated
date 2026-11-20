/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Project ZIP Builder & Downloader
 * Builds a sanitized source archive inside a private .tmp directory (never publicly exposed)
 * using argument-vector execution without a shell.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.resolve(rootDir, 'scripts', 'create_project_zip.py');
const privateZipDir = path.resolve(rootDir, '.tmp');
const targetZip = path.resolve(privateZipDir, 'freshtrack-kitchen-app.zip');

// Verify path confinement strictly inside privateZipDir
if (!targetZip.startsWith(privateZipDir + path.sep)) {
  throw new Error('Invalid ZIP output path confinement');
}

export function generateProjectZip(): string {
  if (!fs.existsSync(privateZipDir)) {
    fs.mkdirSync(privateZipDir, { recursive: true });
  }

  try {
    execFileSync('python3', [scriptPath, rootDir, targetZip], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: false,
      timeout: 30_000,
    });
    return targetZip;
  } catch (err: any) {
    console.error('Failed to generate sanitized project zip:', err?.message || err);
    throw err;
  }
}

export function getProjectZipPath(): string {
  if (!fs.existsSync(targetZip)) {
    return generateProjectZip();
  }
  return targetZip;
}
