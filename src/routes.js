const express = require('express');
const multer = require('multer');
const config = require('./config');
const mail = require('./mail');
const files = require('./files');
const v = require('./validate');
const {
  hashPassword, verifyPassword, newToken, hashToken, setSessionCookie, clearSessionCookie,
  requireSignedIn, requireApproved, requireAdmin, makeLimiter, loginLimiter,
} = require('./auth');

// One confirmation email per address per day, so the forms can't be used to flood someone's inbox.
const confirmLimiter = makeLimiter(1, 24 * 60 * 60 * 1000);
const sendConfirmation = (to, subject, text) => {
  if (confirmLimiter.blocked(to)) return;
  confirmLimiter.fail(to);
  mail.send({ to, subject, text: `${text}\n\n- Cal State LA NSBE Alumni Association\n${config.siteUrl}` });
};

// Lets async handlers pass errors to Express's error handler.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// One PDF per upload, held in memory (max 5 MB) until it's checked and sent to storage.
const upload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8', // browsers send file names as UTF-8 ("Résumé.pdf"), not latin1
  limits: { fileSize: config.resumeMaxBytes, files: 1, fields: 5 },
}).single('resume');

const receiveResume = (req, res, next) => upload(req, res, (err) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That file is over 5 MB. Please upload a smaller PDF.' });
  }
  res.status(400).json({ error: 'Upload failed. Please choose one PDF file.' });
});

// Real PDFs start with "%PDF-", whatever the file is named.
const isPdf = (buffer) => buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';

