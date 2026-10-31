// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile nav
const toggle = document.querySelector('.nav-toggle');
const menu = document.getElementById('nav-menu');
toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
menu.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Count-up stats
const counters = document.querySelectorAll('[data-count]');
const countUp = (el) => {
  const target = +el.dataset.count;
  if (reduceMotion) { el.textContent = target; return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / 1400, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

// Reveal sections on scroll
document.querySelectorAll('.section .container, .hero-stats').forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    entry.target.querySelectorAll('[data-count]').forEach(countUp);
    io.unobserve(entry.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Spotlight carousel
const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const quotes = [...carousel.querySelectorAll('.quote')];
  const dots = carousel.querySelector('.dots');
  let current = 0;
  let timer;
  const show = (i) => {
    quotes[current].classList.remove('is-active');
    dots.children[current].setAttribute('aria-selected', 'false');
    current = i;
    quotes[current].classList.add('is-active');
    dots.children[current].setAttribute('aria-selected', 'true');
  };
  const autoplay = () => {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(() => show((current + 1) % quotes.length), 7000);
  };
  quotes.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Story ${i + 1}`);
    b.setAttribute('aria-selected', i === 0);
    b.addEventListener('click', () => { show(i); autoplay(); });
    dots.appendChild(b);
  });
  autoplay();
}

// Home page join form: sends to /api/join, which saves it and emails the board
const form = document.querySelector('.join-form[data-join]');
form?.addEventListener('submit', async (e) => {
  const status = form.querySelector('.form-status');
  e.preventDefault();
  let valid = true;
  form.querySelectorAll('[required]').forEach((input) => {
    const ok = input.value.trim() && input.checkValidity();
    input.classList.toggle('invalid', !ok);
    if (!ok) valid = false;
  });
  if (!valid) {
    status.textContent = 'Please fill in your name and a valid email.';
    status.className = 'form-status err';
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Sending…';
  status.className = 'form-status';
  const body = Object.fromEntries(new FormData(form));
  let ok = false;
  let message = "Can't reach the server. Please try again.";
  try {
    const res = await fetch('/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    ok = res.ok;
    if (!ok) message = (await res.json().catch(() => ({}))).error || 'Something went wrong. Please try again.';
  } catch { /* network error: keep default message */ }
  button.disabled = false;
  if (!ok) {
    status.textContent = message;
    status.className = 'form-status err';
    return;
  }
  status.textContent = `Thanks, ${body.first.trim()}! You're on the list.`;
  status.className = 'form-status ok';
  form.reset();
});
