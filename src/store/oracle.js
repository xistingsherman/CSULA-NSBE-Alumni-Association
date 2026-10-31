const oracledb = require('oracledb');
const config = require('../config');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

let pool;

const cols = (p = '') => [
  'id', 'email', 'password_hash', 'member_status', 'member_role', 'first_name', 'last_name',
  'grad_year', 'major', 'job_title', 'company', 'industry', 'city', 'open_to',
  'linkedin_url', 'bio', 'resume_object', 'resume_name', 'resume_uploaded_at', 'share_resume',
  'share_email', 'listed', 'is_temp', 'created_at',
].map((c) => p + c).join(', ');

// Oracle returns upper-case column names and stores '' as NULL.
const toMember = (r) => r && {
  id: r.ID,
  email: r.EMAIL,
  passwordHash: r.PASSWORD_HASH,
  status: r.MEMBER_STATUS,
  role: r.MEMBER_ROLE,
  firstName: r.FIRST_NAME,
  lastName: r.LAST_NAME,
  gradYear: r.GRAD_YEAR,
  major: r.MAJOR || '',
  title: r.JOB_TITLE || '',
  company: r.COMPANY || '',
  industry: r.INDUSTRY || '',
  city: r.CITY || '',
  openTo: r.OPEN_TO ? r.OPEN_TO.split(',') : [],
  linkedinUrl: r.LINKEDIN_URL || '',
  bio: r.BIO || '',
  resumeObject: r.RESUME_OBJECT || null,
  resumeName: r.RESUME_NAME || null,
  resumeUploadedAt: r.RESUME_UPLOADED_AT || null,
  shareResume: r.SHARE_RESUME === 1,
  shareEmail: r.SHARE_EMAIL === 1,
  listed: r.LISTED === 1,
  isTemp: r.IS_TEMP === 1,
  createdAt: r.CREATED_AT,
};

const profileBinds = (p) => ({
  firstName: p.firstName,
  lastName: p.lastName,
  gradYear: p.gradYear,
  major: p.major,
  jobTitle: p.title,
  company: p.company,
  industry: p.industry,
  city: p.city,
  openTo: p.openTo.join(','),
  linkedinUrl: p.linkedinUrl,
  bio: p.bio,
  shareResume: p.shareResume ? 1 : 0,
  shareEmail: p.shareEmail ? 1 : 0,
  listed: p.listed ? 1 : 0,
});

async function run(sql, binds = {}) {
  const conn = await pool.getConnection();
  try {
    return await conn.execute(sql, binds);
  } finally {
    await conn.close();
  }
}

