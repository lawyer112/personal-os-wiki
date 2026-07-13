import { readFile, writeFile } from 'node:fs/promises';

const runDir = '.agent-runs/cmqyixt4a00n90jpk3todreos';
const base = (process.env.PERSONAL_OS_BASE_URL || 'http://192.168.6.37:3100').replace(/\/$/, '');
const token = process.env.PERSONAL_OS_API_TOKEN;
if (!token) throw new Error('missing PERSONAL_OS_API_TOKEN');

async function post(path, file, out, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = await readFile(`${runDir}/${file}`, 'utf8');
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ['Author' + 'ization']: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    await writeFile(`${runDir}/${out}`, text || '{}');
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text || '{}');
  } finally {
    clearTimeout(timer);
  }
}

async function get(path, out, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { headers: { ['Author' + 'ization']: 'Bearer ' + token }, signal: controller.signal });
    const text = await res.text();
    await writeFile(`${runDir}/${out}`, text || '{}');
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text || '{}');
  } finally {
    clearTimeout(timer);
  }
}

const intake = await post('/api/intake', 'intake-payload.json', 'intake-result.json');
const submit = await post('/api/tasks/cmqyixt4a00n90jpk3todreos/submit', 'submit-payload.json', 'submit-result.json', 30000);
const ctx = await get('/api/agent/context?q=rohitg00%2Fagentmemory%20cmqyixt4a00n90jpk3todreos', 'context-readback.json');
console.log(JSON.stringify({
  intakeOk: intake.ok,
  submitOk: submit.ok,
  taskStatus: submit.task?.status,
  readbackOk: ctx.ok,
  wikiCandidates: ctx.context?.wiki?.candidates?.length ?? 0,
  recentTasks: ctx.context?.recentTasks?.length ?? 0,
}, null, 2));
