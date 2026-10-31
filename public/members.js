// Shared code for the member pages: API calls, sign out, and each page's form.
const INDUSTRIES = [
  'Aerospace', 'Automotive', 'Construction & Infrastructure', 'Electronics & Hardware', 'Energy',
  'Finance', 'Government & Public Sector', 'Healthcare', 'Software & Tech', 'Other',
];
const OPEN_TO = ['Mentoring', 'Referrals', 'Coffee chats'];
const MAJORS = [
  'Chemical Engineering', 'Civil Engineering', 'Computer Engineering', 'Computer Science',
  'Electrical Engineering', 'Industrial Engineering', 'Mechanical Engineering',
];

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body || {});
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the server. Check your connection and try again." } };
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty response */ }
  return { ok: res.ok, status: res.status, data };
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = `form-status ${kind || ''}`;
}

// Only allow redirects to our own pages, e.g. "directory.html".
const safeNext = (n) => (n && /^[a-z0-9_-]+\.html(#[\w-]*)?$/i.test(n) ? n : 'directory.html');

document.querySelectorAll('[data-signout]').forEach((el) => el.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/logout', { method: 'POST' });
  location.href = 'login.html';
}));

// Profile fields shared by the sign-up and account pages
function profileFieldsHtml() {
  const opts = (list) => list.map((o) => `<option>${escapeHtml(o)}</option>`).join('');
  const boxes = OPEN_TO.map((o) => `<label class="check"><input type="checkbox" name="openTo" value="${o}"> ${o}</label>`).join('');
  return `
    <div class="row">
      <label>First name<input name="firstName" required maxlength="60" autocomplete="given-name"></label>
      <label>Last name<input name="lastName" required maxlength="60" autocomplete="family-name"></label>
    </div>
    <div class="row">
      <label>Graduation year<input name="gradYear" type="number" min="1950" max="${new Date().getFullYear() + 6}" required></label>
      <label>Major<input name="major" required maxlength="80" list="majors"></label>
    </div>
    <datalist id="majors">${opts(MAJORS)}</datalist>
    <div class="row">
      <label>Job title<input name="title" maxlength="100" autocomplete="organization-title"></label>
      <label>Company<input name="company" maxlength="100" autocomplete="organization"></label>
    </div>
    <div class="row">
      <label>Industry<select name="industry"><option value="">Choose one</option>${opts(INDUSTRIES)}</select></label>
      <label>City<input name="city" maxlength="80" placeholder="e.g. Los Angeles, CA"></label>
    </div>
    <label>LinkedIn profile<input name="linkedinUrl" type="url" maxlength="200" placeholder="https://www.linkedin.com/in/your-name"></label>
    <label>Bio
      <textarea name="bio" rows="5" maxlength="${BIO_MAX}" placeholder="A few sentences about your work, what you're interested in, and how you'd like to connect."></textarea>
      <span class="char-count" data-for="bio" aria-live="polite"></span>
    </label>
    <fieldset class="choices"><legend>Open to</legend>${boxes}</fieldset>
    <fieldset class="choices" id="privacy">
      <legend>Privacy</legend>
      <label class="check"><input type="checkbox" name="listed" checked> Show me in the member directory</label>
      <label class="check"><input type="checkbox" name="shareEmail"> Show my email to other members</label>
      <label class="check"><input type="checkbox" name="shareResume" checked> Let members download my resume</label>
    </fieldset>`;
}

const BIO_MAX = 1500;
const updateCount = (textarea) => {
  const counter = textarea.form?.querySelector(`.char-count[data-for="${textarea.name}"]`);
  if (counter) counter.textContent = `${textarea.value.length} / ${BIO_MAX}`;
};
document.addEventListener('input', (e) => { if (e.target.name === 'bio') updateCount(e.target); });

function readProfile(form) {
  const f = form.elements;
  return {
    firstName: f.firstName.value, lastName: f.lastName.value, gradYear: f.gradYear.value,
    major: f.major.value, title: f.title.value, company: f.company.value,
    industry: f.industry.value, city: f.city.value, linkedinUrl: f.linkedinUrl.value, bio: f.bio.value,
    openTo: [...form.querySelectorAll('[name="openTo"]:checked')].map((b) => b.value),
    listed: f.listed.checked, shareEmail: f.shareEmail.checked, shareResume: f.shareResume.checked,
  };
}

function fillProfile(form, m) {
  const f = form.elements;
  ['firstName', 'lastName', 'gradYear', 'major', 'title', 'company', 'industry', 'city', 'linkedinUrl', 'bio']
    .forEach((k) => { f[k].value = m[k] ?? ''; });
  form.querySelectorAll('[name="openTo"]').forEach((b) => { b.checked = m.openTo.includes(b.value); });
  f.listed.checked = Boolean(m.listed);
  f.shareEmail.checked = Boolean(m.shareEmail);
  f.shareResume.checked = Boolean(m.shareResume);
  updateCount(f.bio);
}

document.querySelectorAll('[data-profile-fields]').forEach((el) => { el.innerHTML = profileFieldsHtml(); });

const page = document.body.dataset.page;

if (page === 'login') {
  const form = document.getElementById('login-form');
  const status = form.querySelector('.form-status');
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  api('/api/me').then(({ ok }) => { if (ok) location.replace(next); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(status, 'Signing in…');
    const { ok, data } = await api('/api/login', {
      method: 'POST', body: { email: form.elements.email.value, password: form.elements.password.value },
    });
    if (!ok) return setStatus(status, data.error || 'Sign-in failed.', 'err');
    location.href = data.member.status === 'approved' ? next : 'account.html';
  });
}

