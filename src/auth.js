const crypto = require('crypto');
const { promisify } = require('util');
const config = require('./config');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sid';

// Passwords are stored as scrypt$<salt>$<key>; the plain password is never saved.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function readCookie(req, name) {
  const pair = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function setSessionCookie(res, token) {
  const maxAge = config.sessionDays * 24 * 60 * 60;
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.production ? '; Secure' : ''}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.production ? '; Secure' : ''}`);
}

// Attaches req.member when the request carries a valid session cookie.
const loadMember = (store) => async (req, res, next) => {
  try {
    const token = readCookie(req, COOKIE);
    if (token) {
      req.sessionHash = hashToken(token);
      req.member = await store.getSessionMember(req.sessionHash);
    }
    next();
  } catch (err) {
    next(err);
  }
};

function requireSignedIn(req, res, next) {
  if (!req.member) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

function requireApproved(req, res, next) {
  if (!req.member) return res.status(401).json({ error: 'Please sign in.' });
  if (req.member.status !== 'approved') {
    return res.status(403).json({ error: 'Your account is waiting for approval.', status: req.member.status });
  }
  next();
}

function requireAdmin(req, res, next) {
  requireApproved(req, res, () => {
    if (req.member.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
    next();
  });
}

// Simple in-memory limiter: blocks a key once it has been counted `max` times within the window.
function makeLimiter(max, windowMs) {
  const attempts = new Map();
  return {
    blocked(key) {
      const a = attempts.get(key);
      return Boolean(a && a.resetAt > Date.now() && a.count >= max);
    },
    fail(key) {
      const a = attempts.get(key);
      if (!a || a.resetAt <= Date.now()) attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
      else a.count++;
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}

// Sign-in attempts: 10 failures per 15 minutes per IP + email.
const loginLimiter = makeLimiter(10, 15 * 60 * 1000);

module.exports = {
  hashPassword, verifyPassword, newToken, hashToken,
  setSessionCookie, clearSessionCookie, loadMember,
  requireSignedIn, requireApproved, requireAdmin, makeLimiter, loginLimiter,
};
