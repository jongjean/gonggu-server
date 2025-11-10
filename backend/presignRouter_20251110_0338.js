// ------------------------------------------------------
// MinIO presign upload router (PUT URL 발급)
// ------------------------------------------------------
import express from "express";
import jwt from "jsonwebtoken";
import { Client as MinioClient } from "minio";

const router = express.Router();

const minio = new MinioClient({
  endPoint: process.env.MINIO_HOST || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000", 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});

const BUCKET = process.env.MINIO_BUCKET || "gonggu";

// 버킷 존재 보장
async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(BUCKET, "us-east-1");
}

// JWT 보호 미들웨어
function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "NO_TOKEN" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

// presign 발급
// body: { prefix: "tools", filename: "hammer.jpg", contentType?: "image/jpeg" }
router.post("/presign/upload", auth, async (req, res) => {
  try {
    const { prefix = "tools", filename = "file.bin", contentType } = req.body || {};
    const clean = String(filename).replace(/[^A-Za-z0-9._-]/g, "_");
    const objectName = `${prefix}/${Date.now()}-${clean}`;

    await ensureBucket();

    // 15분 유효 presigned PUT
    // contentType을 지정하면 업로드 시 같은 Content-Type 헤더로 PUT해야 합니다.
    const expirySec = 15 * 60;
    const url = await minio.presignedPutObject(BUCKET, objectName, expirySec, {
      "Content-Type": contentType || "application/octet-stream",
    });

    return res.json({ ok: true, url, key: objectName });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "PRESIGN_FAILED", detail: String(e) });
  }
});

// 핑
router.get("/presign/ping", (_req, res) => res.json({ ok: true, msg: "presign ready" }));

export default router;
