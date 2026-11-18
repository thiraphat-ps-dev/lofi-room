// Checks that every built-in station in app.js still plays in an embedded player.
//
// It asks YouTube's oEmbed endpoint about each video (no API key needed):
//   200       fine
//   401 / 403 the owner turned embedding off
//   400 / 404 no such video any more: removed, made private, or a live stream that was replaced
// Anything else (rate limits, 5xx, network errors) is reported as "couldn't check" and does not
// fail the run, so a flaky day on YouTube's side doesn't open an issue.
//
// One thing it can't see: a live radio whose stream ended still answers 200, as a recording.
//
// Usage: node scripts/check-stations.mjs
// Exit code: 0 all fine, 1 some stations are broken (details in station-report.md), 2 script error.

import { readFile, writeFile, appendFile } from 'node:fs/promises';

const src = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const stations = [...src.matchAll(/group: '([^']*)', url: yt\('([\w-]{11})'\), title: '([^']*)'/g)].map(([, group, id, title]) => ({ group, id, title }));
if (!stations.length) {
  console.error('No stations found in app.js: has the STATIONS format changed?');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BROKEN = { 400: 'video not found', 401: 'embedding turned off', 403: 'embedding turned off', 404: 'removed or private' };

async function check(id) {
  const url = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id);
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      status = (await fetch(url, { headers: { 'user-agent': 'lofi-room-station-check' } })).status;
    } catch {
      status = 0;
    }
    if (status === 200 || status in BROKEN) return status;
    await sleep(2000 * (attempt + 1));
  }
  return status;
}

const broken = [];
const unknown = [];
for (const st of stations) {
  const status = await check(st.id);
  const line = `${String(status).padStart(3)}  ${st.id}  ${st.title}`;
  console.log(line);
  if (status in BROKEN) broken.push({ ...st, why: BROKEN[status] });
  else if (status !== 200) unknown.push({ ...st, why: status ? `HTTP ${status}` : 'network error' });
  await sleep(250); // be gentle
}

const link = (st) => `[\`${st.id}\`](https://www.youtube.com/watch?v=${st.id})`;
let report = `Checked ${stations.length} stations on ${new Date().toISOString().slice(0, 10)}.\n\n`;
if (broken.length) {
  report += `### No longer playable (${broken.length})\n\n| Group | Station | Video | Why |\n|---|---|---|---|\n`;
  report += broken.map((st) => `| ${st.group} | ${st.title} | ${link(st)} | ${st.why} |`).join('\n') + '\n\n';
  report += 'Replace or remove these in `STATIONS` in `app.js`. Until then the player skips them on its own.\n\n';
}
if (unknown.length) {
  report += `### Couldn't check (${unknown.length})\n\n`;
  report += unknown.map((st) => `- ${st.title} ${link(st)}: ${st.why}`).join('\n') + '\n';
}
if (!broken.length && !unknown.length) report += 'All stations play. 🎧\n';

console.log('\n' + report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
if (broken.length) {
  await writeFile('station-report.md', report);
  process.exit(1);
}
