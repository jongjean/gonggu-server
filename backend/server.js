import presignRouter from "./presign.js";
// server.js — Gonggu API (ESM)

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pkg from "pg";
import Redis from "ioredis";
import { Client as MinioClient } from "minio";

dotenv.config();

const app = express();

app.use(cors());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);
app.use(express.json());

const PORT = +(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

// PostgreSQL
const pgClient = new pkg.Client({
  host: process.env.PG_HOST || "db",
  port: +(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || "gonggu",
  password: process.env.PG_PASSWORD || "gonggu123",
  database: process.env.PG_DB || "gonggu",
});
pgClient.connect().catch((e) => console.error("[pg] connect error:", e?.message || e));

// Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: +(process.env.REDIS_PORT || 6379),
});

// MinIO
const minio = new MinioClient({
  endPoint: process.env.MINIO_HOST || "minio",
  port: +(process.env.MINIO_PORT || 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});

// ---- Liveness (항상 200 OK) ----
app.get("/healthz", (_req, res) => {
  res.type("text/plain").status(200).send("OK");
});

// ---- Readiness (DB, Redis, MinIO 점검) ----
app.get("/readyz", async (_req, res) => {
  const checks = {};
  let ok = true;

  try {
    await pgClient.query("SELECT 1");
    checks.postgres = true;
  } catch (e) {
    ok = false;
    checks.postgres = String(e?.message || e);
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (e) {
    ok = false;
    checks.redis = String(e?.message || e);
  }

  try {
    await minio.listBuckets();
    checks.minio = true;
  } catch (e) {
    ok = false;
    checks.minio = String(e?.message || e);
  }

  res.status(ok ? 200 : 503).json({ ok, checks });
});

// ---- 테스트용 홈 ----
app.get("/", (_req, res) => res.status(200).send("Gonggu API is live"));

// ---- 서버 시작 ----
app.use(presignRouter);
app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});
