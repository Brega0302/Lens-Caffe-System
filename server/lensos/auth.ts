import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./db.js";

export type Actor = { id: number; username: string; role: string };
declare global {
  namespace Express {
    interface Request {
      user: Actor;
    }
  }
}
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const sessionUser = {
  id: true,
  username: true,
  role: true,
  active: true,
} as const;
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(
    /^Bearer ([A-Za-z0-9_-]{43})$/,
  )?.[1];
  if (!token) {
    res.status(401).json({ success: false, message: "Prijava je obavezna." });
    return;
  }
  const session = await prisma.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: sessionUser } },
  });
  if (!session || !session.user.active || session.expiresAt <= new Date()) {
    res
      .status(401)
      .json({
        success: false,
        message: "Prijava je istekla. Prijavite se ponovo.",
      });
    return;
  }
  req.user = session.user;
  next();
};
const permissions: Record<string, ReadonlySet<string>> = {
  OWNER: new Set([
    "read",
    "inventory:write",
    "purchases:write",
    "sales:write",
    "audit:read",
  ]),
  MANAGER: new Set([
    "read",
    "inventory:write",
    "purchases:write",
    "sales:write",
  ]),
  EMPLOYEE: new Set(),
};
export const permit =
  (permission: string): RequestHandler =>
  (req, res, next) => {
    if (!permissions[req.user.role]?.has(permission)) {
      res
        .status(403)
        .json({ success: false, message: "Nemate dozvolu za ovu radnju." });
      return;
    }
    next();
  };
export const authRouter = Router();
authRouter.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Previše pokušaja prijave. Pokušajte ponovo za 15 minuta.",
    },
  }),
  async (req, res) => {
    const data = z
      .object({
        username: z.string().trim().min(1).max(120),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({
      where: { username: data.username },
    });
    // Equal-cost bcrypt work also occurs when the username is unknown.
    const valid = await bcrypt.compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    );
    if (!user?.active || !valid) {
      res
        .status(401)
        .json({
          success: false,
          message: "Pogrešno korisničko ime ili lozinka.",
        });
      return;
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt },
    });
    res.json({
      success: true,
      token,
      expiresAt,
      user: { id: user.id, username: user.username, role: user.role },
    });
  },
);
authRouter.post("/logout", authenticate, async (req, res) => {
  await prisma.session.deleteMany({
    where: { tokenHash: hash(req.headers.authorization!.slice(7)) },
  });
  res.status(204).end();
});
