// Cal State LA NSBE Alumni Association: website + member directory API.
// cPanel "Setup Node.js App" uses this as the startup file.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./src/config');
const store = require('./src/store');
const routes = require('./src/routes');
const { loadMember } = require('./src/auth');
const { syncTempAdmin } = require('./src/temp-admin');

const app = express();

app.set('trust proxy', 1); // cPanel runs the app behind a proxy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      upgradeInsecureRequests: config.production ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '20kb' }));
app.use(loadMember(store));
app.use(routes(store));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong. Please try again.' });
});

store.init()
  .then(() => syncTempAdmin(store))
  .then(() => {
    app.listen(config.port, () => console.log(`Site running at http://localhost:${config.port}`));
    setInterval(() => store.deleteExpiredSessions().catch(console.error), 60 * 60 * 1000).unref();
  })
  .catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
