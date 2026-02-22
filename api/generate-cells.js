/**
 * Vercel serverless function: POST /api/generate-cells
 * Accepts a short user description + grid size, calls OpenAI Chat to return
 * a JSON array of { name, description } per cell (left-to-right, top-to-bottom).
 * Requires env: OPENAI_API_KEY
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function buildSystemPrompt(cellCount) {
  return (
    'You are a helpful assistant that generates grid cell content for an image prompt builder. ' +
    'Given a short user idea and a grid size, you must respond with a JSON array of exactly ' +
    cellCount +
    ' objects. Each object has two string fields: "name" (short label for the cell, e.g. "Apple") and "description" (optional longer description, can be empty string). ' +
    'Order: left-to-right, top-to-bottom (row 1 cell 1, row 1 cell 2, ...). ' +
    'Respond only with valid JSON, no markdown or extra text. Example: [{"name":"Apple","description":""},{"name":"Banana","description":""},...]'
  );
}

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

  const description = (body.description || '').trim();
  const gridSize = Math.min(4, Math.max(2, parseInt(body.gridSize, 10) || 4));
  const cellCount = gridSize * gridSize;

  if (!description) {
    return res.status(400).json({ error: 'Missing or empty description' });
  }

  const systemPrompt = buildSystemPrompt(cellCount);
  const userMessage =
    'User idea: "' +
    description +
    '". Grid is ' +
    gridSize +
    '×' +
    gridSize +
    ' (' +
    cellCount +
    ' cells). Return a JSON array of ' +
    cellCount +
    ' objects with "name" and "description" for each cell in order.';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      return res.status(status >= 500 ? 502 : status).json({
        error: 'OpenAI API error',
        details: errText || response.statusText,
      });
    }

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) {
      return res.status(502).json({ error: 'Unexpected OpenAI response format' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.status(502).json({ error: 'LLM did not return valid JSON', raw: content });
    }

    // Accept { cells: [...] }, { items: [...] }, direct array, or first array in object
    let cells = null;
    if (Array.isArray(parsed)) {
      cells = parsed;
    } else if (parsed && typeof parsed === 'object') {
      cells = parsed.cells || parsed.items || parsed.elements || parsed.grid;
      if (!Array.isArray(cells)) {
        const keys = Object.keys(parsed);
        for (let k = 0; k < keys.length; k++) {
          const v = parsed[keys[k]];
          if (Array.isArray(v) && v.length > 0) {
            cells = v;
            break;
          }
        }
      }
    }
    if (!Array.isArray(cells)) {
      return res.status(502).json({ error: 'LLM response missing cells array', raw: content.substring(0, 500) });
    }

    // Normalize to { name, description } and trim to cellCount
    cells = cells.slice(0, cellCount).map(function (c) {
      const name = (c && (c.name != null ? String(c.name) : c.title)) || '';
      const description = (c && (c.description != null ? String(c.description) : '')) || '';
      return { name: name.trim(), description: description.trim() };
    });

    // Pad if LLM returned fewer
    while (cells.length < cellCount) {
      cells.push({ name: '', description: '' });
    }

    return res.status(200).json({ cells });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
