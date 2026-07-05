require('dotenv').config();

function normalizePort(value) {
  const port = parseInt(value, 10);
  if (Number.isNaN(port)) return value;
  if (port >= 0) return port;
  return false;
}

const PORT = normalizePort(
  process.env.PORT ||
  process.env.HTTP_PLATFORM_PORT ||
  '8080'
);

const MOBILE_APP_OAUTH_REDIRECT = (
  process.env.MOBILE_OAUTH_REDIRECT || 'betterchoicemobile://auth/callback'
).trim();

module.exports = { normalizePort, PORT, MOBILE_APP_OAUTH_REDIRECT };
