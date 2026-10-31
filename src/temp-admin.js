// Temporary admin login, controlled by TEMP_ADMIN_EMAIL and TEMP_ADMIN_PASSWORD.
// On startup:
//   - both set   -> the account exists, is an approved admin, and uses that password
//   - either unset -> the temporary account (and its sign-ins) is deleted
// So removing the two settings and restarting the app turns it off.
const config = require('./config');
const { hashPassword } = require('./auth');

const MIN_LENGTH = config.production ? 16 : 10;

async function syncTempAdmin(store) {
  const { email, password } = config.tempAdmin;
  if (!email || !password) {
    const removed = await store.deleteTempAdmins();
    if (removed) console.log('Temporary admin removed (TEMP_ADMIN_EMAIL / TEMP_ADMIN_PASSWORD are not set).');
    return;
  }
  if (password.length < MIN_LENGTH) {
    console.error(`Temporary admin NOT enabled: TEMP_ADMIN_PASSWORD must be at least ${MIN_LENGTH} characters.`);
    return;
  }
  const existing = await store.findMemberByEmail(email);
  if (existing && !existing.isTemp) {
    console.error(`Temporary admin NOT enabled: ${email} already belongs to a member account. `
      + 'Use a different email, or run "npm run make-admin" to make that member an admin.');
    return;
  }
  await store.upsertTempAdmin(email, await hashPassword(password));
  console.log(`Temporary admin enabled for ${email}. Remove TEMP_ADMIN_EMAIL / TEMP_ADMIN_PASSWORD and restart to turn it off.`);
}

module.exports = { syncTempAdmin };
