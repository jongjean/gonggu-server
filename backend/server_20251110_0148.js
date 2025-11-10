// ---------------------------------------------
// gonggu-server Express Main Entry
// Secure baseline version (CORS + Helmet + JWT-ready)
// Created: 2025-11-10
// ---------------------------------------------

import express from "express";
import helmet from "helmet";
import cors from "cors";
import presignRouter from "./presignRouter.js";
import authRouter from "./authRouter.js";

const app = express();

// ✅ 기본 보안 헤더
app.use(helmet());

// ✅ JSON 요청 파서
app.use(express.json());

// ✅ CORS 설정 (개발용: localhost:5173, 3000 허용)
const devOrigins = [
  /^http:\/\/localhost:(5173|3000)$/,
  /^http:\/\/127\.0\.0\.1:(5173|3000)$/
];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // 서버-서버 통신 또는 curl 허용
    const ok = devOrigins.some(re => re.test(origin));
    if (ok) cb(null, true);
    else cb(new Error(`CORS_NOT_ALLOWED: ${origin}`));
  },
  credentials: true,
}));

// ✅ 헬스 체크
app.get("/healthz", (_req, res) => res.send("OK"));

// ✅ 라우터 연결
app.use(authRouter);
app.use(presignRouter);

// ✅ 서버 기동
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Gonggu API running on http://0.0.0.0:${PORT}`);
});
