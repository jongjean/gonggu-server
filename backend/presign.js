import { Router } from "express";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import mime from "mime";

const router = Router();

// 내부 통신용(컨테이너 간) 엔드포인트
const endpointHost = process.env.MINIO_ENDPOINT || process.env.MINIO_HOST || "minio";
const useSSL = String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true";
const scheme = useSSL ? "https" : "http";
const endpointPort = process.env.MINIO_PORT || 9000;

// 외부(호스트/브라우저)에서 접근 가능한 공개 URL (예: http://127.0.0.1:9000)
const publicBase = process.env.PUBLIC_S3_URL; // presign 시 이 값을 우선 사용

// 내부용 S3 클라이언트 (List 등 내부 호출)
const s3Internal = new S3Client({
  region: "us-east-1",
  endpoint: `${scheme}://${endpointHost}:${endpointPort}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY
  }
});

// 서명 전용(외부 엔드포인트) S3 클라이언트
// PUBLIC_S3_URL이 있으면 그걸 endpoint로, 없으면 내부 endpoint로 서명
const s3ForSign = new S3Client({
  region: "us-east-1",
  endpoint: publicBase || `${scheme}://${endpointHost}:${endpointPort}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY
  }
});

function makeObjectKey(prefix = "", originalName = "file.bin") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(4).toString("hex");
  const ext = originalName.includes(".")
    ? originalName.split(".").pop()
    : (mime.getExtension(mime.getType(originalName) || "application/octet-stream") || "bin");
  const safePrefix = (prefix || "").replace(/^\//, "").replace(/\/$/, "");
  return `${safePrefix ? safePrefix + "/" : ""}${ts}-${rand}.${ext}`;
}

// POST /upload-url
router.post("/upload-url", async (req, res) => {
  try {
    const { prefix = "raw", filename = "file.bin", contentType } = req.body || {};
    const Key = makeObjectKey(prefix, filename);
    const Bucket = process.env.MINIO_BUCKET;
    const expiresIn = Number(process.env.PRESIGN_EXPIRES_SEC || 900);
    const cmd = new PutObjectCommand({
      Bucket,
      Key,
      ContentType: contentType || mime.getType(filename) || "application/octet-stream"
    });
    const url = await getSignedUrl(s3ForSign, cmd, { expiresIn });
    res.json({ url, bucket: Bucket, key: Key, method: "PUT", expiresIn });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "UPLOAD_URL_ERROR", detail: String(e) });
  }
});

// GET /download-url?key=...
router.get("/download-url", async (req, res) => {
  try {
    const Bucket = process.env.MINIO_BUCKET;
    const Key = req.query.key;
    if (!Key) return res.status(400).json({ error: "MISSING_KEY" });
    const expiresIn = Number(process.env.PRESIGN_EXPIRES_SEC || 900);
    const cmd = new GetObjectCommand({ Bucket, Key });
    const url = await getSignedUrl(s3ForSign, cmd, { expiresIn });
    res.json({ url, bucket: Bucket, key: Key, method: "GET", expiresIn });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DOWNLOAD_URL_ERROR", detail: String(e) });
  }
});

// GET /list-files?prefix=...&limit=100&cursor=...
router.get("/list-files", async (req, res) => {
  try {
    const Bucket = process.env.MINIO_BUCKET;
    const Prefix = req.query.prefix || "";
    const MaxKeys = Number(req.query.limit || 100);
    const ContinuationToken = req.query.cursor;
    const out = await s3Internal.send(
      new ListObjectsV2Command({ Bucket, Prefix, MaxKeys, ContinuationToken })
    );
    const items = (out.Contents || []).map(o => ({
      key: o.Key,
      size: o.Size,
      etag: o.ETag,
      lastModified: o.LastModified
    }));
    res.json({
      items,
      isTruncated: !!out.IsTruncated,
      nextCursor: out.NextContinuationToken || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "LIST_ERROR", detail: String(e) });
  }
});

export default router;
