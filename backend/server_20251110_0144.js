import express from "express";
import helmet from "helmet";
import cors from "cors";
import presignRouter from "./presignRouter.js";
import authRouter from "./authRouter.js";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/],
  credentials: true,
}));

app.get("/healthz", (_req, res) => res.send("OK"));

app.use(authRouter);
app.use(presignRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API running on http://0.0.0.0:${PORT}`);
});