module.exports = (store) => {
  const r = express.Router();

  // Changes must be sent as JSON, or (for resume uploads) as a file with the X-Requested-With header.
  // Plain cross-site HTML forms can do neither, which blocks CSRF.
  r.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.is('application/json')) return next();
    if (req.is('multipart/form-data') && req.get('X-Requested-With') === 'fetch') return next();
    res.status(415).json({ error: 'Requests must be sent as JSON.' });
  });

  // Home page "Join the alumni network" form
  r.post('/api/join', wrap(async (req, res) => {
    const b = req.body;
    const entry = {
      firstName: v.text(b.first, 60),
      lastName: v.text(b.last, 60),
      email: v.email(b.email),
      gradYear: v.year(b.year),
      major: v.text(b.major, 80),
      interest: v.text(b.interest, 80),
    };
    if (!entry.firstName || !entry.lastName || !entry.email) {
      return res.status(400).json({ error: 'Please fill in your name and a valid email.' });
    }
    await store.addJoinRequest(entry);
    mail.send({
      to: config.boardEmail,
      subject: `New alumni sign-up: ${entry.firstName} ${entry.lastName}`,
      text: [
        `Name: ${entry.firstName} ${entry.lastName}`,
        `Email: ${entry.email}`,
        `Graduation year: ${entry.gradYear || '-'}`,
        `Major: ${entry.major || '-'}`,
        `Interested in: ${entry.interest || '-'}`,
      ].join('\n'),
    });
    // Kept free of anything typed into the form, so it can't be used to send someone else a message.
    sendConfirmation(entry.email, 'We received your request to join the Cal State LA NSBE Alumni Association',
      'Thanks for signing up! The board has your request and will be in touch with event invites, '
      + 'career opportunities and alumni news.\n\n'
      + `Want to connect with other alumni? Create a member directory account: ${config.siteUrl}/signup.html\n\n`
      + "If you didn't sign up, you can ignore this email.");
    res.json({ ok: true });
  }));

  // Directory accounts
  r.post('/api/signup', wrap(async (req, res) => {
    const email = v.email(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email) return res.status(400).json({ error: 'Please enter a valid email.' });
    if (password.length < 10 || password.length > 200) {
      return res.status(400).json({ error: 'Password must be at least 10 characters.' });
    }
    const { profile, error } = v.profile(req.body);
    if (error) return res.status(400).json({ error });

    try {
      await store.createMember({ ...profile, email, passwordHash: await hashPassword(password) });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') {
        return res.status(409).json({ error: 'An account with that email already exists. Try signing in.' });
      }
      throw err;
    }
    mail.send({
      to: config.boardEmail,
      subject: `Directory account waiting for approval: ${v.fullName(profile)}`,
      text: `${v.fullName(profile)} (${email}, ${profile.major} '${String(profile.gradYear).slice(2)}) `
        + `created a directory account.\n\nReview it here: ${config.siteUrl}/admin.html`,
    });
    sendConfirmation(email, 'Your Cal State LA NSBE alumni directory account is waiting for approval',
      'Thanks for creating a member directory account! A board member will review it, and we\'ll email you '
      + 'as soon as it\'s approved.\n\n'
      + `Meanwhile, you can sign in and finish your profile: ${config.siteUrl}/account.html\n\n`
      + "If you didn't create this account, reply to this email and let us know.");
    res.status(201).json({ ok: true });
  }));

  r.post('/api/login', wrap(async (req, res) => {
    const email = v.email(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const key = `${req.clientIp}|${email}`;
    if (loginLimiter.blocked(key)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes and try again.' });
    }
    const member = email && await store.findMemberByEmail(email);
    const ok = member && member.passwordHash && await verifyPassword(password, member.passwordHash);
    if (!ok || member.status === 'rejected') {
      loginLimiter.fail(key);
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    loginLimiter.clear(key);
    const token = newToken();
    const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
    await store.createSession(hashToken(token), member.id, expires);
    setSessionCookie(res, token);
    res.json({ member: v.self(member) });
  }));

  r.post('/api/logout', wrap(async (req, res) => {
    if (req.sessionHash) await store.deleteSession(req.sessionHash);
    clearSessionCookie(res);
    res.json({ ok: true });
  }));

  r.get('/api/me', requireSignedIn, (req, res) => {
    res.json({ member: v.self(req.member) });
  });

  r.put('/api/me', requireSignedIn, wrap(async (req, res) => {
    const { profile, error } = v.profile(req.body);
    if (error) return res.status(400).json({ error });
    const member = await store.updateProfile(req.member.id, profile);
    res.json({ member: v.self(member) });
  }));

  // Resumes: members manage their own; approved members can download ones that are shared.
  r.post('/api/me/resume', requireSignedIn, receiveResume, wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please choose a PDF to upload.' });
    if (!isPdf(req.file.buffer)) return res.status(400).json({ error: 'Resumes must be PDF files.' });

    const old = req.member.resumeObject;
    const object = files.newObjectName(req.member.id);
    const name = files.safeFileName(req.file.originalname);
    await files.save(object, req.file.buffer, name);
    const member = await store.setResume(req.member.id, { object, name, uploadedAt: new Date() });
    if (old) await files.remove(old).catch((err) => console.error('Could not delete old resume:', err.message));
    res.json({ member: v.self(member) });
  }));

  r.delete('/api/me/resume', requireSignedIn, wrap(async (req, res) => {
    const old = req.member.resumeObject;
    const member = await store.setResume(req.member.id, null);
    if (old) await files.remove(old).catch((err) => console.error('Could not delete resume:', err.message));
    res.json({ member: v.self(member) });
  }));

  r.get('/api/me/resume', requireSignedIn, wrap(async (req, res) => {
    const m = req.member;
    if (!m.resumeObject) return res.status(404).json({ error: "You haven't uploaded a resume." });
    await files.send(res, m.resumeObject, `${m.firstName} ${m.lastName} Resume`);
  }));

  r.get('/api/members/:id/resume', requireApproved, wrap(async (req, res) => {
    const m = await store.getMember(parseInt(req.params.id, 10));
    if (!m || m.status !== 'approved' || !m.listed || !v.sharesResume(m)) {
      return res.status(404).json({ error: 'Resume not available.' });
    }
    await files.send(res, m.resumeObject, `${m.firstName} ${m.lastName} Resume`);
  }));

  // Member directory (approved members only)
  r.get('/api/members', requireApproved, wrap(async (req, res) => {
    const members = await store.listDirectory();
    res.json({ members: members.map(v.directoryEntry) });
  }));

  // Board approvals
  r.get('/api/admin/pending', requireAdmin, wrap(async (req, res) => {
    const pending = await store.listPending();
    res.json({ members: pending.map(v.pendingEntry) });
  }));

  r.post('/api/admin/members/:id/:action(approve|reject)', requireAdmin, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const member = await store.getMember(id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    const approved = req.params.action === 'approve';
    await store.setStatus(id, approved ? 'approved' : 'rejected');
    if (!approved && member.resumeObject) {
      // Don't keep files from people who were turned away.
      await store.setResume(id, null);
      await files.remove(member.resumeObject).catch((err) => console.error('Could not delete resume:', err.message));
    }
    if (approved) {
      mail.send({
        to: member.email,
        subject: 'Your Cal State LA NSBE alumni directory account is approved',
        text: `Hi ${member.firstName},\n\nYou now have access to the member directory: `
          + `${config.siteUrl}/directory.html\n\nYou can update your profile and privacy settings anytime at `
          + `${config.siteUrl}/account.html\n\n- Cal State LA NSBE Alumni Association`,
      });
    }
    res.json({ ok: true });
  }));

  r.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  return r;
};
