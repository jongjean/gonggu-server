import express from "express";
import { Client as MinioClient } from "minio";
import jwt from "jsonwebtoken";

const router = express.Router();

const minio = new MinioClient({
  endPoint: process.env.MINIO_HOST || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});
const BUCKET = process.env.MINIO_BUCKET || "gonggu";

// (옵션) JWT 보호 미들웨어
function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "NO_TOKEN" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

// presign 발급
router.post("/presign/upload", auth, async (req, res) => {
  try {
    const { prefix = "tools", filename = "file.bin" } = req.body || {};
    const clean = String(filename).replace(/[^A-Za-z0-9._-]/g, "_");
    const objectName = `${prefix}/${Date.now()}-${clean}`;

    // 15분 유효 presigned URL
    const url = await minio.presignedPutObject(BUCKET, objectName, 15 * 60);
    return res.json({ url, key: objectName });
  } catch (e) {
    return res.status(500).json({ error: "PRESIGN_FAILED", detail: String(e) });
  }
});

// 단순 핑
router.get("/presign/ping", (_req, res) => res.json({ ok: true }));

export default router;
