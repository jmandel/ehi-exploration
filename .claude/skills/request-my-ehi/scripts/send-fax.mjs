#!/usr/bin/env node
/**
 * Send a PDF as a fax via the relay server.
 *
 * Usage:
 *   node send-fax.mjs <server-url> <fax-number> <pdf-path>
 *
 * Output (JSON to stdout):
 *   { faxId, provider, status }
 */
import { readFileSync } from 'fs';
import { basename } from 'path';

const [serverUrl, faxNumber, pdfPath] = process.argv.slice(2);

if (!serverUrl || !faxNumber || !pdfPath) {
  console.error('Usage: node send-fax.mjs <server-url> <fax-number> <pdf-path>');
  process.exit(1);
}

const pdfBytes = readFileSync(pdfPath);
const fileBase64 = pdfBytes.toString('base64');
const filename = basename(pdfPath);

const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/fax/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: faxNumber, filename, fileBase64 }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Server error (${res.status}): ${err}`);
  process.exit(1);
}

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
