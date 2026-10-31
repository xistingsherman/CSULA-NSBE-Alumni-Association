const INDUSTRIES = [
  'Aerospace', 'Automotive', 'Construction & Infrastructure', 'Electronics & Hardware', 'Energy',
  'Finance', 'Government & Public Sector', 'Healthcare', 'Software & Tech', 'Other',
];
const OPEN_TO = ['Mentoring', 'Referrals', 'Coffee chats'];
const BIO_MAX = 1500;

const text = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function email(s) {
  const e = text(s, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
}

function year(n) {
  const y = parseInt(n, 10);
  return y >= 1950 && y <= new Date().getFullYear() + 6 ? y : null;
}

// Returns { profile } or { error } for the editable profile fields.
function profile(b = {}) {
  const p = {
    firstName: text(b.firstName, 60),
    lastName: text(b.lastName, 60),
    gradYear: year(b.gradYear),
    major: text(b.major, 80),
    title: text(b.title, 100),
    company: text(b.company, 100),
    industry: INDUSTRIES.includes(b.industry) ? b.industry : '',
    city: text(b.city, 80),
    openTo: Array.isArray(b.openTo) ? OPEN_TO.filter((o) => b.openTo.includes(o)) : [],
    linkedinUrl: text(b.linkedinUrl, 200),
    bio: text(b.bio, BIO_MAX).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n'),
    shareResume: b.shareResume !== false,
    shareEmail: b.shareEmail === true,
    listed: b.listed !== false,
  };
  if (!p.firstName || !p.lastName) return { error: 'Please enter your first and last name.' };
  if (!p.gradYear) return { error: 'Please enter a valid graduation year.' };
  if (!p.major) return { error: 'Please enter your major.' };
  if (p.linkedinUrl && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(p.linkedinUrl)) {
    return { error: 'LinkedIn link should start with https://www.linkedin.com/' };
  }
  return { profile: p };
}

const fullName = (m) => `${m.firstName} ${m.lastName}`;

// What a member sees about themselves. The bucket path stays on the server.
const self = ({ passwordHash, resumeObject, resumeName, resumeUploadedAt, ...m }) => ({
  ...m,
  resume: resumeObject ? { name: resumeName, uploadedAt: resumeUploadedAt } : null,
});

const sharesResume = (m) => Boolean(m.resumeObject && m.shareResume);

// What other members see in the directory: only what this member chose to share.
const directoryEntry = (m) => ({
  id: m.id,
  name: fullName(m),
  gradYear: m.gradYear,
  major: m.major,
  title: m.title,
  company: m.company,
  industry: m.industry,
  city: m.city,
  openTo: m.openTo,
  email: m.shareEmail ? m.email : null,
  linkedinUrl: m.linkedinUrl || null,
  bio: m.bio,
  hasResume: sharesResume(m),
});

const pendingEntry = (m) => ({
  id: m.id,
  name: fullName(m),
  email: m.email,
  gradYear: m.gradYear,
  major: m.major,
  title: m.title,
  company: m.company,
  createdAt: m.createdAt,
});

module.exports = {
  INDUSTRIES, OPEN_TO, BIO_MAX, text, email, year, profile, fullName, self, sharesResume, directoryEntry, pendingEntry,
};
