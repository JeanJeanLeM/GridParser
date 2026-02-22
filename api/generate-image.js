/**
 * Vercel serverless function: POST /api/generate-image
 * Accepts a full prompt string, calls OpenAI Images API (GPT Image 1.5) to generate
 * the grid image. Returns image as base64 so the client can display/download
 * without relying on temporary URLs.
 * Requires env: OPENAI_API_KEY
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: OPENAI_API_KEY not set' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ error: 'Missing or empty prompt' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'gpt-image-1.5',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      return res.status(status >= 500 ? 502 : status).json({
        error: 'OpenAI Images API error',
        details: errText || response.statusText,
      });
    }

    const data = await response.json();
    const first = data.data && data.data[0];
    if (!first) {
      return res.status(502).json({ error: 'Unexpected OpenAI Images response format' });
    }

    if (first.b64_json) {
      return res.status(200).json({ imageBase64: first.b64_json });
    }
    if (first.url) {
      return res.status(200).json({ imageUrl: first.url });
    }

    return res.status(502).json({ error: 'No image data in response' });
  } catch (err) {
    console.error('generate-image error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
