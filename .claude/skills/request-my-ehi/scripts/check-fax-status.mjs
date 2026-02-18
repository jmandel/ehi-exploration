#!/usr/bin/env node
/**
 * Check the status of a fax job.
 *
 * Usage:
 *   node check-fax-status.mjs <server-url> <fax-id>
 *
 * Output (JSON to stdout):
 *   { faxId, status, to, filename, pages?, createdAt, completedAt?, errorMessage?, events }
 */

const [serverUrl, faxId] = process.argv.slice(2);

if (!serverUrl || !faxId) {
  console.error('Usage: node check-fax-status.mjs <server-url> <fax-id>');
  process.exit(1);
}

const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/fax/status/${faxId}`);

if (!res.ok) {
  const err = await res.text();
  console.error(`Server error (${res.status}): ${err}`);
  process.exit(1);
}

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
