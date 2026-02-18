# Request My EHI

A Claude skill that helps patients request their complete Electronic Health Information (EHI) Export from healthcare providers. Supports Epic and 70+ other certified EHR vendors.

## What It Does

Guides patients through the full process of requesting their EHI Export:
1. Identifies the provider's EHR vendor
2. Gathers patient details
3. Fills an authorization form (provider's own or generic HIPAA-compliant template)
4. Generates a vendor-specific appendix explaining EHI Export
5. Merges everything into a ready-to-submit PDF
6. Optionally captures an e-signature and sends the fax

## Scripts

All scripts are zero-dependency Node.js (18+) `.mjs` files:

| Script | Purpose |
|--------|---------|
| `lookup-vendor.mjs` | Search the vendor database (71 vendors) |
| `generate-appendix.mjs` | Generate a vendor-specific appendix PDF |
| `fill-and-merge.mjs` | Fill a PDF form and merge with appendix |
| `list-form-fields.mjs` | List form fields in a PDF |
| `create-signature-session.mjs` | Create an E2EE signature capture session |
| `poll-signature.mjs` | Poll for and decrypt a completed signature |
| `send-fax.mjs` | Send a PDF via the relay server fax outbox |
| `check-fax-status.mjs` | Check fax delivery status |

## Relay Server

The `server/` directory contains a Bun + Hono relay server that provides:

- **E2EE Signature Capture**: Patient draws their signature on a mobile-friendly web page. The signature is encrypted in the browser using ECDH P-256 + AES-256-GCM before being sent to the server -- the server never sees the plaintext signature.
- **Simulated Fax Outbox**: Faxes are queued in-memory with a web UI (`/fax-outbox`) where you can view PDFs and simulate delivery workflow events (sending, delivered, failed, retry).

The server is **not** part of the skill itself -- it's deployed separately and the client scripts communicate with it via HTTP.

### Running Locally

```bash
cd server
bun install
bun run dev
# Server starts at http://localhost:3000
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | Public URL (used in sign URLs) |
| `SESSION_TTL_MS` | `900000` | Signature session TTL in ms (15 min) |

### Deploying to Fly.io

```bash
cd server
fly launch        # first time
fly deploy        # subsequent deploys
fly secrets set BASE_URL=https://your-app.fly.dev
```

### Docker

```bash
cd server
docker build -t ehi-relay .
docker run -p 3000:3000 -e BASE_URL=http://localhost:3000 ehi-relay
```
