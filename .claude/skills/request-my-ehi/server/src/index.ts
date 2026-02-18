import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { config } from "./config.ts";
import { signatureRoutes } from "./routes/signature.ts";
import { faxRoutes } from "./routes/fax.ts";
import { getSession } from "./store.ts";

const app = new Hono();

app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// API routes
app.route("/api/signatures", signatureRoutes);
app.route("/api/fax", faxRoutes);

// Serve sign.html for /sign/:sessionId
app.get("/sign/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) {
    return c.text("Session not found or expired", 404);
  }
  const html = await Bun.file(new URL("../public/sign.html", import.meta.url).pathname).text();
  return c.html(html);
});

// Serve fax outbox UI
app.get("/fax-outbox", async (c) => {
  const html = await Bun.file(new URL("../public/fax-outbox.html", import.meta.url).pathname).text();
  return c.html(html);
});

// Static files fallback
app.use("/public/*", serveStatic({ root: "./" }));

console.log(`EHI Relay server listening on port ${config.port}`);
console.log(`  Base URL: ${config.baseUrl}`);
console.log(`  Signature UI: ${config.baseUrl}/sign/<sessionId>`);
console.log(`  Fax Outbox: ${config.baseUrl}/fax-outbox`);

export default {
  port: config.port,
  fetch: app.fetch,
};
