import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('recruiters')
  .select('id, name')
  .order('created_at', { ascending: false });

if (error) { console.error(error.message); process.exit(1); }

// Flag names that look dirty: >3 words, or contain credential patterns
const CRED_PATTERN = /\b(SPHR|GPHR|PHR|BHR|MBA|PMP|SHRM|CIPD|HR|TA|AI|ML|RPA|Forbes|HBR|HRD)\b/i;
const dirty = data.filter(r => {
  const words = r.name.trim().split(/\s+/);
  return words.length > 3 || CRED_PATTERN.test(r.name);
});

console.log(`Total recruiters: ${data.length}`);
console.log(`Dirty names found: ${dirty.length}\n`);
dirty.slice(0, 30).forEach(r => console.log(`  [${r.id}]  ${r.name}`));
if (dirty.length > 30) console.log(`  ... and ${dirty.length - 30} more`);
