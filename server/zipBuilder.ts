/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Project ZIP Builder & Downloader
 * Bundles the full source code, backend, database config, and dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(rootDir, 'scripts/create_project_zip.py');
const publicDir = path.join(rootDir, 'public');
const targetZip = path.join(publicDir, 'freshtrack-kitchen-app.zip');

export function generateProjectZip(): string {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    execSync(`python3 "${scriptPath}" "${rootDir}" "${targetZip}"`, {
      cwd: rootDir,
      stdio: 'pipe',
    });
    return targetZip;
  } catch (err: any) {
    console.error('Failed to generate zip with Python script:', err.message);
    throw err;
  }
}

export function getProjectZipPath(): string {
  if (!fs.existsSync(targetZip)) {
    return generateProjectZip();
  }
  return targetZip;
}
