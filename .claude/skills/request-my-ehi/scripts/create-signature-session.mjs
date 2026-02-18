#!/usr/bin/env node
/**
 * Create an E2EE signature session on the relay server.
 *
 * Usage:
 *   node create-signature-session.mjs <server-url> --authorization-text <text|@file> [options]
 *
 * Options:
 *   --authorization-text <text|@file>  Authorization text (required). Prefix with @ to read from file.
 *   --signer-name <name>              Pre-fill signer name (optional)
 *   --expiry-minutes <n>              Session expiry (default: 60)
 *
 * Output (JSON to stdout):
 *   { sessionId, signUrl, privateKeyJwk, authorizationTextHash }
 */
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const serverUrl = args[0];
if (!serverUrl || serverUrl.startsWith('--')) {
  console.error('Usage: node create-signature-session.mjs <server-url> --authorization-text <text|@file> [options]');
  process.exit(1);
}

function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

let authText = getArg('--authorization-text');
if (!authText) {
  console.error('Error: --authorization-text is required');
  process.exit(1);
}
if (authText.startsWith('@')) {
  authText = readFileSync(authText.slice(1), 'utf-8');
}

const signerName = getArg('--signer-name');
const expiryMinutes = parseInt(getArg('--expiry-minutes') || '60', 10);

// Generate ECDH P-256 keypair
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true, // extractable
  ['deriveBits']
);

const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

// Hash the authorization text
const hashBuf = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(authText)
);
const authorizationTextHash = Array.from(new Uint8Array(hashBuf))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

// Create session on server
const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/signatures/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: publicKeyJwk,
    authorizationText: authText,
    authorizationTextHash,
    signerName,
    expiryMinutes,
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Server error (${res.status}): ${err}`);
  process.exit(1);
}

const data = await res.json();

console.log(JSON.stringify({
  sessionId: data.sessionId,
  signUrl: data.signUrl,
  privateKeyJwk,
  authorizationTextHash,
}, null, 2));
