// ------------------------------------------------------
// MinIO presign upload router (PUT URL 발급) — dual client (internal + public)
// ------------------------------------------------------
import express from "express";
import jwt from "jsonwebtoken";
import { Client as MinioClient } from "minio";

const router = express.Router();

// 외부(브라우저/호스트)에서 접근 가능한 공개 URL (예: http://127.0.0.1:9000, https://uconcreative.ddns.net:9000)
const PUBLIC_MINIO_URL = process.env.MINIO_PUBLIC_URL || "";

// 내부 접근용 클라이언트 (도커 네트워크에서 minio:9000)
const minioInternal = new MinioClient({
  endPoint: process.env.MINIO_HOST || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000", 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "admin",
  secretKey: process.env.MINIO_SECRET_KEY || "admin123",
});

// 공개 접근용 클라이언트 (서명에 들어갈 Host/Port를 PUBLIC_MINIO_URL로)
let minioPublic: MinioClient | null = null;
if (PUBLIC_MINIO_URL) {
  try {
    const p = new URL(PUBLIC_MINIO_URL);
    minioPublic = new MinioClient({
      endPoint: p.hostname,                      // ex) 127.0.0.1 or uconcreative.ddns.net
      port: p.port ? parseInt(p.port, 10) : (p.protocol === "https:" ? 443 : 80),
      useSSL: p.protocol === "https:",
      accessKey: process.env.MINIO_ACCESS_KEY || "admin",
      secretKey: process.env.MINIO_SECRET_KEY || "admin123",
    });
  } catch {
    // 잘못된 URL이면 무시하고 내부 클라이언트만 사용
    minioPublic = null;
  }
}

const BUCKET = process.env.MINIO_BUCKET || "gonggu";

// 버킷 존재 보장 (내부 클라이언트로 실제 체크/생성)
async function ensureBucket() {
  const exists = await minioInternal.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minioInternal.makeBucket(BUCKET, "us-east-1");
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

    const expirySec = 15 * 60;

    // 핵심: 공개용 클라이언트가 있으면 그걸로 "직접" 서명하여 URL 생성
    const signer = minioPublic || minioInternal;
    const url = await signer.presignedPutObject(BUCKET, objectName, expirySec, {
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
