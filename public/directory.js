// Member directory: loads approved members from /api/members and filters them in the browser.
// Each member's email and LinkedIn only arrive here if that member chose to share them.
// Uses api() and escapeHtml() from members.js.
const $ = (id) => document.getElementById(id);
const els = {
  q: $('q'), major: $('f-major'), industry: $('f-industry'), decade: $('f-decade'), city: $('f-city'),
  sort: $('sort'), results: $('results'), count: $('count'), empty: $('empty'), reset: $('reset'),
  dialog: $('profile'), dialogBody: $('profile-body'), notice: $('notice'), layout: $('dir-layout'),
  hasResume: $('f-resume'),
};
const openBoxes = [...document.querySelectorAll('input[name="open"]')];
let members = [];

const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);
const decadeOf = (year) => `${Math.floor(year / 10) * 10}s`;
const tags = (list) => list.map((o) => `<span class="tag">${escapeHtml(o)}</span>`).join('');

const fill = (select, values) => {
  [...new Set(values.filter(Boolean))].sort().forEach((v) => select.add(new Option(v, v)));
};

const filtered = () => {
  const q = els.q.value.trim().toLowerCase();
  const wanted = openBoxes.filter((b) => b.checked).map((b) => b.value);
  const list = members.filter((m) =>
    (!q || [m.name, m.company, m.title, m.major, m.city, m.industry, m.bio].join(' ').toLowerCase().includes(q)) &&
    (!els.hasResume.checked || m.hasResume) &&
    (!els.major.value || m.major === els.major.value) &&
    (!els.industry.value || m.industry === els.industry.value) &&
    (!els.city.value || m.city === els.city.value) &&
    (!els.decade.value || decadeOf(m.gradYear) === els.decade.value) &&
    wanted.every((w) => m.openTo.includes(w))
  );
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    newest: (a, b) => b.gradYear - a.gradYear || a.name.localeCompare(b.name),
    oldest: (a, b) => a.gradYear - b.gradYear || a.name.localeCompare(b.name),
  };
  return list.sort(sorters[els.sort.value]);
};

const jobLine = (m) => [m.title, m.company].filter(Boolean).map(escapeHtml).join(' · ');

const render = () => {
  const list = filtered();
  els.count.textContent = `${list.length} of ${members.length} members`;
  els.empty.hidden = list.length > 0;
  els.results.innerHTML = list.map((m) => `
    <li>
      <button class="member" data-id="${m.id}">
        <span class="avatar">${escapeHtml(initials(m.name))}</span>
        <span class="member-info">
          <strong>${escapeHtml(m.name)}</strong>
          <span class="member-role">${jobLine(m)}</span>
          <span class="member-meta">${escapeHtml(m.major)} '${String(m.gradYear).slice(2)}${m.city ? ` · ${escapeHtml(m.city)}` : ''}</span>
          <span class="tags">${tags(m.openTo)}${m.hasResume ? '<span class="tag tag-dark">Resume</span>' : ''}</span>
        </span>
      </button>
    </li>`).join('');
};

const showProfile = (m) => {
  const role = [m.title, m.company].filter(Boolean).map(escapeHtml).join(' at ');
  els.dialogBody.innerHTML = `
    <div class="profile-head">
      <span class="avatar lg">${escapeHtml(initials(m.name))}</span>
      <div>
        <h2 id="p-name">${escapeHtml(m.name)}</h2>
        ${role ? `<p>${role}</p>` : ''}
      </div>
    </div>
    ${m.bio ? `<p class="profile-bio">${escapeHtml(m.bio)}</p>` : ''}
    <dl class="profile-facts">
      <div><dt>Class</dt><dd>${m.gradYear}</dd></div>
      <div><dt>Major</dt><dd>${escapeHtml(m.major)}</dd></div>
      ${m.industry ? `<div><dt>Industry</dt><dd>${escapeHtml(m.industry)}</dd></div>` : ''}
      ${m.city ? `<div><dt>Location</dt><dd>${escapeHtml(m.city)}</dd></div>` : ''}
    </dl>
    ${m.openTo.length ? `<p class="profile-label">Open to</p><p class="tags">${tags(m.openTo)}</p>` : ''}
    <div class="profile-actions">
      ${m.hasResume ? `<a class="btn btn-small btn-dark" href="/api/members/${m.id}/resume">Download Resume</a>` : ''}
      ${m.email ? `<a class="btn btn-small" href="mailto:${escapeHtml(m.email)}">Email</a>` : ''}
      ${m.linkedinUrl ? `<a class="btn btn-small btn-outline" href="${escapeHtml(m.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
    </div>
    ${!m.email ? '<p class="muted">This member keeps their email private. Reach out on LinkedIn or at an event.</p>' : ''}`;
  els.dialog.showModal();
};

const showNotice = (html) => {
  els.notice.innerHTML = `<div class="container">${html}</div>`;
  els.notice.hidden = false;
};

async function load() {
  const { ok, status, data } = await api('/api/members');
  if (status === 401) return location.replace('login.html?next=directory.html');
  if (status === 403) {
    return showNotice('<strong>Almost there:</strong> your account is waiting for a board member\'s approval. '
      + 'You\'ll get an email when it\'s approved. Meanwhile, <a href="account.html">finish your profile</a>.');
  }
  if (!ok) return showNotice(escapeHtml(data.error || "Couldn't load the directory. Please refresh to try again."));

  members = data.members;
  fill(els.major, members.map((m) => m.major));
  fill(els.industry, members.map((m) => m.industry));
  fill(els.city, members.map((m) => m.city));
  [...new Set(members.map((m) => decadeOf(m.gradYear)))].sort().reverse()
    .forEach((d) => els.decade.add(new Option(d, d)));
  els.layout.hidden = false;
  render();

  api('/api/me').then(({ data: me }) => {
    if (me.member?.role === 'admin') document.querySelectorAll('[data-admin-only]').forEach((el) => { el.hidden = false; });
  });
}

els.results.addEventListener('click', (e) => {
  const card = e.target.closest('.member');
  if (card) showProfile(members.find((m) => String(m.id) === card.dataset.id));
});
els.dialog.addEventListener('click', (e) => {
  if (e.target === els.dialog || e.target.hasAttribute('data-close')) els.dialog.close();
});

[els.q, els.major, els.industry, els.decade, els.city, els.sort, els.hasResume, ...openBoxes]
  .forEach((el) => el.addEventListener('input', render));
els.reset.addEventListener('click', () => {
  els.q.value = '';
  els.hasResume.checked = false;
  [els.major, els.industry, els.decade, els.city].forEach((s) => { s.value = ''; });
  openBoxes.forEach((b) => { b.checked = false; });
  render();
});

load();
