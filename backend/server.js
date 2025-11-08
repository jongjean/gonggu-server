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
app.use(helmet());
app.use(express.json());

const pgClient = new pkg.Client({
  host: process.env.PG_HOST || "db",
  port: +(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || "gonggu",
  password: process.env.PG_PASSWORD || "gonggu123",
  database: process.env.PG_DB || "gonggu",
});
pgClient.connect().catch(console.error);

const redis = new Redis({ host: process.env.REDIS_HOST || "redis", port: 6379 });

const minio = new MinioClient({
  endPoint: process.env.MINIO_HOST || "minio",
  port: +(process.env.MINIO_PORT || 9000),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});

app.get("/healthz", async (req, res) => {
  try {
    await pgClient.query("SELECT 1");
    await redis.ping();
    await minio.listBuckets();
    res.send("OK");
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.listen(3000, () => console.log("✅ API running on :3000"));
