/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Frontend Security Utilities
 * - CSV formula-injection neutralization (OWASP spreadsheet injection defense)
 * - Safe Blob CSV downloader
 * - Client-side defense-in-depth image URL sanitization
 */

/**
 * Neutralize spreadsheet formula injection (CWE-1236) and apply RFC 4180 CSV quoting.
 * Any string starting with =, +, -, @, tab, or CR is prefixed with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/** Build and download a formula-safe UTF-8 CSV file using a Blob URL */
export function downloadSafeCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName.endsWith('.csv') ? safeName : `${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Validate image URLs before rendering in <img> tags */
export function safeImageUrl(raw: string | null | undefined, fallback = ''): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}
