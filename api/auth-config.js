/**
 * Serves Auth0 domain and client ID from env. Use .env locally and Vercel env in production.
 * These values are not secret (required in the browser for OAuth) but this keeps them out of committed frontend code.
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const domain = process.env.AUTH0_DOMAIN || '';
  const clientId = process.env.AUTH0_CLIENT_ID || '';
  return res.status(200).json({ domain, clientId });
};
