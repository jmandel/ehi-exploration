export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || "3000"}`,
  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || "900000", 10), // 15 min default
};
