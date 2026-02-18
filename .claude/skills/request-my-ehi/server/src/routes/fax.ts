import { Hono } from "hono";
import { createFaxJob, getFaxJob, getAllFaxJobs, updateFaxJobStatus } from "../store.ts";

export const faxRoutes = new Hono();

// Send a fax (simulated -- adds to outbox)
faxRoutes.post("/send", async (c) => {
  const body = await c.req.json();
  const { to, filename, fileBase64 } = body;

  if (!to || !fileBase64) {
    return c.json({ error: "to and fileBase64 are required" }, 400);
  }

  const job = createFaxJob({
    to,
    filename: filename || "document.pdf",
    fileBase64,
  });

  return c.json({
    faxId: job.id,
    provider: "simulated",
    status: job.status,
  }, 201);
});

// Check fax status
faxRoutes.get("/status/:id", (c) => {
  const job = getFaxJob(c.req.param("id"));
  if (!job) {
    return c.json({ error: "Fax job not found" }, 404);
  }

  return c.json({
    faxId: job.id,
    status: job.status,
    to: job.to,
    filename: job.filename,
    pages: job.pages,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
    events: job.events,
  });
});

// List all fax jobs (for outbox UI)
faxRoutes.get("/jobs", (c) => {
  const jobs = getAllFaxJobs();
  return c.json(
    jobs.map((j) => ({
      faxId: j.id,
      to: j.to,
      filename: j.filename,
      status: j.status,
      pages: j.pages,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      errorMessage: j.errorMessage,
      events: j.events,
      fileSizeKB: Math.round(Buffer.from(j.fileBase64, "base64").length / 1024),
    }))
  );
});

// Simulate a workflow event (for outbox UI buttons)
faxRoutes.post("/jobs/:id/simulate", async (c) => {
  const job = getFaxJob(c.req.param("id"));
  if (!job) {
    return c.json({ error: "Fax job not found" }, 404);
  }

  const body = await c.req.json();
  const { action, detail } = body;

  const validTransitions: Record<string, string[]> = {
    queued: ["sending", "failed"],
    sending: ["delivered", "failed"],
    delivered: [],
    failed: ["queued"], // allow retry
  };

  if (!validTransitions[job.status]?.includes(action)) {
    return c.json(
      { error: `Cannot transition from "${job.status}" to "${action}"` },
      400
    );
  }

  const updated = updateFaxJobStatus(job.id, action, detail);
  return c.json({
    faxId: updated!.id,
    status: updated!.status,
    events: updated!.events,
  });
});

// Download the fax PDF (for outbox UI)
faxRoutes.get("/jobs/:id/download", (c) => {
  const job = getFaxJob(c.req.param("id"));
  if (!job) {
    return c.text("Not found", 404);
  }

  const pdfBytes = Buffer.from(job.fileBase64, "base64");
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${job.filename}"`,
    },
  });
});
