#!/usr/bin/env node
/* Waits for Vercel's result for a commit and prints it:
     node scripts/deploy-status.js            (latest commit on this branch)
     node scripts/deploy-status.js fa3c770    (a specific commit)
   Exit code 0 = deployed, 1 = the deploy failed, 2 = no answer in time. For the build log itself, open the link it
   prints (or run the `npx vercel inspect ... --logs` command it shows). */
'use strict';
const { execFileSync } = require('child_process');

const sha = process.argv[2] || execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const remote = execFileSync('git', ['remote', 'get-url', 'origin']).toString().trim();
const repo = (remote.match(/github\.com[/:]([^/]+\/[^/.]+)/) || [])[1];
if (!repo) { console.error('Could not work out the GitHub repository from: ' + remote); process.exitCode = 2; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!repo) return;
  const deadline = Date.now() + 6 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const r = await fetch('https://api.github.com/repos/' + repo + '/commits/' + sha + '/status', { headers: { 'User-Agent': 'deploy-status' } });
    const d = await r.json();
    const v = (d.statuses || []).find((s) => /vercel/i.test(s.context));
    const line = v ? v.state + ' - ' + (v.description || '') : 'waiting for Vercel to report...';
    if (line !== last) { console.log(line); last = line; }
    if (v && v.state === 'success') { console.log('Deployed: ' + (v.target_url || '')); process.exitCode = 0; return; }
    if (v && (v.state === 'failure' || v.state === 'error')) { console.log('FAILED. Build log: ' + (v.target_url || '(link not provided)')); process.exitCode = 1; return; }
    await sleep(8000);
  }
  console.log('No result from Vercel within 6 minutes.');
  process.exitCode = 2;
})().catch((e) => { console.error(e.message); process.exitCode = 2; });
