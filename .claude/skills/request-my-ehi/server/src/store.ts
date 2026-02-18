import { config } from "./config.ts";

export interface AuditEntry {
  timestamp: string;
  event: string;
  ip?: string;
  userAgent?: string;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  ephemeralPublicKey: JsonWebKey;
}

export interface SignatureSession {
  id: string;
  publicKeyJwk: JsonWebKey;
  authorizationText: string;
  authorizationTextHash: string;
  signerName?: string;
  status: "waiting" | "completed" | "expired";
  encryptedPayload?: EncryptedPayload;
  createdAt: number;
  expiresAt: number;
  auditLog: AuditEntry[];
  waiters: Array<(session: SignatureSession) => void>;
}

export interface FaxJob {
  id: string;
  to: string;
  filename: string;
  fileBase64: string;
  status: "queued" | "sending" | "delivered" | "failed";
  pages?: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  events: Array<{ timestamp: string; status: string; detail?: string }>;
}

const sessions = new Map<string, SignatureSession>();
const faxJobs = new Map<string, FaxJob>();

// Cleanup expired sessions every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt && session.status === "waiting") {
      session.status = "expired";
      session.auditLog.push({ timestamp: new Date().toISOString(), event: "expired" });
      // Resolve any waiting long-pollers
      for (const resolve of session.waiters) resolve(session);
      session.waiters = [];
    }
    // Remove sessions that expired more than 1 hour ago
    if (now > session.expiresAt + 3600000) {
      sessions.delete(id);
    }
  }
}, 60000);

export function createSession(params: {
  publicKeyJwk: JsonWebKey;
  authorizationText: string;
  authorizationTextHash: string;
  signerName?: string;
  expiryMinutes?: number;
}): SignatureSession {
  const id = crypto.randomUUID();
  const ttl = (params.expiryMinutes ?? 60) * 60 * 1000;
  const session: SignatureSession = {
    id,
    publicKeyJwk: params.publicKeyJwk,
    authorizationText: params.authorizationText,
    authorizationTextHash: params.authorizationTextHash,
    signerName: params.signerName,
    status: "waiting",
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
    auditLog: [{ timestamp: new Date().toISOString(), event: "created" }],
    waiters: [],
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): SignatureSession | undefined {
  return sessions.get(id);
}

export function createFaxJob(params: { to: string; filename: string; fileBase64: string }): FaxJob {
  const id = crypto.randomUUID();
  const job: FaxJob = {
    id,
    to: params.to,
    filename: params.filename,
    fileBase64: params.fileBase64,
    status: "queued",
    createdAt: new Date().toISOString(),
    events: [{ timestamp: new Date().toISOString(), status: "queued", detail: "Fax job created" }],
  };
  faxJobs.set(id, job);
  return job;
}

export function getFaxJob(id: string): FaxJob | undefined {
  return faxJobs.get(id);
}

export function getAllFaxJobs(): FaxJob[] {
  return Array.from(faxJobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateFaxJobStatus(
  id: string,
  status: FaxJob["status"],
  detail?: string
): FaxJob | undefined {
  const job = faxJobs.get(id);
  if (!job) return undefined;
  job.status = status;
  if (status === "delivered" || status === "failed") {
    job.completedAt = new Date().toISOString();
  }
  if (status === "delivered") {
    // Estimate pages from PDF size (rough: ~50KB per page)
    const sizeBytes = Buffer.from(job.fileBase64, "base64").length;
    job.pages = Math.max(1, Math.round(sizeBytes / 50000));
  }
  if (status === "failed" && detail) {
    job.errorMessage = detail;
  }
  job.events.push({ timestamp: new Date().toISOString(), status, detail });
  return job;
}
