/**
 * Vercel serverless function: GET /api/me
 * Validates Authorization: Bearer <token> against Auth0 JWKS and returns user payload.
 * Requires env: AUTH0_DOMAIN, AUTH0_AUDIENCE (optional; defaults to Auth0 API identifier).
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || null;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || null;

function getOptions() {
  const opts = {
    issuer: `https://${AUTH0_DOMAIN}/`,
    algorithms: ['RS256'],
  };
  const audience = AUTH0_AUDIENCE || AUTH0_CLIENT_ID;
  if (audience) opts.audience = audience;
  return opts;
}

function getSigningKey(header, callback) {
  const client = jwksClient({
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  });
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.publicKey || key?.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const options = getOptions();
    jwt.verify(token, getSigningKey, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!AUTH0_DOMAIN) {
    return res.status(500).json({ error: 'Server misconfiguration: AUTH0_DOMAIN not set' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  try {
    const decoded = await verifyToken(token);
    const user = {
      sub: decoded.sub,
      email: decoded.email || null,
      name: decoded.name || decoded.nickname || null,
    };
    return res.status(200).json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
