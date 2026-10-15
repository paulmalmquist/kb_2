// Authenticated-mode browser QA. Usage: node auth-qa.mjs <repo-root> <out-dir> <port>
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
const [root, out, port] = process.argv.slice(2); mkdirSync(join(out, 'shots'), { recursive: true });
const db = join(out, `auth-${port}.sqlite`), idf = join(out, 'identity.json'); for (const s of ['', '-wal', '-shm']) rmSync(db + s, { force: true });
writeFileSync(idf, JSON.stringify({ units: [{ id: 'org', name: 'Example Org', kind: 'organization', parentId: null, managerId: 'owner' }, { id: 'red', name: 'Red Team', kind: 'team', parentId: 'org', managerId: 'lead' }],
  users: [{ id: 'owner', name: 'Org Owner', unitId: 'org' }, { id: 'lead', name: 'Red Lead', unitId: 'red' }, { id: 'kim', name: 'Kim Park', unitId: 'red' }] }));
const tok = { kim: randomBytes(24).toString('base64url'), lead: randomBytes(24).toString('base64url') };
const hashes = Object.fromEntries(Object.entries(tok).map(([u, t]) => [createHash('sha256').update(t).digest('hex'), u]));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: { ...process.env, CONTEXT_MODE: 'authenticated', HOST: '127.0.0.1', PORT: port, CONTEXT_DB: db, CONTEXT_IDENTITY_FILE: idf, CONTEXT_TOKEN_HASHES: JSON.stringify(hashes), CONTEXT_PUBLIC_ORIGIN: origin }, stdio: 'pipe' });
let log = ''; server.stdout.on('data', d => log += d); server.stderr.on('data', d => log += d);
for (let i = 0; i < 50; i++) { try { if ((await fetch(origin + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const checks = []; const check = (n, ok, d = '') => { checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' — ' + d : ''}`); };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
try {
  await page.goto(origin + '/'); await page.waitForSelector('#login-form');
  check('Authenticated mode shows the token login, not the workspace', await page.locator('.layout').count() === 0);
  await page.fill('#auth-token', 'wrong-token'); await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(300);
  check('Wrong token is refused with a visible message', (await page.locator('#toast').textContent()).includes('Invalid bearer credential') && await page.locator('.layout').count() === 0);
  await page.fill('#auth-token', tok.kim); await page.click('#login-form button[type="submit"]'); await page.waitForSelector('.layout');
  check('Valid token opens Kim’s workspace', (await page.locator('.profile').innerText()).includes('Kim Park'));
  check('No demo identity switcher in authenticated mode', await page.locator('#identity').count() === 0);
  await page.screenshot({ path: join(out, 'shots', 'auth-01-workspace.png') });
  const spoof = await page.evaluate(async () => (await fetch('/api/bootstrap', { headers: { 'X-Demo-User': 'owner' } })).status);
  check('Demo header without a bearer token is rejected (401)', spoof === 401, String(spoof));
  const body = await page.evaluate(async t => (await (await fetch('/api/context/resolve', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', 'X-Demo-User': 'owner' }, body: JSON.stringify({ prompt: 'Latest Jira tickets', userId: 'owner' }) })).json()).principal.id, tok.kim);
  check('Body/header identity spoofing ignored; principal comes from the token', body === 'kim', body);
  await page.reload(); await page.waitForSelector('#login-form');
  check('Reload clears the in-memory token (login shown again)', await page.locator('.layout').count() === 0);
  const cross = await fetch(origin + '/api/bootstrap', { headers: { Authorization: 'Bearer ' + tok.kim, Origin: 'https://evil.example' } });
  check('Cross-origin request with a valid token is rejected', cross.status === 403, String(cross.status));
} catch (e) { check('Script completed', false, String(e).slice(0, 300)); }
await browser.close(); server.kill();
writeFileSync(join(out, `auth-qa-${port}.json`), JSON.stringify({ checks, log }, null, 2));
console.log(`${checks.filter(c => c.ok).length}/${checks.length} authenticated checks passed`);
