import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "tripmind_profile";
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365;

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function parseCookie(header, name) {
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function verifyToken(token, secret) {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 0) return null;
  const id = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1));
  const expectedSignature = Buffer.from(sign(id, secret));
  if (suppliedSignature.length !== expectedSignature.length
      || !timingSafeEqual(suppliedSignature, expectedSignature)) return null;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export function createUserIdentityMiddleware(secret, { secure = false } = {}) {
  if (!secret) throw new Error("A session-signing secret is required.");
  return (req, res, next) => {
    let id = verifyToken(parseCookie(req.headers.cookie, COOKIE_NAME), secret);
    if (!id) {
      id = randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      const token = `${id}.${sign(id, secret)}`;
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
    }
    req.profileKey = createHmac("sha256", secret).update(`profile:${id}`).digest("hex");
    next();
  };
}