if (page === 'signup') {
  const form = document.getElementById('signup-form');
  const status = form.querySelector('.form-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    if (f.password.value !== f.confirm.value) return setStatus(status, "Passwords don't match.", 'err');
    if (!form.reportValidity()) return;
    setStatus(status, 'Creating your account…');
    const { ok, data } = await api('/api/signup', {
      method: 'POST', body: { ...readProfile(form), email: f.email.value, password: f.password.value },
    });
    if (!ok) return setStatus(status, data.error || 'Sign-up failed.', 'err');
    form.hidden = true;
    document.getElementById('signup-done').hidden = false;
  });
}

if (page === 'account') {
  const form = document.getElementById('account-form');
  const status = form.querySelector('.form-status');
  api('/api/me').then(({ ok, data }) => {
    if (!ok) return location.replace('login.html?next=account.html');
    const m = data.member;
    document.getElementById('account-email').textContent = m.email;
    if (m.status === 'pending') document.getElementById('pending-notice').hidden = false;
    if (m.isTemp) document.getElementById('temp-notice').hidden = false;
    if (m.role === 'admin') document.querySelectorAll('[data-admin-only]').forEach((el) => { el.hidden = false; });
    fillProfile(form, m);
    form.hidden = false;
    showResume(m.resume);
    document.getElementById('resume-section').hidden = false;
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  });

  // Resume upload
  const resumeForm = document.getElementById('resume-form');
  const resumeStatus = resumeForm.querySelector('.form-status');
  const resumeInput = resumeForm.elements.resume;
  const MAX_BYTES = 5 * 1024 * 1024;

  function showResume(resume) {
    const current = document.getElementById('resume-current');
    const has = Boolean(resume);
    current.innerHTML = has
      ? `<strong>${escapeHtml(resume.name)}</strong> · uploaded ${new Date(resume.uploadedAt).toLocaleDateString()}`
      : 'No resume uploaded yet.';
    document.getElementById('resume-download').hidden = !has;
    document.getElementById('resume-remove').hidden = !has;
    resumeForm.querySelector('button[type="submit"]').textContent = has ? 'Replace Resume' : 'Upload Resume';
  }

  resumeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = resumeInput.files[0];
    if (!file) return setStatus(resumeStatus, 'Choose a PDF first.', 'err');
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      return setStatus(resumeStatus, 'Resumes must be PDF files.', 'err');
    }
    if (file.size > MAX_BYTES) return setStatus(resumeStatus, 'That file is over 5 MB. Please upload a smaller PDF.', 'err');

    const button = resumeForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(resumeStatus, 'Uploading…');
    const body = new FormData();
    body.append('resume', file);
    let result = { ok: false, data: { error: "Can't reach the server. Please try again." } };
    try {
      const res = await fetch('/api/me/resume', {
        method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' }, body,
      });
      result = { ok: res.ok, data: await res.json().catch(() => ({})) };
    } catch { /* keep the network error message */ }
    button.disabled = false;
    if (!result.ok) return setStatus(resumeStatus, result.data.error || 'Upload failed.', 'err');
    resumeForm.reset();
    showResume(result.data.member.resume);
    setStatus(resumeStatus, 'Resume uploaded.', 'ok');
  });

  document.getElementById('resume-remove').addEventListener('click', async () => {
    if (!confirm('Remove your resume? Members will no longer be able to download it.')) return;
    const { ok, data } = await api('/api/me/resume', { method: 'DELETE' });
    if (!ok) return setStatus(resumeStatus, data.error || 'Could not remove it.', 'err');
    showResume(null);
    setStatus(resumeStatus, 'Resume removed.', 'ok');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    setStatus(status, 'Saving…');
    const { ok, data } = await api('/api/me', { method: 'PUT', body: readProfile(form) });
    setStatus(status, ok ? 'Saved.' : data.error || 'Could not save.', ok ? 'ok' : 'err');
  });
}

if (page === 'admin') {
  const list = document.getElementById('pending');
  const status = document.getElementById('admin-status');
  const load = async () => {
    const { ok, status: code, data } = await api('/api/admin/pending');
    if (code === 401) return location.replace('login.html?next=admin.html');
    if (!ok) return setStatus(status, data.error || 'Could not load sign-ups.', 'err');
    setStatus(status, data.members.length ? `${data.members.length} waiting for approval` : 'No one is waiting for approval.');
    list.innerHTML = data.members.map((m) => `
      <li class="pending-item">
        <div>
          <strong>${escapeHtml(m.name)}</strong>
          <span>${escapeHtml(m.email)}</span>
          <span class="member-meta">${escapeHtml(m.major)} '${String(m.gradYear).slice(2)}${m.title ? ` · ${escapeHtml(m.title)}` : ''}${m.company ? ` at ${escapeHtml(m.company)}` : ''}</span>
        </div>
        <div class="pending-actions">
          <button class="btn btn-small" data-id="${m.id}" data-action="approve">Approve</button>
          <button class="btn btn-small btn-outline" data-id="${m.id}" data-action="reject">Reject</button>
        </div>
      </li>`).join('');
  };
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const name = btn.closest('.pending-item').querySelector('strong').textContent;
    if (btn.dataset.action === 'reject' && !confirm(`Reject ${name}? They won't be able to sign in.`)) return;
    btn.disabled = true;
    const { ok, data } = await api(`/api/admin/members/${btn.dataset.id}/${btn.dataset.action}`, { method: 'POST' });
    if (!ok) {
      btn.disabled = false;
      return setStatus(status, data.error || 'Something went wrong.', 'err');
    }
    load();
  });
  load();
}
