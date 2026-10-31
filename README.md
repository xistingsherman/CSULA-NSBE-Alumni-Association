# Cal State LA NSBE Alumni Association website

The public website plus a members-only directory, in one Node.js app.

- **Public pages:** home page with the "Join the alumni network" form (saved and emailed to the board).
- **Directory accounts:** alumni create an account, a board member approves it, then they can search the directory.
- **Profiles:** job, location, what they're open to, a bio (up to 1,500 characters), and an optional resume (PDF, up to 5 MB).
- **Privacy:** members choose whether they're listed, whether their email is shown, and whether other members can download their resume. Nothing in the directory is visible without signing in.
- **Data:** Oracle Database (Oracle Cloud Always Free works). Resumes are stored in a private Google Cloud Storage bucket.

## What's where

| Path | What it is |
|---|---|
| `app.js` | Starts the app (cPanel's "Application startup file") |
| `src/routes.js` | All `/api/...` endpoints |
| `src/auth.js` | Passwords, sign-in sessions, access checks |
| `src/validate.js` | Cleans form input; decides what other members can see |
| `src/store/oracle.js` | Oracle queries |
| `src/store/memory.js` | Throwaway sample data for local testing |
| `src/files.js` | Resume storage (GCP bucket, or `./uploads` when testing) |
| `src/mail.js` | Outgoing email |
| `public/` | The web pages, styles and browser scripts |
| `sql/` | Oracle setup scripts |
| `scripts/make-admin.js` | Gives a board member admin access |

## Try it on your computer

Needs Node.js 16 or newer (20+ to send real email, and on the live server).

```bash
npm install
cp .env.example .env
npm start
```

Open http://localhost:5173. With `DB_CLIENT=memory` it uses sample members that reset on every restart, emails are printed in the terminal instead of sent, and with `GCS_BUCKET` empty, uploaded resumes are saved in `./uploads`. To see the directory and the Approvals page, set `TEMP_ADMIN_EMAIL` and `TEMP_ADMIN_PASSWORD` in `.env` (any email and a 10+ character password), restart, and sign in with them.

## Put it online: Oracle Cloud + Google Cloud Storage + MochaHost cPanel

### 1. Set up the Oracle database

1. In Oracle Cloud, create an **Autonomous Database** (Always Free is fine).
2. Under **Network**, add an **access control list** entry with your MochaHost server's IP address (cPanel shows it under *General Information* as the shared IP; MochaHost support can confirm the outgoing IP). Then turn off **Mutual TLS (mTLS) authentication required**, so the app can connect without a wallet file.
3. Click **Database connection**, choose **TLS** authentication, and copy a connection string (the `_low` one is fine). That's your `ORACLE_CONNECT_STRING`.
4. Open **Database Actions > SQL** as ADMIN and run:
   - `sql/create-user.sql`, after changing the password in it (that's your `ORACLE_PASSWORD`; the user is `nsbe_app`).
   - `ALTER SESSION SET CURRENT_SCHEMA = nsbe_app;` and then `sql/schema.sql`.
   - Already created the tables before bios and resumes were added? Run `sql/add-bio-resume.sql` instead of recreating them.

### 2. Set up the Google Cloud Storage bucket for resumes

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one), then go to **Cloud Storage > Buckets > Create**.
   - Name: something unique, e.g. `calstatela-nsbe-alumni-resumes`. That's your `GCS_BUCKET`.
   - Location: a single region near you, e.g. `us-west2` (Los Angeles).
   - Storage class: Standard.
   - Access control: **Uniform**, with **Enforce public access prevention** turned on. Resumes must never be public; the app hands out short-lived download links only to signed-in members.
2. Go to **IAM & Admin > Service Accounts > Create service account**, named e.g. `nsbe-resumes`. Skip the optional project roles (it shouldn't get access to anything else).
3. Back on the bucket, open **Permissions > Grant access**: add the service account's email with the role **Storage Object Admin**. This lets it upload, read and delete files in this bucket only.
4. On the service account, go to **Keys > Add key > Create new key > JSON**. A file downloads. If key creation is blocked, your organization has a policy against keys (`iam.disableServiceAccountKeyCreation`), and an org admin needs to allow it for this project.
5. Rename that file `gcp-key.json`. Treat it like a password: anyone with it can read every resume. Don't email it or put it in `public/`.

### 3. Set up the app in cPanel

1. **Check with MochaHost** that your account can reach Oracle Cloud on port **1522** (outgoing).
2. In cPanel, create an email account for the site (e.g. `alumni@yourdomain.org`). Its outgoing mail server is usually `mail.yourdomain.org`, port 465.
3. Upload everything **except** `node_modules/`, `uploads/` and `.env` to a folder outside `public_html`, e.g. `/home/youruser/nsbe-alumni`. Upload `gcp-key.json` into that same folder (not inside `public/`) and set its permissions to `600`.
4. Open **Setup Node.js App** > **Create Application**:
   - Node.js version: **20 or newer**
   - Application mode: Production
   - Application root: `nsbe-alumni`
   - Application URL: your domain
   - Application startup file: `app.js`
5. In the app folder, create a file named `.env` (copy `.env.example`) with your real values:
   - `NODE_ENV=production`
   - `DB_CLIENT=oracle`
   - `SITE_URL=https://yourdomain.org`
   - `ORACLE_USER=nsbe_app`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`
   - `GCS_BUCKET=your-bucket-name` and `GOOGLE_APPLICATION_CREDENTIALS=/home/youruser/nsbe-alumni/gcp-key.json` (the full path)
   - `BOARD_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
   - `TEMP_ADMIN_EMAIL` and `TEMP_ADMIN_PASSWORD` only if you want the temporary admin login (see step 4). Otherwise delete those lines.

   Keep `.env` private: it holds your database and email passwords. In cPanel File Manager, set its permissions to `600`.

   If `GCS_BUCKET` is left empty, resumes are saved in the app's `uploads` folder on the server instead. That's fine for testing, but use the bucket for the real site.
6. Click **Run NPM Install**, then **Restart**.
7. Turn on **SSL/TLS** (AutoSSL / Let's Encrypt) for the domain so the site loads over `https://`. Sign-in cookies require it in production.

### 4. Make the first admin

**Quick option: temporary admin login.** Use this to get in right away, before anyone has an account.

1. In `.env`, set `TEMP_ADMIN_EMAIL` (an address that isn't a member's) and `TEMP_ADMIN_PASSWORD` (16+ characters on the live site).
2. Restart the app in Setup Node.js App, then sign in at `/login.html` with those details. You're an approved admin, and you're hidden from the directory.
3. **When you're done,** delete both lines and restart. The temporary account and all of its sign-ins are deleted. (To change its password instead, edit `TEMP_ADMIN_PASSWORD` and restart; the old password stops working.)

**Permanent option: make a real member an admin.**

1. On the live site, go to **Create Account** and sign up as yourself.
2. In **Setup Node.js App**, copy the "Enter to the virtual environment" command at the top of your app's page, then open cPanel **Terminal** and paste it.
3. Run:

   ```bash
   npm run make-admin -- you@yourdomain.org
   ```

4. Sign in. You'll see **Approvals** in the menu, where board members approve new accounts. Use the same command to make other board members admins.

## Still to do

- **Password reset:** members who forget their password are told to email the board for now. A self-service "forgot password" email can be added later.
- **Placeholders:** the home page events, stats, spotlight quotes, board names, social links, and the `alumni@example.org` address (also on the sign-in page) need real content.
- **Backups:** Oracle Autonomous Database keeps automatic backups, but also export the `members` table now and then. Oracle may stop Always Free databases that go unused for a while, so check Oracle's current terms.
