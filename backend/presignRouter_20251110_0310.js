import express from "express";
const router = express.Router();

/** 임시 핑 */
router.get("/presign/ping", (_req, res) => {
  res.json({ ok: true, msg: "presign stub" });
});

export default router;
