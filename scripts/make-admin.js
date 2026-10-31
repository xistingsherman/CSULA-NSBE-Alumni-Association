// Makes an existing account an approved admin.
// Usage: npm run make-admin -- someone@example.com
const store = require('../src/store');
const config = require('../src/config');

const email = (process.argv[2] || '').trim().toLowerCase();

(async () => {
  if (!email) {
    console.error('Usage: npm run make-admin -- someone@example.com');
    process.exit(1);
  }
  if (config.dbClient === 'memory') {
    console.error('make-admin only works with the Oracle database (DB_CLIENT=oracle).');
    process.exit(1);
  }
  await store.init();
  const found = await store.setRole(email, 'admin');
  await store.close();
  if (!found) {
    console.error(`No account found for ${email}. Sign up on the site first, then run this again.`);
    process.exit(1);
  }
  console.log(`${email} is now an approved admin.`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
