/**
 * Vercel serverless function: POST /api/generate-cells
 * AI-only quick idea generation for grid cells.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const nodeDns = require('node:dns');
const dns = nodeDns.promises;
// Prefer IPv4 first in Node runtime to avoid IPv6 path hangs/failures.
nodeDns.setDefaultResultOrder('ipv4first');

function debugLog(runId, hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7259/ingest/4e86ec95-c090-4163-bab8-8321b4a7442a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a7dcb4'},body:JSON.stringify({sessionId:'a7dcb4',runId:runId,hypothesisId:hypothesisId,location:location,message:message,data:data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

function buildSystemPrompt(cellCount, textCellIndices, brandingCellIndices) {
  const textRule = textCellIndices.length
    ? ('For TXT cells (indices ' + textCellIndices.join(', ') + '), generate wording-oriented content and start description with "TXT cell:".')
    : 'If there are TXT cells, their description must start with "TXT cell:".';
  const brandingRule = brandingCellIndices.length
    ? ('For BRD cells (indices ' + brandingCellIndices.join(', ') + '), start description with "BRD cell:".')
    : '';
  return (
    'Return a JSON object with a single key "cells". ' +
    '"cells" must be an array of exactly ' + cellCount + ' objects. ' +
    'Each object has "name" (short label) and "description" (can be ""). ' +
    'Order is left-to-right, top-to-bottom. ' +
    textRule + ' ' + brandingRule + ' ' +
    'Only valid JSON, no markdown. Example: {"cells":[{"name":"Apple","description":""},{"name":"Banana","description":""}]}'
  );
}

function buildResponseFormat(cellCount) {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'cells_response',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['cells'],
        properties: {
          cells: {
            type: 'array',
            minItems: cellCount,
            maxItems: cellCount,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'description'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' }
              }
            }
          }
        }
      }
    }
  };
}

function normalizeCells(parsed, cellCount, textCellIndices, brandingCellIndices) {
  const nameCandidates = ['name', 'title', 'label', 'item', 'value', 'text', 'word', 'keyword', 'cell', 'content'];
  const descCandidates = ['description', 'desc', 'details', 'detail', 'note', 'explanation', 'subtitle', 'context', 'prompt'];

  function mapObjectToArray(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const keys = Object.keys(obj);
    if (!keys.length) return null;
    const numericKeys = keys.every(function (k) { return /^\d+$/.test(k); });
    if (!numericKeys && keys.length <= 2) return null;
    const sorted = keys.slice().sort(function (a, b) {
      if (numericKeys) return parseInt(a, 10) - parseInt(b, 10);
      return a.localeCompare(b);
    });
    const vals = sorted.map(function (k) { return obj[k]; });
    return vals.length ? vals : null;
  }

  function pickCellsLike(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const maybe = JSON.parse(value);
        return pickCellsLike(maybe);
      } catch (_) {
        return null;
      }
    }
    if (value && typeof value === 'object') {
      const fromMap = mapObjectToArray(value);
      if (fromMap) return fromMap;
    }
    return null;
  }

  function scoreCandidate(arr) {
    var score = 0;
    var len = arr.length || 0;
    if (len === cellCount) score += 140;
    score += Math.min(len, cellCount) * 4;
    if (len === 1) score -= 30;
    var sample = arr.slice(0, Math.min(6, len));
    for (var i = 0; i < sample.length; i++) {
      var v = sample[i];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        var hasName = nameCandidates.some(function (k) { return v[k] != null && String(v[k]).trim(); });
        var hasDesc = descCandidates.some(function (k) { return v[k] != null && String(v[k]).trim(); });
        if (hasName) score += 20;
        if (hasDesc) score += 8;
      } else if (typeof v === 'string') {
        if (/\n/.test(v)) score += 10;
        if (/\b\d+[\)\.\-\:]\s*\w+/.test(v)) score += 20;
        if (v.trim().length > 3) score += 4;
      } else if (Array.isArray(v)) {
        score += 6;
      }
    }
    return score;
  }

  var candidates = [];
  function addCandidate(value, path) {
    var arr = pickCellsLike(value);
    if (!arr || !arr.length) return;
    candidates.push({
      path: path,
      length: arr.length,
      score: scoreCandidate(arr),
      data: arr
    });
  }

  function walk(value, path, depth) {
    if (depth > 4 || value == null) return;
    addCandidate(value, path);
    if (Array.isArray(value)) {
      for (var i = 0; i < Math.min(value.length, 8); i++) {
        walk(value[i], path + '[' + i + ']', depth + 1);
      }
      return;
    }
    if (typeof value === 'object') {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        walk(value[key], path + '.' + key, depth + 1);
      }
    }
  }

  walk(parsed, '$', 0);
  if (!candidates.length) return null;
  candidates.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.length - cellCount) - Math.abs(b.length - cellCount);
  });
  var chosen = candidates[0];
  var cells = chosen.data;

  function parseNumberedLinesFromText(text) {
    if (!text || typeof text !== 'string') return [];
    var lines = text.replace(/\r/g, '\n').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^\s*(\d+)\s*[\)\.\-:]\s*(.+?)\s*$/);
      if (m && m[2]) out.push(m[2]);
    }
    return out;
  }

  if (cells.length <= 2) {
    var textBag = [];
    (function collectStrings(v, depth) {
      if (depth > 4 || v == null || textBag.length > 40) return;
      if (typeof v === 'string') {
        if (v.trim()) textBag.push(v);
        return;
      }
      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) collectStrings(v[i], depth + 1);
        return;
      }
      if (typeof v === 'object') {
        var keys = Object.keys(v);
        for (var k = 0; k < keys.length; k++) collectStrings(v[keys[k]], depth + 1);
      }
    })(parsed, 0);
    for (var tb = 0; tb < textBag.length; tb++) {
      var parsedLines = parseNumberedLinesFromText(textBag[tb]);
      if (parsedLines.length >= Math.min(4, cellCount)) {
        cells = parsedLines.map(function (line) { return { name: line, description: '' }; });
        chosen = { path: chosen.path + '|numbered-lines', score: chosen.score + 200, length: cells.length };
        break;
      }
    }
  }

  const out = cells.slice(0, cellCount).map(function (c, idx) {
    let name = '';
    let description = '';
    if (typeof c === 'string' || typeof c === 'number') {
      name = String(c);
    } else if (Array.isArray(c)) {
      name = c[0] != null ? String(c[0]) : '';
      description = c[1] != null ? String(c[1]) : '';
    } else if (c && typeof c === 'object') {
      for (let i = 0; i < nameCandidates.length; i++) {
        const v = c[nameCandidates[i]];
        if (v != null && String(v).trim()) { name = String(v); break; }
      }
      for (let j = 0; j < descCandidates.length; j++) {
        const d = c[descCandidates[j]];
        if (d != null && String(d).trim()) { description = String(d); break; }
      }
      if (!name && typeof c.id === 'string') name = c.id;
    }
    name = name.trim();
    description = description.trim();
    if (textCellIndices.indexOf(idx + 1) !== -1 && !/^TXT cell:/i.test(description)) {
      description = description ? ('TXT cell: ' + description) : 'TXT cell: short wording/label only.';
    } else if (brandingCellIndices.indexOf(idx + 1) !== -1 && !/^BRD cell:/i.test(description)) {
      description = description ? ('BRD cell: ' + description) : 'BRD cell: brand wording/logo area.';
    }
    return { name: name.trim(), description: description };
  });
  while (out.length < cellCount) out.push({ name: '', description: '' });
  return {
    cells: out,
    meta: {
      chosenPath: chosen.path,
      chosenLength: chosen.length,
      chosenScore: chosen.score,
      candidateCount: candidates.length
    }
  };
}

module.exports = async function handler(req, res) {
  const runId = 'cells-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  debugLog(runId, 'H1', 'api/generate-cells.js:handler:entry', 'handler entry', {
    method: req.method,
    contentType: req.headers && req.headers['content-type'] ? req.headers['content-type'] : '',
    contentLength: req.headers && req.headers['content-length'] ? req.headers['content-length'] : ''
  });
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
    debugLog(runId, 'H2', 'api/generate-cells.js:body:parsed', 'body parsed', {
      hasDescription: !!(body && body.description),
      hasCellTypes: Array.isArray(body && body.cellTypes),
      providedCellCount: body && body.cellCount
    });
  } catch (e) {
    debugLog(runId, 'H2', 'api/generate-cells.js:body:parse-error', 'invalid json body', { error: e && e.message ? e.message : 'unknown' });
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const description = (body.description || '').trim();
  const rawCellTypes = Array.isArray(body.cellTypes) ? body.cellTypes : [];
  const textCellIndices = [];
  const brandingCellIndices = [];
  for (let i = 0; i < rawCellTypes.length; i++) {
    const t = String(rawCellTypes[i] || '').toLowerCase();
    if (t === 'text') textCellIndices.push(i + 1);
    if (t === 'branding') brandingCellIndices.push(i + 1);
  }
  let cellCount;
  let layoutLabel;
  if (body.cellCount != null && Number.isInteger(body.cellCount) && body.cellCount >= 1 && body.cellCount <= 100) {
    cellCount = body.cellCount;
    layoutLabel = (body.layout && typeof body.layout === 'string') ? body.layout : (cellCount + ' cells');
  } else {
    const gridSize = Math.min(4, Math.max(2, parseInt(body.gridSize, 10) || 4));
    cellCount = gridSize * gridSize;
    layoutLabel = gridSize + '×' + gridSize;
  }

  if (!description) {
    return res.status(400).json({ error: 'Missing or empty description' });
  }

  const systemPrompt = buildSystemPrompt(cellCount, textCellIndices, brandingCellIndices);
  const roleHint = textCellIndices.length || brandingCellIndices.length
    ? (' Cell roles: TXT=[' + (textCellIndices.join(',') || 'none') + '], BRD=[' + (brandingCellIndices.join(',') || 'none') + '].')
    : '';
  const userMessage = 'Idea: "' + description + '". Grid layout: ' + layoutLabel + ' (' + cellCount + ' cells).' + roleHint + ' Return JSON object with key "cells" only. "cells" must contain exactly ' + cellCount + ' objects with "name" and "description", ordered left-to-right top-to-bottom.';
  const host = String((req.headers && req.headers.host) || '').toLowerCase();
  const isLocalHost = host.indexOf('localhost') !== -1 || host.indexOf('127.0.0.1') !== -1;
  const defaultTimeoutMs = isLocalHost ? 60000 : 20000;
  const parsedTimeout = parseInt(process.env.CELLS_TIMEOUT_MS || String(defaultTimeoutMs), 10);
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(5000, Math.min(parsedTimeout, 120000))
    : defaultTimeoutMs;
  let dnsProbe = { ok: false };
  debugLog(runId, 'H3', 'api/generate-cells.js:pre-openai', 'prepared prompts', {
    cellCount: cellCount,
    textCells: textCellIndices.length,
    brandingCells: brandingCellIndices.length
  });

  debugLog(runId, 'H4', 'api/generate-cells.js:timeout', 'timeout computed', { parsedTimeout: parsedTimeout, timeoutMs: timeoutMs, host: host, isLocalHost: isLocalHost });
  // #region agent log
  console.error('[cells-debug]', JSON.stringify({
    runId: runId,
    hypothesisId: 'H6',
    location: 'api/generate-cells.js:network-setup',
    message: 'using ipv4first dns preference',
    data: { timeoutMs: timeoutMs },
    timestamp: Date.now()
  }));
  // #endregion
  try {
    const dnsResult = await dns.lookup('api.openai.com');
    dnsProbe = { ok: true, address: dnsResult.address, family: dnsResult.family };
    debugLog(runId, 'H5', 'api/generate-cells.js:dns:ok', 'dns lookup succeeded', dnsProbe);
    // #region agent log
    console.error('[cells-debug]', JSON.stringify({
      runId: runId,
      hypothesisId: 'H5',
      location: 'api/generate-cells.js:dns:ok',
      message: 'dns lookup succeeded',
      data: dnsProbe,
      timestamp: Date.now()
    }));
    // #endregion
  } catch (dnsErr) {
    dnsProbe = {
      ok: false,
      code: dnsErr && dnsErr.code ? dnsErr.code : '',
      message: dnsErr && dnsErr.message ? dnsErr.message : 'dns lookup failed'
    };
    debugLog(runId, 'H5', 'api/generate-cells.js:dns:error', 'dns lookup failed', dnsProbe);
    // #region agent log
    console.error('[cells-debug]', JSON.stringify({
      runId: runId,
      hypothesisId: 'H5',
      location: 'api/generate-cells.js:dns:error',
      message: 'dns lookup failed',
      data: dnsProbe,
      timestamp: Date.now()
    }));
    // #endregion
  }

  var lastErr = null;
  var probe = { ok: false, status: null, elapsedMs: null, error: null };
  try {
    const probeController = new AbortController();
    const probeTimeoutMs = 12000;
    const probeTimer = setTimeout(function () { probeController.abort(); }, probeTimeoutMs);
    const probeStarted = Date.now();
    const probeResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Return {"ok":true} as JSON.' }],
        response_format: { type: 'json_object' },
        max_tokens: 32,
        temperature: 0,
      }),
      signal: probeController.signal,
    });
    clearTimeout(probeTimer);
    probe = { ok: probeResp.ok, status: probeResp.status, elapsedMs: Date.now() - probeStarted, error: null };
    debugLog(runId, 'H7', 'api/generate-cells.js:probe', 'tiny probe completed', probe);
    // #region agent log
    console.error('[cells-debug]', JSON.stringify({
      runId: runId,
      hypothesisId: 'H7',
      location: 'api/generate-cells.js:probe',
      message: 'tiny probe completed',
      data: probe,
      timestamp: Date.now()
    }));
    // #endregion
  } catch (probeErr) {
    probe = {
      ok: false,
      status: null,
      elapsedMs: null,
      error: {
        name: probeErr && probeErr.name ? probeErr.name : 'unknown',
        message: probeErr && probeErr.message ? probeErr.message : 'unknown'
      }
    };
    debugLog(runId, 'H7', 'api/generate-cells.js:probe-error', 'tiny probe failed', probe);
    // #region agent log
    console.error('[cells-debug]', JSON.stringify({
      runId: runId,
      hypothesisId: 'H7',
      location: 'api/generate-cells.js:probe-error',
      message: 'tiny probe failed',
      data: probe,
      timestamp: Date.now()
    }));
    // #endregion
  }

  var maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
      debugLog(runId, 'H3', 'api/generate-cells.js:openai:start', 'openai fetch start', { timeoutMs: timeoutMs, attempt: attempt });
      var startedAt = Date.now();
      // #region agent log
      console.error('[cells-debug]', JSON.stringify({
        runId: runId,
        hypothesisId: 'H3',
        location: 'api/generate-cells.js:openai:start',
        message: 'openai fetch start',
        data: { attempt: attempt, timeoutMs: timeoutMs },
        timestamp: startedAt
      }));
      // #endregion
      var attemptUserMessage = userMessage;
      if (attempt > 1) {
        attemptUserMessage += ' IMPORTANT: your previous answer was incomplete. Return ALL ' + cellCount + ' cells in "cells" array.';
      }
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
            { role: 'user', content: attemptUserMessage },
          ],
          response_format: buildResponseFormat(cellCount),
          max_tokens: Math.min(900, Math.max(220, cellCount * 40)),
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      debugLog(runId, 'H3', 'api/generate-cells.js:openai:response', 'openai fetch response', { status: response.status, ok: response.ok, attempt: attempt });
      // #region agent log
      console.error('[cells-debug]', JSON.stringify({
        runId: runId,
        hypothesisId: 'H3',
        location: 'api/generate-cells.js:openai:response',
        message: 'openai fetch response',
        data: { attempt: attempt, status: response.status, ok: response.ok, elapsedMs: Date.now() - startedAt },
        timestamp: Date.now()
      }));
      // #endregion

      if (!response.ok) {
        const errText = await response.text();
        const status = response.status;
        return res.status(status >= 500 ? 502 : status).json({
          error: 'OpenAI API error',
          details: errText || response.statusText,
          runId: runId,
        });
      }

      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) {
        return res.status(502).json({ error: 'Unexpected OpenAI response format', runId: runId });
      }
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        return res.status(502).json({ error: 'LLM did not return valid JSON', raw: content, runId: runId });
      }
      const normalized = normalizeCells(parsed, cellCount, textCellIndices, brandingCellIndices);
      const cells = normalized && normalized.cells;
      if (!cells) {
        const parsedKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 12) : [];
        debugLog(runId, 'H8', 'api/generate-cells.js:shape-mismatch', 'normalized cells missing', {
          parsedType: typeof parsed,
          parsedKeys: parsedKeys,
          contentPreview: String(content).slice(0, 320)
        });
        // #region agent log
        console.error('[cells-debug]', JSON.stringify({
          runId: runId,
          hypothesisId: 'H8',
          location: 'api/generate-cells.js:shape-mismatch',
          message: 'normalized cells missing',
          data: { parsedType: typeof parsed, parsedKeys: parsedKeys, contentPreview: String(content).slice(0, 320) },
          timestamp: Date.now()
        }));
        // #endregion
        return res.status(502).json({ error: 'LLM response missing cells array', raw: content.substring(0, 500), runId: runId });
      }
      var filledNames = cells.filter(function (c) { return !!(c && c.name && String(c.name).trim()); }).length;
      var filledDescs = cells.filter(function (c) { return !!(c && c.description && String(c.description).trim()); }).length;
      debugLog(runId, 'H8', 'api/generate-cells.js:normalize-result', 'normalized cells summary', {
        total: cells.length,
        filledNames: filledNames,
        filledDescriptions: filledDescs,
        normalizeMeta: normalized.meta || null
      });
      // #region agent log
      console.error('[cells-debug]', JSON.stringify({
        runId: runId,
        hypothesisId: 'H8',
        location: 'api/generate-cells.js:normalize-result',
        message: 'normalized cells summary',
        data: { total: cells.length, filledNames: filledNames, filledDescriptions: filledDescs, normalizeMeta: normalized.meta || null },
        timestamp: Date.now()
      }));
      // #endregion
      if (filledNames < Math.max(2, Math.ceil(cellCount * 0.75))) {
        throw new Error('InsufficientFilledCells');
      }
      return res.status(200).json({ cells, runId: runId });
    } catch (err) {
      lastErr = err;
      const cause = err && err.cause ? {
        code: err.cause.code || '',
        message: err.cause.message || '',
        errno: err.cause.errno || '',
        syscall: err.cause.syscall || ''
      } : null;
      debugLog(runId, 'H1', 'api/generate-cells.js:attempt-error', 'attempt failed', {
        attempt: attempt,
        name: err && err.name ? err.name : 'unknown',
        message: err && err.message ? err.message : 'unknown',
        cause: cause
      });
      // #region agent log
      console.error('[cells-debug]', JSON.stringify({
        runId: runId,
        hypothesisId: 'H1',
        location: 'api/generate-cells.js:attempt-error',
        message: 'attempt failed',
        data: { attempt: attempt, name: err && err.name ? err.name : 'unknown', message: err && err.message ? err.message : 'unknown', cause: cause },
        timestamp: Date.now()
      }));
      // #endregion
      if (!(err && (
        err.name === 'AbortError' ||
        (err.name === 'TypeError' && /fetch failed/i.test(err.message || '')) ||
        (err.message === 'InsufficientFilledCells')
      )) || attempt === maxAttempts) {
        break;
      }
    }
  }

  try {
    const err = lastErr || new Error('Unknown OpenAI failure');
    const cause = err && err.cause ? {
      code: err.cause.code || '',
      message: err.cause.message || '',
      errno: err.cause.errno || '',
      syscall: err.cause.syscall || ''
    } : null;
    debugLog(runId, 'H1', 'api/generate-cells.js:final-error', 'final failure after retries', {
      name: err && err.name ? err.name : 'unknown',
      message: err && err.message ? err.message : 'unknown',
      cause: cause
    });
    if (err.name === 'AbortError') {
      return res.status(503).json({
        error: 'AI request timed out after retries.',
        details: 'OpenAI request exceeded timeout (' + timeoutMs + 'ms). DNS: ' + (dnsProbe.ok ? (dnsProbe.address + ' (IPv' + dnsProbe.family + ')') : (dnsProbe.code || 'lookup failed')) + '. Probe=' + JSON.stringify(probe),
        runId: runId,
      });
    }
    if (err && err.name === 'TypeError' && /fetch failed/i.test(err.message || '')) {
      return res.status(502).json({
        error: 'Unable to reach OpenAI API from server runtime.',
        details: cause && cause.message ? cause.message : 'Network/TLS/proxy issue while contacting api.openai.com',
        runId: runId,
        diagnostics: { cause: cause, dns: dnsProbe, probe: probe },
      });
    }
    if (err && err.message === 'InsufficientFilledCells') {
      return res.status(502).json({
        error: 'AI returned incomplete cells list.',
        details: 'Model response did not include enough populated cell names.',
        runId: runId,
      });
    }
    return res.status(500).json({ error: 'Server error', details: err.message, runId: runId, diagnostics: { cause: cause, dns: dnsProbe, probe: probe } });
  } catch (fatal) {
    return res.status(500).json({ error: 'Server error', details: fatal && fatal.message ? fatal.message : 'unknown', runId: runId });
  }
};
