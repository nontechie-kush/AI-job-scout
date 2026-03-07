import fs from 'fs';

// ── Parse CSV (multiline-safe) ────────────────────────────────────────────────
function parseCSV(text) {
  const headers = [];
  const result = [];
  let row = [], cur = '', inQuote = false, headerDone = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      row.push(cur); cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(v => v)) {
        if (!headerDone) { headers.push(...row.map(h => h.trim())); headerDone = true; }
        else result.push(Object.fromEntries(headers.map((h, idx) => [h, (row[idx] || '').trim()])));
      }
      row = [];
    } else { cur += ch; }
  }
  if (cur || row.length) {
    row.push(cur);
    if (row.some(v => v) && headerDone)
      result.push(Object.fromEntries(headers.map((h, idx) => [h, (row[idx] || '').trim()])));
  }
  return result;
}

function q(v) { return '"' + String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; }

const csvPath = process.argv[2] || 'recruiters-export_v1.csv';
const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));

// Deduplicate by LinkedIn URL (same as import script)
const seen = new Set();
const unique = rows.filter(r => {
  if (!r.profileUrl || seen.has(r.profileUrl)) return false;
  seen.add(r.profileUrl);
  return true;
});

// Filter to confirmed recruiters only
const recruiterKeywords = ['recruit', 'talent', 'staffing', 'headhunt', 'talent acquisition', 'ta ', 'hr ', 'human resource'];
const filtered = unique.filter(r => {
  const h = (r.headline || '').toLowerCase();
  return recruiterKeywords.some(k => h.includes(k));
});

// Sort by sharedConnections (follower count) desc
filtered.sort((a, b) => {
  const parse = v => { const m = (v+'').match(/([\d.]+)\s*([kKmM]?)/); if (!m) return 0; const n = parseFloat(m[1]); return m[2].toLowerCase() === 'k' ? n*1000 : m[2].toLowerCase() === 'm' ? n*1000000 : n; };
  return parse(b.sharedConnections) - parse(a.sharedConnections);
});

const top = filtered;

const headers = ['fullName','headline','location','company','jobTitle','jobDateRange','company2','jobTitle2','jobDateRange2','school','schoolDegree','schoolDateRange','additionalInfo','sharedConnections','profileUrl'];
const outRows = top.map(r => headers.map(h => q(r[h])).join(','));

fs.writeFileSync('recruiters-qc.csv', [headers.join(','), ...outRows].join('\n'));
console.log(`Written recruiters-qc.csv — ${top.length} rows from ${filtered.length} confirmed recruiters`);
