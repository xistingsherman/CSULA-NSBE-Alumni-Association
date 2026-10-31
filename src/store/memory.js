// In-memory store for trying the site locally (DB_CLIENT=memory).
// Data resets every time the server restarts. Never use this in production.
const sampleMembers = require('./sample-members');

let members = [];
let sessions = new Map();
const joinRequests = [];
let nextId = 1;

const copy = (m) => m && { ...m, openTo: [...m.openTo] };

module.exports = {
  async init() {
    members = sampleMembers.map((m) => ({
      id: nextId++,
      passwordHash: null, // sample people can't sign in
      status: 'approved',
      role: 'member',
      listed: true,
      bio: '',
      shareResume: true,
      resumeObject: null,
      resumeName: null,
      resumeUploadedAt: null,
      createdAt: new Date(),
      ...m,
    }));
    // A couple of sign-ups waiting for approval, so the admin page has something to show
    members.push(
      { id: nextId++, email: 'pending.one@example.com', passwordHash: null, status: 'pending', role: 'member', firstName: 'Sample', lastName: 'Pending', gradYear: 2024, major: 'Computer Science', title: '', company: '', industry: '', city: 'Los Angeles, CA', openTo: [], linkedinUrl: '', bio: '', shareResume: true, resumeObject: null, resumeName: null, resumeUploadedAt: null, shareEmail: false, listed: true, createdAt: new Date() },
    );
    console.log(`Memory store ready with ${members.length} sample members. Data resets on restart.`);
  },

  async close() {},

  async createMember(m) {
    if (members.some((x) => x.email === m.email)) {
      const err = new Error('Email taken');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
    const member = {
      ...m, id: nextId++, status: 'pending', role: 'member', resumeObject: null, resumeName: null, resumeUploadedAt: null,
      createdAt: new Date(),
    };
    members.push(member);
    return copy(member);
  },

  async findMemberByEmail(email) {
    return copy(members.find((m) => m.email === email));
  },

  async getMember(id) {
    return copy(members.find((m) => m.id === id));
  },

  async updateProfile(id, p) {
    const m = members.find((x) => x.id === id);
    if (m) Object.assign(m, p);
    return copy(m);
  },

  async setResume(id, resume) {
    const m = members.find((x) => x.id === id);
    if (m) {
      Object.assign(m, {
        resumeObject: resume?.object ?? null, resumeName: resume?.name ?? null, resumeUploadedAt: resume?.uploadedAt ?? null,
      });
    }
    return copy(m);
  },

  async listDirectory() {
    return members
      .filter((m) => m.status === 'approved' && m.listed)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .map(copy);
  },

  async listPending() {
    return members.filter((m) => m.status === 'pending').map(copy);
  },

  async setStatus(id, status) {
    const m = members.find((x) => x.id === id);
    if (m) m.status = status;
    return copy(m);
  },

  async setRole(email, role) {
    const m = members.find((x) => x.email === email);
    if (m) Object.assign(m, { role, status: 'approved' });
    return Boolean(m);
  },

  async upsertTempAdmin(email, passwordHash) {
    const m = members.find((x) => x.email === email && x.isTemp);
    if (m) {
      Object.assign(m, { passwordHash, status: 'approved', role: 'admin' });
      return;
    }
    members.push({
      id: nextId++, email, passwordHash, status: 'approved', role: 'admin', isTemp: true,
      firstName: 'Temporary', lastName: 'Admin', gradYear: null, major: '', title: '', company: '',
      industry: '', city: '', openTo: [], linkedinUrl: '', bio: '', shareResume: false, resumeObject: null,
      resumeName: null, resumeUploadedAt: null, shareEmail: false, listed: false, createdAt: new Date(),
    });
  },

  async deleteTempAdmins() {
    const temp = members.filter((m) => m.isTemp).map((m) => m.id);
    members = members.filter((m) => !m.isTemp);
    sessions = new Map([...sessions].filter(([, s]) => !temp.includes(s.memberId)));
    return temp.length;
  },

  async createSession(tokenHash, memberId, expiresAt) {
    sessions.set(tokenHash, { memberId, expiresAt });
  },

  async getSessionMember(tokenHash) {
    const s = sessions.get(tokenHash);
    if (!s || s.expiresAt <= new Date()) return undefined;
    return this.getMember(s.memberId);
  },

  async deleteSession(tokenHash) {
    sessions.delete(tokenHash);
  },

  async deleteExpiredSessions() {
    const now = new Date();
    sessions = new Map([...sessions].filter(([, s]) => s.expiresAt > now));
  },

  async addJoinRequest(j) {
    joinRequests.push({ ...j, createdAt: new Date() });
  },
};
