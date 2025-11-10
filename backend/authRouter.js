import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

/** 회원가입 */
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "USERNAME_PASSWORD_REQUIRED" });
    }
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(409).json({ error: "USERNAME_TAKEN" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, password: hashed } });
    return res.json({ id: user.id, username: user.username });
  } catch (err) {
    return res.status(500).json({ error: "REGISTER_FAILED", detail: String(err?.message ?? err) });
  }
});

/** 로그인 */
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "USERNAME_PASSWORD_REQUIRED" });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: "LOGIN_FAILED", detail: String(err?.message ?? err) });
  }
});

/** 토큰 검증 */
router.get("/auth/verify", async (req, res) => {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "NO_TOKEN" });
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ ok: true, decoded });
  } catch (err) {
    return res.status(401).json({ error: "INVALID_TOKEN", detail: String(err?.message ?? err) });
  }
});

export default router;
