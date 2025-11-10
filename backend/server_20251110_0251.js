// ------------------------------------------------------
// Gonggu Server - Express Entry (Env-based CORS + Preflight + Flush Logs)
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

// ✅ CORS 옵션 (비허용은 500이 아니라 CORS 차단으로 처리)
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // 서버-서버/CLI 허용
    const ok = whitelist.includes(origin);
    return cb(null, ok); // ok=true 허용, false면 CORS 차단(500 아님)
  },
  credentials: true,
  optionsSuccessStatus: 204, // 프리플라이트 응답 코드
};

// ✅ 전역 CORS + 전역 프리플라이트 처리
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