module.exports = {
  async init() {
    const { user, password, connectString } = config.oracle;
    if (!user || !password || !connectString) {
      throw new Error('Set ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING (or DB_CLIENT=memory for local testing).');
    }
    pool = await oracledb.createPool({ user, password, connectString, poolMin: 0, poolMax: 4 });
  },

  async close() {
    if (pool) await pool.close(5);
  },

  async createMember(m) {
    try {
      const result = await run(
        `INSERT INTO members (email, password_hash, member_status, member_role, first_name, last_name, grad_year,
           major, job_title, company, industry, city, open_to, linkedin_url, bio, share_resume, share_email, listed)
         VALUES (:email, :passwordHash, 'pending', 'member', :firstName, :lastName, :gradYear,
           :major, :jobTitle, :company, :industry, :city, :openTo, :linkedinUrl, :bio, :shareResume, :shareEmail, :listed)
         RETURNING id INTO :id`,
        {
          ...profileBinds(m),
          email: m.email,
          passwordHash: m.passwordHash,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      return this.getMember(result.outBinds.id[0]);
    } catch (err) {
      if (err.errorNum === 1) err.code = 'EMAIL_TAKEN'; // ORA-00001 unique constraint
      throw err;
    }
  },

  async findMemberByEmail(email) {
    const { rows } = await run(`SELECT ${cols()} FROM members WHERE email = :email`, { email });
    return toMember(rows[0]);
  },

  async getMember(id) {
    const { rows } = await run(`SELECT ${cols()} FROM members WHERE id = :id`, { id });
    return toMember(rows[0]);
  },

  async updateProfile(id, p) {
    await run(
      `UPDATE members SET first_name = :firstName, last_name = :lastName, grad_year = :gradYear, major = :major,
         job_title = :jobTitle, company = :company, industry = :industry, city = :city, open_to = :openTo,
         linkedin_url = :linkedinUrl, bio = :bio, share_resume = :shareResume, share_email = :shareEmail,
         listed = :listed, updated_at = SYSTIMESTAMP
       WHERE id = :id`,
      { ...profileBinds(p), id },
    );
    return this.getMember(id);
  },

  // resume = { object, name, uploadedAt }, or null to clear it
  async setResume(id, resume) {
    await run(
      `UPDATE members SET resume_object = :object, resume_name = :name, resume_uploaded_at = :uploadedAt,
         updated_at = SYSTIMESTAMP
       WHERE id = :id`,
      { object: resume?.object ?? null, name: resume?.name ?? null, uploadedAt: resume?.uploadedAt ?? null, id },
    );
    return this.getMember(id);
  },

  async listDirectory() {
    const { rows } = await run(
      `SELECT ${cols()} FROM members WHERE member_status = 'approved' AND listed = 1 ORDER BY last_name, first_name`,
    );
    return rows.map(toMember);
  },

  async listPending() {
    const { rows } = await run(`SELECT ${cols()} FROM members WHERE member_status = 'pending' ORDER BY created_at`);
    return rows.map(toMember);
  },

  async setStatus(id, status) {
    await run(
      'UPDATE members SET member_status = :newStatus, updated_at = SYSTIMESTAMP WHERE id = :id',
      { newStatus: status, id },
    );
    return this.getMember(id);
  },

  async setRole(email, role) {
    const result = await run(
      `UPDATE members SET member_role = :newRole, member_status = 'approved', updated_at = SYSTIMESTAMP
       WHERE email = :email`,
      { newRole: role, email },
    );
    return result.rowsAffected > 0;
  },

  async upsertTempAdmin(email, passwordHash) {
    const updated = await run(
      `UPDATE members SET password_hash = :passwordHash, member_status = 'approved', member_role = 'admin',
         updated_at = SYSTIMESTAMP
       WHERE email = :email AND is_temp = 1`,
      { email, passwordHash },
    );
    if (updated.rowsAffected) return;
    await run(
      `INSERT INTO members (email, password_hash, member_status, member_role, first_name, last_name, listed, is_temp)
       VALUES (:email, :passwordHash, 'approved', 'admin', 'Temporary', 'Admin', 0, 1)`,
      { email, passwordHash },
    );
  },

  // Sessions are removed too (ON DELETE CASCADE).
  async deleteTempAdmins() {
    const result = await run('DELETE FROM members WHERE is_temp = 1');
    return result.rowsAffected;
  },

  async createSession(tokenHash, memberId, expiresAt) {
    await run(
      'INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (:tokenHash, :memberId, :expiresAt)',
      { tokenHash, memberId, expiresAt },
    );
  },

  async getSessionMember(tokenHash) {
    const { rows } = await run(
      `SELECT ${cols('m.')} FROM sessions s JOIN members m ON m.id = s.member_id
       WHERE s.token_hash = :tokenHash AND s.expires_at > SYSTIMESTAMP`,
      { tokenHash },
    );
    return toMember(rows[0]);
  },

  async deleteSession(tokenHash) {
    await run('DELETE FROM sessions WHERE token_hash = :tokenHash', { tokenHash });
  },

  async deleteExpiredSessions() {
    await run('DELETE FROM sessions WHERE expires_at <= SYSTIMESTAMP');
  },

  async addJoinRequest(j) {
    await run(
      `INSERT INTO join_requests (first_name, last_name, email, grad_year, major, interest)
       VALUES (:firstName, :lastName, :email, :gradYear, :major, :interest)`,
      j,
    );
  },
};
