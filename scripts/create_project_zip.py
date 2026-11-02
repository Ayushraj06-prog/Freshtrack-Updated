#!/usr/bin/env python3
"""
FreshTrack Project Archiver
Packages all application source code, configuration files, backend, and database schema
into a pristine, ready-to-run ZIP archive, excluding node_modules, dist, and cache files.
"""

import os
import sys
import zipfile
from pathlib import Path

def create_archive(root_dir, output_zip):
    root_path = Path(root_dir).resolve()
    output_path = Path(output_zip).resolve()

    # Ensure parent dir exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    exclude_dirs = {
        'node_modules',
        '.git',
        'dist',
        '.vite',
        '.tmp',
        '__pycache__',
        '.cache',
    }

    exclude_files = {
        '.DS_Store',
        'freshtrack-kitchen-app.zip',
        'freshtrack-complete.zip',
        'package-lock.json',
        'bun.lock',
    }

    print(f"Creating ZIP archive from: {root_path}")
    print(f"Target: {output_path}")

    file_count = 0
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_path):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if file in exclude_files:
                    continue
                if file.endswith('.zip') or file.endswith('.tmp'):
                    continue

                full_file_path = Path(root) / file
                rel_path = full_file_path.relative_to(root_path)

                # Skip if writing to the output zip itself
                if full_file_path.resolve() == output_path:
                    continue

                zipf.write(full_file_path, arcname=str(rel_path))
                file_count += 1

    size_kb = output_path.stat().st_size / 1024
    print(f"Archive successfully created: {file_count} files, {size_kb:.1f} KB")

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    output = sys.argv[2] if len(sys.argv) > 2 else 'freshtrack-kitchen-app.zip'
    create_archive(root, output)
