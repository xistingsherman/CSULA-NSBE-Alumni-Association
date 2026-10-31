// Checks that the database and resume bucket settings in .env work.
// Usage: npm run check
// Safe to run on the live server: it only reads the database, and the bucket test
// uploads one tiny file and deletes it again.
const config = require('../src/config');

let failed = false;
const ok = (msg) => console.log(`  OK    ${msg}`);
const bad = (msg, fix) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
  if (fix) console.log(`        → ${fix}`);
};

async function checkDatabase() {
  console.log('\nDatabase');
  if (config.dbClient !== 'mysql') return bad(`DB_CLIENT is "${config.dbClient}"`, 'Set DB_CLIENT=mysql');
  const { host, port, user, password, database } = config.mysql;
  if (!user || !database) return bad('MYSQL_USER or MYSQL_DATABASE is empty', 'Fill them in from cPanel > MySQL Databases');

  const mysql = require('mysql2/promise');
  let conn;
  try {
    conn = await mysql.createConnection({ host, port, user, password, connectTimeout: 15000 });
    ok(`signed in to ${host}:${port} as ${user}`);
  } catch (err) {
    const fixes = {
      ER_ACCESS_DENIED_ERROR: 'Wrong user or password. Reset it in cPanel > MySQL Databases > Current Users > Change Password.',
      ETIMEDOUT: 'Server not reachable. From your own computer, add your IP in cPanel > Remote MySQL; on the server itself, use MYSQL_HOST=localhost.',
      ECONNREFUSED: 'Connection refused. Check MYSQL_HOST and MYSQL_PORT (usually localhost and 3306).',
      ENOTFOUND: 'Host name not found. Check MYSQL_HOST.',
    };
    return bad(`can't connect: ${err.code} ${err.message}`, fixes[err.code]);
  }
  try {
    await conn.changeUser({ database });
    ok(`can use database ${database}`);
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map((r) => Object.values(r)[0]);
    const missing = ['members', 'sessions', 'join_requests'].filter((t) => !tables.includes(t));
    if (missing.length) bad(`missing tables: ${missing.join(', ')}`, 'Import sql/schema.sql in phpMyAdmin (select the database first).');
    else {
      const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM members');
      ok(`tables found (${n} member${n === 1 ? '' : 's'})`);
    }
  } catch (err) {
    if (err.code === 'ER_DBACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
      bad(`user ${user} can't use database ${database}`,
        'In cPanel > MySQL Databases > Add User To Database, add this user to this database with ALL PRIVILEGES. Also check the database name is exact.');
    } else bad(`${err.code} ${err.message}`);
  } finally {
    await conn.end();
  }
}

async function checkBucket() {
  console.log('\nResume bucket');
  if (!config.gcsBucket) return console.log('  SKIP  GCS_BUCKET is empty (resumes are saved in ./uploads)');
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const fs = require('fs');
  if (!keyFile || !fs.existsSync(keyFile)) {
    return bad(`GOOGLE_APPLICATION_CREDENTIALS doesn't point to a file ("${keyFile.slice(0, 12)}${keyFile.length > 12 ? '…' : ''}")`,
      'Set it to the path of the service account JSON key file, e.g. ./gcp-key.json');
  }
  try {
    const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    ok(`key file for ${key.client_email}`);
  } catch {
    return bad('key file is not valid JSON', 'Download a fresh JSON key from the service account in Google Cloud.');
  }

  const files = require('../src/files');
  const name = `checks/connection-test-${Date.now()}.pdf`;
  try {
    await files.save(name, Buffer.from('%PDF-1.4\nconnection test\n%%EOF\n'), 'test');
    ok(`uploaded a test file to ${config.gcsBucket}`);
  } catch (err) {
    return bad(`upload failed: ${err.message}`,
      'Give the service account the "Storage Object Admin" role on this bucket, and check GCS_BUCKET is exact.');
  }
  try {
    let url;
    await files.send({ set: () => ({ redirect: (code, u) => { url = u; } }) }, name, 'test');
    const res = await fetch(url);
    if (res.ok && (await res.text()).includes('connection test')) ok('signed download link works');
    else bad(`signed download link returned ${res.status}`);
  } catch (err) {
    bad(`signed download link failed: ${err.message}`);
  }
  try {
    await files.remove(name);
    ok('deleted the test file');
  } catch (err) {
    bad(`delete failed: ${err.message}`, `Delete ${name} from the bucket by hand, and give the account "Storage Object Admin".`);
  }
}

(async () => {
  await checkDatabase();
  await checkBucket();
  console.log(failed ? '\nSome checks failed.' : '\nAll checks passed.');
  process.exit(failed ? 1 : 0);
})();
