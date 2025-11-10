// ------------------------------------------------------
// Gonggu Server - Express Entry (Env-based CORS + Flush Logs)
// Date: 2025-11-10
// ------------------------------------------------------

import express from "express";
import helmet from "helmet";
import cors from "cors";
import presignRouter from "./presignRouter.js";
import authRouter from "./authRouter.js";

const app = express();

// ✅ 보안 헤더
app.use(helmet());

// ✅ JSON 파서
app.use(express.json());

// ✅ 환경 감지
const ENV = process.env.NODE_ENV || "development";

/**
 * ALLOWED_ORIGINS 예시 (쉼표로 구분):
 *  - 개발(로컬):  http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
 *  - 운영(도메인): https://uconcreative.ddns.net,https://gonggu.uconai.com
 *
 * docker compose 실행 시:
 *   docker compose --env-file backend/.env.dev up -d
 *   docker compose --env-file backend/.env.prod up -d
 */
const parseOrigins = (val) =>
  (val || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// 동적 화이트리스트(환경변수) → 없으면 개발 기본값(개발 모드에서만)
const dynamic = parseOrigins(process.env.ALLOWED_ORIGINS);
const fallbackDev = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// ENV=production 이고 ALLOWED_ORIGINS가 비어 있으면 whitelist를 빈 배열로 둡니다.
const whitelist =
  dynamic.length > 0
    ? dynamic
    : ENV === "production"
    ? []
    : fallbackDev;

// ✅ CORS (환경변수 기반 화이트리스트)
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // 서버-서버/CLI 허용
      const ok = whitelist.includes(origin);
      cb(ok ? null : new Error(`CORS_NOT_ALLOWED: ${origin}`));
    },
    credentials: true,
  })
);

// ✅ 즉시 flush 로그
const log = (m) => process.stdout.write(m + "\n");
log("------------------------------------------------------");
log(`🌐 MODE: ${ENV}`);
log(`🔐 CORS whitelist (${whitelist.length}): ${whitelist.join(", ") || "(empty)"}`);
log("------------------------------------------------------");

// ✅ 헬스 체크
app.get("/healthz", (_req, res) => res.send("OK"));

// ✅ 라우터
app.use(authRouter);
app.use(presignRouter);

// ✅ 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Gonggu API running on http://0.0.0.0:${PORT}`);
});
