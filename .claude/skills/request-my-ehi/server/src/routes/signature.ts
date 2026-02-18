import { Hono } from "hono";
import { createSession, getSession } from "../store.ts";
import { config } from "../config.ts";
import type { SignatureSession } from "../store.ts";

export const signatureRoutes = new Hono();

// Create a new signature session
signatureRoutes.post("/sessions", async (c) => {
  const body = await c.req.json();
  const { publicKey, authorizationText, authorizationTextHash, signerName, expiryMinutes } = body;

  if (!publicKey || !authorizationText || !authorizationTextHash) {
    return c.json({ error: "publicKey, authorizationText, and authorizationTextHash are required" }, 400);
  }

  const session = createSession({
    publicKeyJwk: publicKey,
    authorizationText,
    authorizationTextHash,
    signerName,
    expiryMinutes,
  });

  return c.json({
    sessionId: session.id,
    signUrl: `${config.baseUrl}/sign/${session.id}`,
    expiresAt: new Date(session.expiresAt).toISOString(),
  }, 201);
});

// Get session info (for the browser signing UI)
signatureRoutes.get("/sessions/:id/info", (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (session.status === "expired") {
    return c.json({ error: "Session expired" }, 410);
  }
  if (session.status === "completed") {
    return c.json({ error: "Session already completed" }, 409);
  }

  return c.json({
    publicKeyJwk: session.publicKeyJwk,
    authorizationText: session.authorizationText,
    signerName: session.signerName,
  });
});

// Long-poll for session completion (agent calls this)
signatureRoutes.get("/sessions/:id/poll", async (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const timeoutSec = Math.min(parseInt(c.req.query("timeout") || "30", 10), 60);

  if (session.status !== "waiting") {
    return c.json(sessionPollResponse(session));
  }

  // Long-poll: wait for completion or timeout
  const result = await Promise.race([
    new Promise<SignatureSession>((resolve) => {
      session.waiters.push(resolve);
    }),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutSec * 1000);
    }),
  ]);

  if (result === null) {
    // Timeout - remove our waiter
    // (it's fine if it already resolved; the waiter is a no-op then)
    return c.json({ status: "waiting" });
  }

  return c.json(sessionPollResponse(result));
});

// Submit encrypted signature (browser calls this)
signatureRoutes.post("/sessions/:id/submit", async (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (session.status === "expired") {
    return c.json({ error: "Session expired" }, 410);
  }
  if (session.status === "completed") {
    return c.json({ error: "Session already completed" }, 409);
  }

  const body = await c.req.json();
  const { ciphertext, iv, ephemeralPublicKey } = body;

  if (!ciphertext || !iv || !ephemeralPublicKey) {
    return c.json({ error: "ciphertext, iv, and ephemeralPublicKey are required" }, 400);
  }

  session.encryptedPayload = { ciphertext, iv, ephemeralPublicKey };
  session.status = "completed";
  session.auditLog.push({
    timestamp: new Date().toISOString(),
    event: "submitted",
    ip: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || undefined,
    userAgent: c.req.header("user-agent") || undefined,
  });

  // Wake up all long-poll waiters
  for (const resolve of session.waiters) resolve(session);
  session.waiters = [];

  return c.json({ status: "completed" });
});

function sessionPollResponse(session: SignatureSession) {
  const response: Record<string, unknown> = { status: session.status };
  if (session.status === "completed" && session.encryptedPayload) {
    response.encryptedPayload = session.encryptedPayload;
    response.auditLog = session.auditLog;
  }
  return response;
}
