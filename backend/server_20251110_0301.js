// ------------------------------------------------------
// Gonggu Server - Express Entry
// Env-based CORS (Hybrid Preflight) + Flush Logs + Helmet
// Date: 2025-11-10
// ------------------------------------------------------

import express from "express";
import helmet from "helmet";
import cors from "cors";
import presignRouter from "./presignRouter.js";
import authRouter from "./authRouter.js";

const app = express();

// ✅ 환경 감지
const ENV = process.env.NODE_ENV || "development";

// ✅ ALLOWED_ORIGINS: 쉼표로 구분된 오리진 목록
//   예) http://localhost:5173,https://uconcreative.ddns.net
const parseOrigins = (val) =>
  (val || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const dynamic = parseOrigins(process.env.ALLOWED_ORIGINS);
const fallbackDev = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// ENV=production에서 ALLOWED_ORIGINS가 비었다면 빈 리스트(차단)
const whitelist =
  dynamic.length > 0
    ? dynamic
    : ENV === "production"
    ? []
    : fallbackDev;

// ✅ [핵심] 프리플라이트(OPTIONS) 최우선 하이브리드 처리
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = origin && whitelist.includes(origin);

  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    // 프리플라이트 사양 충족 (브라우저가 요청한 헤더/메서드 반영)
    const reqMethod = req.headers["access-control-request-method"];
    const reqHeaders =
      req.headers["access-control-request-headers"] || "Content-Type, Authorization";

    if (allowed) {
      if (reqMethod) res.setHeader("Access-Control-Allow-Methods", reqMethod);
      res.setHeader("Access-Control-Allow-Headers", String(reqHeaders));
    }
    // 허용되든 아니든 서버 에러 없이 204로 응답 (브라우저가 CORS로 판단)
    return res.sendStatus(204);
  }

  return next();
});

// ✅ 보안 헤더 (프리플라이트보다 뒤에서 동작)
app.use(helmet());

// ✅ JSON 파서
app.use(express.json());

// ✅ cors 패키지(런타임 요청용). 비허용은 서버 에러 대신 단순 차단.
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // 서버-서버/CLI 허용
    const ok = whitelist.includes(origin);
    return cb(null, ok); // true 허용, false면 브라우저에서 CORS 차단
  },
  credentials: true,
};
app.use(cors(corsOptions));

// ✅ 상태 로그 (즉시 flush)
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
