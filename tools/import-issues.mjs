#!/usr/bin/env node
import * as fs from 'node:fs';

// --- tiny CSV parser (handles quotes/commas) ---
function parseCSV(text) {
  const rows = [];
  let i = 0,
    cell = '',
    row = [],
    inQ = false;
  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    } else {
      if (ch === '"') {
        inQ = true;
        i++;
        continue;
      }
      if (ch === ',') {
        pushCell();
        i++;
        continue;
      }
      if (ch === '\r') {
        i++;
        continue;
      }
      if (ch === '\n') {
        pushCell();
        pushRow();
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
  }
  pushCell();
  pushRow();

  const [hdr, ...data] = rows.filter((r) => r.some((c) => (c || '').trim() !== ''));
  const cols = hdr.map((h) => h.trim());
  return data.map((r) => Object.fromEntries(cols.map((c, idx) => [c, (r[idx] || '').trim()])));
}

const splitLabels = (s) =>
  !s
    ? []
    : s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repo = (() => {
  const i = process.argv.indexOf('--repo');
  return i > -1 ? process.argv[i + 1] : null;
})();
const csvPath = (() => {
  const i = process.argv.indexOf('--csv');
  return i > -1 ? process.argv[i + 1] : 'tools/backlog_import.csv';
})();
const dryRun = process.argv.includes('--dry-run');

if (!repo) {
  console.error('Missing --repo <owner/name>');
  process.exit(1);
}
if (!token) {
  console.error('Set GITHUB_TOKEN or GH_TOKEN');
  process.exit(1);
}

const [owner, name] = repo.split('/');
const base = `https://api.github.com/repos/${owner}/${name}`;
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${token}`,
};

const text = fs.readFileSync(csvPath, 'utf8');
const rows = parseCSV(text);

async function fetchAll(url) {
  let out = [],
    page = 1;
  for (;;) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, {
      headers,
    });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const arr = await res.json();
    out = out.concat(arr);
    if (arr.length < 100) break;
    page++;
  }
  return out;
}

// Ensure labels
const existingLabels = (await fetchAll(`${base}/labels`)).map((l) => l.name.toLowerCase());
const neededLabels = Array.from(new Set(rows.flatMap((r) => splitLabels(r.Labels || r.labels))));
for (const lab of neededLabels) {
  if (!existingLabels.includes(lab.toLowerCase())) {
    if (dryRun) console.log(`[dry] create label: ${lab}`);
    else {
      const res = await fetch(`${base}/labels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: lab, color: '8b949e' }),
      });
      if (!res.ok && res.status !== 422) throw new Error(`Create label ${lab} -> ${res.status}`);
    }
  }
}

// Ensure milestone exists (by title)
const milestones = await fetchAll(`${base}/milestones?state=all`);
const msByTitle = new Map(milestones.map((m) => [m.title, m.number]));
async function ensureMilestone(title) {
  if (!title) return undefined;
  if (msByTitle.has(title)) return msByTitle.get(title);
  if (dryRun) {
    console.log(`[dry] create milestone: ${title}`);
    return undefined;
  }
  const res = await fetch(`${base}/milestones`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Create milestone ${title} -> ${res.status}`);
  const ms = await res.json();
  msByTitle.set(ms.title, ms.number);
  return ms.number;
}

// Create issues
let created = 0,
  skipped = 0;
for (const r of rows) {
  const title = r.Title || r.title;
  if (!title) {
    skipped++;
    continue;
  }
  const body = r.Body || r.body || '';
  const labels = splitLabels(r.Labels || r.labels);
  const milestoneTitle = r.Milestone || r.milestone || '';
  const milestone = await ensureMilestone(milestoneTitle);

  if (dryRun) {
    console.log(
      `[dry] issue: ${title} | labels=[${labels.join(', ')}] | milestone=${milestoneTitle}`,
    );
    continue;
  }

  const res = await fetch(`${base}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, body, labels, milestone }),
  });
  if (!res.ok) throw new Error(`Create issue "${title}" -> ${res.status}`);
  created++;
}
console.log(`Done. Created ${created} issues. Skipped ${skipped}.`);
