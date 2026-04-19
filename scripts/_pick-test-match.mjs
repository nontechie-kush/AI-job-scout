import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const cwd = '/Users/kushendrasuryavanshi/Documents/claude code/AI job agent/careerpilot-ai';
const envFile = fs.readFileSync(path.join(cwd, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const userId = '0c9723e6-b226-4e04-8678-04153ce9aa68';

const { data, error } = await supabase
  .from('job_matches')
  .select('id, match_score, jobs(id, title, company)')
  .eq('user_id', userId)
  .gte('match_score', 60)
  .order('match_score', { ascending: false })
  .limit(10);

if (error) { console.error(error); process.exit(1); }

console.log(`Top ${data.length} PM matches for user:\n`);
for (const m of data) {
  console.log(`  [${String(m.match_score).padStart(3)}]  match=${m.id}  job=${m.jobs?.id}`);
  console.log(`         ${m.jobs?.title} @ ${m.jobs?.company}`);
}
