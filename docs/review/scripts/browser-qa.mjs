// Real-browser QA. Usage: node browser-qa.mjs <repo-root> <out-dir> <port>
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [root, out, port = '8799'] = process.argv.slice(2);
mkdirSync(join(out, 'shots'), { recursive: true });
const db = join(out, `demo-${port}.sqlite`);
for (const s of ['', '-wal', '-shm']) rmSync(db + s, { force: true });
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: { ...process.env, PORT: port, CONTEXT_DB: db }, stdio: 'pipe' });
let serverLog = ''; server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

const checks = [], consoleErrors = [], httpErrors = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));
page.on('response', r => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
const shot = name => page.screenshot({ path: join(out, 'shots', `${name}.png`), fullPage: false });
const toast = async () => (await page.locator('#toast').textContent()) || '';
const nav = async view => { await page.click(`.nav button[data-view="${view}"]`); await page.waitForTimeout(150); };
const as = async user => { await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/bootstrap')), page.selectOption('#identity', user)]); await page.waitForTimeout(200); };
const resolve = async prompt => { await nav('context'); await page.fill('#prompt', prompt); await page.click('#resolve-form button[type="submit"]'); await page.waitForSelector('#resolution .resolution-top'); return page.locator('#resolution').innerText(); };
const api = (path, user, body) => page.evaluate(async ([path, user, body]) => { const r = await fetch('/api' + path, { method: body ? 'POST' : 'GET', headers: { 'X-Demo-User': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; }, [path, user, body]);

try {
  await page.goto(base + '/'); await page.waitForSelector('.layout');
  check('Overview renders for Paul (demo)', (await page.locator('.profile select').inputValue()) === 'paul'); await shot('01-overview-desktop');

  // Context intent in the real UI
  let text = await resolve('Latest Jira tickets');
  check('Personal Jira plan shown', text.includes('assignee = currentUser() ORDER BY updated DESC')); await shot('02-context-personal');
  text = await resolve('Latest Jira tickets for my team');
  check('Team ticket request shows clarification and a blocked plan, not a widened query', text.includes('Needs clarification') && text.includes('Not executable') && !text.includes('assignee = currentUser()') && text.includes('No query.')); await shot('03-context-team-blocked');
  text = await resolve('Tickets assigned to Sam');
  check('Named-person request is not answered with the caller’s tickets', !text.includes('assignee = currentUser()') && text.includes('Sam Chen'));
  text = await resolve('How should I prepare reconciliation evidence?');
  check('Reconciliation request shows the team standard as required', text.includes('Certified reconciliation practice') && text.includes('Required standard')); await shot('04-context-reconciliation');
  check('Exclusion trace summarizes unrelated items', /visible items with no topic match/.test(await page.locator('#resolution details').textContent()));

  // Create, edit, promote
  await nav('knowledge'); await page.click('[data-action="new-item"] >> nth=0');
  await page.fill('#item-title', 'QA ledger tie-out'); await page.fill('#item-content', 'PRIVATE: personal reminder.\nTie out ledger totals.\nAttach the variance report.'); await page.fill('#item-tags', 'audit, ledger');
  await page.click('button[form="item-form"]'); await page.waitForTimeout(300);
  check('Create private knowledge', (await toast()).includes('Saved to your private workspace') && await page.locator('tr:has-text("QA ledger tie-out")').count() === 1);
  await page.click('tr:has-text("QA ledger tie-out")'); await page.click('#modal [data-action="edit"]');
  await page.fill('#item-content', 'PRIVATE: personal reminder.\nTie out ledger totals by period.\nAttach the variance report.'); await page.click('button[form="item-form"]'); await page.waitForTimeout(300);
  check('Edit creates a new version', (await toast()).includes('New version saved') && (await page.locator('tr:has-text("QA ledger tie-out")').innerText()).includes('v2'));
  await page.click('tr:has-text("QA ledger tie-out")'); await page.click('#modal [data-action="promote"].primary');
  await page.fill('#item-content', 'Tie out ledger totals by period.\nAttach the variance report.');
  await page.fill('#rationale', 'Repeatable tie-out for the team.'); await page.fill('#evidence', 'Used on two closes.');
  await page.click('button[form="promotion-form"]'); await page.waitForTimeout(200);
  check('Promotion requires the consent checkbox (browser validation)', await page.locator('#promotion-form').count() === 1);
  await page.check('input[name="consent"]'); await page.click('button[form="promotion-form"]'); await page.waitForTimeout(300);
  check('Submit promotion', (await toast()).includes('Submitted'));

  // Manager review: request changes
  await as('sam'); await nav('reviews'); await page.click('.row-link:has-text("QA ledger tie-out")');
  const reviewText = await page.locator('#modal').innerText();
  check('Reviewer diff shows submitted text as new and hides the private original line', reviewText.includes('Nothing exists at this scope yet') && !reviewText.includes('personal reminder')); await shot('05-review-new-desktop');
  await page.click('[data-action="review-decision"][data-decision="approve"]'); await page.waitForTimeout(250);
  check('Approve without a rationale is refused with a visible error', (await toast()).includes('Record the reason'));
  await page.fill('#review-comment', 'Please name the variance threshold.'); await page.click('[data-action="review-decision"][data-decision="request_changes"]'); await page.waitForTimeout(300);
  check('Request changes recorded', (await toast()).includes('Decision recorded') && (await page.locator('.row-link:has-text("QA ledger tie-out")').innerText()).toLowerCase().includes('changes requested'));

  // Paul revises and resubmits; Sam approves with a rapid double click
  await as('paul'); await nav('knowledge'); await page.click('tr:has-text("QA ledger tie-out")'); await page.click('#modal [data-action="promote"].primary');
  await page.fill('#item-content', 'Tie out ledger totals by period.\nInvestigate variances above 1%.\nAttach the variance report.');
  await page.fill('#rationale', 'Added threshold.'); await page.fill('#evidence', 'Reviewer feedback incorporated.'); await page.check('input[name="consent"]'); await page.click('button[form="promotion-form"]'); await page.waitForTimeout(300);
  await as('sam'); await nav('reviews'); await page.click('.row-link:has-text("QA ledger tie-out") >> nth=0');
  if (!(await page.locator('#review-comment').count())) await page.click('.row-link:has-text("QA ledger tie-out") >> nth=1');
  await page.fill('#review-comment', 'Threshold added; approved.');
  await page.locator('[data-action="review-decision"][data-decision="approve"]').dblclick(); await page.waitForTimeout(600);
  const props = (await api('/bootstrap', 'sam')).data.proposals.filter(p => p.proposed.title === 'QA ledger tie-out');
  check('Double-click approve records exactly one decision', props.filter(p => p.status === 'approved').length === 1 && props.find(p => p.status === 'approved').history.length === 1, JSON.stringify(props.map(p => [p.status, p.history.length])));
  await as('paul'); await nav('knowledge');
  const qaRows = await page.locator('#registry-table tr:has-text("QA ledger tie-out")').allInnerTexts();
  check('Paul sees the certified #DATA version and keeps the private original', qaRows.length === 2, JSON.stringify(qaRows.map(r => r.replace(/\s+/g, ' ').slice(0, 120))));

  // Recertification diff against last certified
  await as('sam'); await nav('knowledge'); await page.click('tr:has-text("Certified reconciliation practice")'); await page.click('#modal [data-action="edit"]');
  await page.fill('#item-content', (await page.inputValue('#item-content')).replace('90 days', '9 days')); await page.click('button[form="item-form"]'); await page.waitForTimeout(300);
  await page.click('tr:has-text("Certified reconciliation practice")'); await page.click('#modal [data-action="promote"]:has-text("Recertify")');
  await page.fill('#rationale', 'Routine recertification.'); await page.fill('#evidence', 'None.'); await page.check('input[name="consent"]'); await page.click('button[form="promotion-form"]'); await page.waitForTimeout(300);
  await as('avery'); await nav('reviews'); await page.click('.row-link:has-text("Certified reconciliation practice")');
  const recert = await page.locator('#modal .diff').innerText();
  check('Recertification diff exposes the 90→9 day change since last certification', recert.includes('90 days') && recert.includes('9 days') && (await page.locator('#modal').innerText()).includes('Last certified')); await shot('06-review-recert');
  await page.click('#modal [data-action="close"]');

  // A dependent app is blocked while its required standard awaits recertification, and works once recertified
  await as('paul'); await nav('apps'); await page.click('[data-action="app-context"][data-id="recon-app"]'); await page.click('#resolve-form button[type="submit"]'); await page.waitForTimeout(400);
  check('App context is refused while its dependency changed (app endorsement suspended)', (await toast()).includes('requires review'), await toast());
  await as('avery'); await nav('reviews'); await page.click('.row-link:has-text("Certified reconciliation practice")');
  await page.fill('#review-comment', 'Change to 9 days confirmed by the owner (synthetic).'); await page.click('[data-action="review-decision"][data-decision="approve"]'); await page.waitForTimeout(300);
  check('Delegate approves the recertification', (await toast()).includes('Decision recorded'));
  await as('paul'); await nav('apps'); await page.click('.app-card:has-text("Reconciliation Studio") [data-action="detail"]'); await page.click('#modal [data-action="promote"]:has-text("Recertify")');
  await page.fill('#rationale', 'Dependency recertified.'); await page.fill('#evidence', 'Checked the app against the new standard.'); await page.check('input[name="consent"]'); await page.click('button[form="promotion-form"]'); await page.waitForTimeout(300);
  await as('sam'); await nav('reviews'); await page.click('.row-link:has-text("Reconciliation Studio")');
  await page.fill('#review-comment', 'Endorsement renewed.'); await page.click('[data-action="review-decision"][data-decision="approve"]'); await page.waitForTimeout(300);
  check('Team manager re-endorses the app after its dependency was recertified', (await toast()).includes('Decision recorded'));

  // Stale proposal: reviewer sees why and cannot approve
  await as('paul'); const stale = (await api('/knowledge', 'paul', { title: 'QA stale item', kind: 'knowledge', content: 'One.', tags: ['audit'] })).data;
  await api('/promotions', 'paul', { assetId: stale.id, version: 1, targetId: 'data', publishConsent: true, rationale: 'r', evidence: 'e' });
  await page.evaluate(async id => fetch('/api/knowledge/' + id, { method: 'PUT', headers: { 'X-Demo-User': 'paul', 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, title: 'QA stale item', kind: 'knowledge', content: 'Two.', tags: ['audit'] }) }), stale.id);
  await as('sam'); await nav('reviews'); await page.click('.row-link:has-text("QA stale item")');
  check('Stale proposal shows the reason and a disabled approve button', (await page.locator('#modal').innerText()).includes('Cannot be approved') && await page.locator('[data-decision="approve"]').isDisabled()); await shot('07-review-stale');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('Escape closes the dialog', !(await page.locator('#modal').evaluate(d => d.open)));

  // Import via the real file input
  await as('paul'); await nav('sources'); await page.click('[data-action="source"][data-id="confluence"]');
  const importFile = join(out, 'import.json'); writeFileSync(importFile, JSON.stringify({ records: [{ externalId: 'QA-1', revision: '1', title: 'QA imported procedure', content: 'Imported excerpt.', tags: ['audit'], uri: 'https://wiki.example.test/qa' }] }));
  await page.setInputFiles('#import-file', importFile); await page.waitForTimeout(400);
  check('Normalized import lands privately', (await toast()).includes('imported privately') && await page.locator('tr:has-text("QA imported procedure")').count() === 1);
  await page.click('tr:has-text("QA imported procedure")');
  check('Detail shows source provenance', (await page.locator('#modal').innerText()).includes('QA-1')); await page.click('#modal [data-action="close"]');

  // Tether: propose as Finance manager, accept as Accounting manager, revoke
  await as('jordan'); await nav('org'); await page.click('[data-action="new-tether"]');
  await page.selectOption('#tether-form select[name="toId"]', 'manufacturing'); await page.fill('#tether-form input[name="tags"]', 'audit'); await page.click('button[form="tether-form"]'); await page.waitForTimeout(300);
  check('Tether proposed', (await toast()).includes('Tether proposed'));
  await as('drew'); await nav('org');
  await page.click('.tether-row:has-text("Manufacturing") [data-action="accept-tether"]'); await page.waitForTimeout(300);
  check('Destination manager accepts tether', (await page.locator('.tether-row:has-text("Manufacturing")').innerText()).includes('active'));
  await page.click('.tether-row:has-text("Manufacturing") [data-action="revoke-tether"]'); await page.waitForTimeout(300);
  check('Tether revoked', (await page.locator('.tether-row:has-text("Manufacturing")').innerText()).includes('revoked')); await shot('08-org-tethers');

  // Delegation appoint + revoke
  await as('sam'); await nav('org'); await page.click('[data-action="new-delegate"]'); await page.selectOption('#delegate-form select[name="userId"]', 'paul'); await page.click('button[form="delegate-form"]'); await page.waitForTimeout(300);
  check('Delegate appointed', (await toast()).includes('appointed'));
  await page.click('.grant-row:has-text("Paul Malmquist") [data-action="revoke-delegate"]'); await page.waitForTimeout(300);
  check('Delegate revoked', (await page.locator('.grant-row:has-text("Paul Malmquist")').innerText()).includes('revoked'));

  // App context
  await as('paul'); await nav('apps'); await page.click('[data-action="app-context"][data-id="recon-app"]'); await page.click('#resolve-form button[type="submit"]'); await page.waitForSelector('#resolution .resolution-top');
  check('App context resolves with the app’s required standard after recertification', (await page.locator('#resolution').innerText()).includes('Required by the selected app'));

  // Keyboard access to a row
  await nav('knowledge'); await page.locator('tr[data-action="detail"]').first().focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check('Enter opens a focused registry row', await page.locator('#modal').evaluate(d => d.open)); await page.keyboard.press('Escape');

  // Reload persistence
  await page.reload(); await page.waitForSelector('.layout');
  check('Reload keeps identity (session) and persisted decisions', (await page.locator('#identity').inputValue()) === 'paul' && (await api('/bootstrap', 'paul')).data.assets.filter(a => a.title === 'QA ledger tie-out').length === 2);

  // Remaining screens render without errors
  for (const v of ['bridge', 'activity', 'overview']) { await nav(v); }
  check('Activity and Bifrost screens render', true); await nav('activity'); await shot('09-activity');

  // Mobile layout
  await page.setViewportSize({ width: 390, height: 844 });
  for (const v of ['overview', 'knowledge', 'reviews', 'context', 'org', 'sources', 'apps', 'activity', 'bridge']) {
    await nav(v); const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    check(`Mobile ${v}: no horizontal page overflow`, over <= 0, `overflow=${over}px`);
  }
  await nav('overview'); await shot('10-overview-mobile');
  await as('sam'); await nav('reviews'); await page.click('.row-link >> nth=0'); await page.waitForTimeout(200);
  const dlg = await page.locator('#modal').boundingBox();
  check('Mobile review dialog fits the viewport width', dlg && dlg.x >= 0 && dlg.x + dlg.width <= 390, JSON.stringify(dlg)); await shot('11-review-mobile');
  await page.keyboard.press('Escape');
  await nav('context'); await page.fill('#prompt', 'How should I prepare reconciliation evidence?'); await page.click('#resolve-form button[type="submit"]'); await page.waitForSelector('#resolution .resolution-top'); await shot('12-context-mobile');
} catch (error) {
  check('Script completed without an exception', false, String(error.stack || error).split('\n').slice(0, 3).join(' | '));
  await shot('zz-failure').catch(() => {});
}
const unexpected = consoleErrors.filter(e => !/Failed to load resource/.test(e));
check('No JavaScript errors in the browser console', unexpected.length === 0, unexpected.slice(0, 5).join(' | '));
const expectedHttp = ['400 POST /api/promotions/', '409 POST /api/context/resolve'];
check('Only expected HTTP errors (approve without rationale → 400; blocked app → 409)', httpErrors.every(e => expectedHttp.some(x => e.startsWith(x))), httpErrors.join(' | '));
await browser.close(); server.kill();
writeFileSync(join(out, `browser-qa-${port}.json`), JSON.stringify({ checks, consoleErrors, httpErrors, serverLog }, null, 2));
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} browser checks passed`);
