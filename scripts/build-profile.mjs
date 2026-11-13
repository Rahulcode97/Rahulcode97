#!/usr/bin/env node
// Builds the SVG cards used by README.md.
//
//   node scripts/build-profile.mjs          live data (needs tokens, see below)
//   node scripts/build-profile.mjs --mock   fake activity data, for previewing the design
//
// Tokens (all optional, but at least one is needed for live activity cards):
//   PERSONAL_GH_TOKEN  token for the personal account (falls back to GITHUB_TOKEN,
//                      which only sees public activity)
//   WORK_GH_TOKEN      classic PAT created on the work account. The work username is
//                      read from the token itself; WORK_GH_USER can override it.
//
// Only totals are written to the SVGs. Repository names, orgs and commit messages from
// the work account never leave this script.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");
const MOCK = process.argv.includes("--mock");
const cfg = JSON.parse(await readFile(join(ROOT, "profile.config.json"), "utf8"));

// ---------------------------------------------------------------- theme

const THEMES = {
  dark: {
    bg: "#0D1117", surface: "#141418", sunken: "#1A1A1F", line: "#26262C",
    ink: "#EDEDF0", soft: "#B0B1BA", muted: "#7D7F8A",
    primary: "#8B85FF", primary2: "#A5A0FF", accent: "#A3E635",
    heat: ["#1A1A1F", "#2E2A6B", "#4B44B8", "#7069F0", "#A5A0FF"],
  },
  light: {
    bg: "#FFFFFF", surface: "#FFFFFF", sunken: "#F5F5F6", line: "#E8E8EC",
    ink: "#0E0F14", soft: "#4A4C55", muted: "#8A8C96",
    primary: "#4F46E5", primary2: "#6366F1", accent: "#65A30D",
    heat: ["#EEEEF2", "#C7C4FB", "#9A94F5", "#6A62EC", "#4338CA"],
  },
};
const SANS = `'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace`;
const W = 840;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Number(n).toLocaleString("en-US");
// Rough text width; good enough to size chips and pills.
const textW = (s, size, bold = false) => [...String(s)].length * size * (bold ? 0.6 : 0.56);

function frame(t, h, body, { label } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img"${label ? ` aria-label="${esc(label)}"` : ""}>
<style>
  .sans{font-family:${SANS}} .mono{font-family:${MONO}}
  .kicker{font:600 11px ${MONO};letter-spacing:.12em;fill:${t.muted};text-transform:uppercase}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="14" fill="${t.surface}" stroke="${t.line}"/>
${body}
</svg>
`;
}

function kicker(t, x, y, text, dot = true) {
  return `${dot ? `<circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${t.accent}"/>` : ""}
<text x="${x + (dot ? 16 : 0)}" y="${y}" class="kicker">${esc(text)}</text>`;
}

// ---------------------------------------------------------------- cards

function hero(t) {
  const h = 230;
  // Dot field on the right: a nod to the 10-PC fleet and a contribution grid.
  const cols = 14, rows = 7, s = 16, x0 = W - 40 - cols * s, y0 = 52;
  let dots = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = Math.sin(c * 0.9 + r * 1.7) * Math.cos(c * 0.35 - r * 0.6);
    const lvl = Math.max(0, Math.min(4, Math.round((v + 1) * 2)));
    const lime = (r * cols + c) % 23 === 7;
    const delay = ((c + r) * 0.18).toFixed(2);
    dots += `<rect x="${x0 + c * s}" y="${y0 + r * s}" width="11" height="11" rx="3" fill="${lime ? t.accent : t.heat[lvl]}" class="p" style="animation-delay:${delay}s"/>`;
  }
  const body = `
<style>
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  .p{animation:pulse 4.8s ease-in-out infinite}
  @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
  .cursor{animation:blink 1.1s step-end infinite}
</style>
<defs>
  <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${t.primary}"/><stop offset="1" stop-color="${t.primary2}"/>
  </linearGradient>
</defs>
${kicker(t, 40, 58, "hello, world — i build & run production systems")}
<text x="40" y="112" class="sans" font-size="44" font-weight="700" fill="${t.ink}" letter-spacing="-0.02em">${esc(cfg.name)}<tspan fill="url(#g)">.</tspan></text>
<text x="40" y="146" class="sans" font-size="17" font-weight="600" fill="${t.primary}">${esc(cfg.role)}</text>
<text x="40" y="178" class="sans" font-size="15" fill="${t.soft}">${esc(cfg.tagline)}<tspan class="cursor" fill="${t.accent}"> ▍</tspan></text>
${dots}`;
  return frame(t, h, body, { label: `${cfg.name}, ${cfg.role}` });
}

function impact(t) {
  const items = cfg.impact.slice(0, 6);
  const cols = 3, pad = 28, gap = 14, top = 64, tileH = 92;
  const tileW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(items.length / cols);
  const h = top + rows * tileH + (rows - 1) * gap + pad;
  let tiles = "";
  items.forEach((it, i) => {
    const x = pad + (i % cols) * (tileW + gap), y = top + Math.floor(i / cols) * (tileH + gap);
    tiles += `<rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="10" fill="${t.sunken}"/>
<rect x="${x}" y="${y + 18}" width="3" height="30" rx="1.5" fill="${i % 3 === 1 ? t.accent : t.primary}"/>
<text x="${x + 20}" y="${y + 44}" class="sans" font-size="28" font-weight="700" fill="${t.ink}" letter-spacing="-0.01em">${esc(it.value)}</text>
<text x="${x + 20}" y="${y + 70}" class="sans" font-size="12.5" fill="${t.soft}">${esc(it.label)}</text>`;
  });
  return frame(t, h, `${kicker(t, pad, 40, "Impact · real outcomes from systems I run")}\n${tiles}`, { label: "Impact metrics" });
}

function stack(t) {
  const pad = 28, top = 64, rowH = 40, labelW = 110;
  const h = top + cfg.stack.length * rowH + pad - 8;
  let rows = "";
  cfg.stack.forEach((g, r) => {
    const y = top + r * rowH;
    rows += `<text x="${pad}" y="${y + 19}" class="mono" font-size="11.5" font-weight="600" fill="${t.muted}" letter-spacing=".06em">${esc(g.group.toUpperCase())}</text>`;
    let x = pad + labelW;
    g.items.forEach((item, i) => {
      const w = textW(item, 13) + 26;
      const hot = i === 0;
      rows += `<rect x="${x}" y="${y}" width="${w}" height="28" rx="14" fill="${hot ? t.primary : t.sunken}" ${hot ? "" : `stroke="${t.line}"`}/>
<text x="${x + w / 2}" y="${y + 18.5}" text-anchor="middle" class="sans" font-size="13" font-weight="${hot ? 600 : 500}" fill="${hot ? t.bg : t.ink}">${esc(item)}</text>`;
      x += w + 8;
    });
  });
  return frame(t, h, `${kicker(t, pad, 40, "Stack · what I ship with today")}\n${rows}`, { label: "Tech stack" });
}

function activity(t, d) {
  const pad = 28;
  const stats = [
    ["Commits", fmt(d.commits)],
    ["Repos contributed to", fmt(d.repos)],
    ["Last 30 days", fmt(d.last30)],
    ["Longest streak", `${d.longestStreak} days`],
    ["Peak day", fmt(d.peak)],
    ["Busiest weekday", d.busiestDay],
  ];
  // Left: headline number. Right: 3x2 stat grid.
  const gx = 300, gw = (W - gx - pad) / 3;
  let grid = "";
  stats.forEach(([k, v], i) => {
    const x = gx + (i % 3) * gw, y = 78 + Math.floor(i / 3) * 56;
    grid += `<text x="${x}" y="${y}" class="sans" font-size="22" font-weight="700" fill="${t.ink}">${esc(v)}</text>
<text x="${x}" y="${y + 20}" class="sans" font-size="12" fill="${t.muted}">${esc(k)}</text>`;
  });

  // Heatmap, 53 weeks x 7 days, aligned so the last column is the current week.
  const cell = 11, gap = 3, step = cell + gap;
  const hx = pad + 26, hy = 196;
  const max = Math.max(1, ...d.days.map((x) => x.count));
  const q = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3.999)));
  let heat = "", months = "";
  const first = new Date(d.days[0].date + "T00:00:00Z");
  const offset = first.getUTCDay();
  let lastMonth = -1;
  d.days.forEach((day, i) => {
    const idx = i + offset, col = Math.floor(idx / 7), row = idx % 7;
    heat += `<rect x="${hx + col * step}" y="${hy + row * step}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[q(day.count)]}"><title>${day.date}: ${day.count}</title></rect>`;
    const m = new Date(day.date + "T00:00:00Z").getUTCMonth();
    if (row === 0 && m !== lastMonth && col < 52) {
      months += `<text x="${hx + col * step}" y="${hy - 8}" class="sans" font-size="10.5" fill="${t.muted}">${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]}</text>`;
      lastMonth = m;
    }
  });
  const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]].map(([l, r]) =>
    `<text x="${pad}" y="${hy + r * step + 9}" class="sans" font-size="10" fill="${t.muted}">${l}</text>`).join("");

  const legendX = W - pad - 5 * step - 64, legendY = hy + 7 * step + 16;
  const legend = `<text x="${legendX}" y="${legendY + 9}" class="sans" font-size="10.5" fill="${t.muted}">Less</text>` +
    t.heat.map((c, i) => `<rect x="${legendX + 28 + i * step}" y="${legendY}" width="${cell}" height="${cell}" rx="2.5" fill="${c}"/>`).join("") +
    `<text x="${legendX + 32 + 5 * step}" y="${legendY + 9}" class="sans" font-size="10.5" fill="${t.muted}">More</text>`;

  const h = legendY + cell + pad;
  const note = `${d.sources} · updated ${d.updated}`;
  const body = `${kicker(t, pad, 40, "GitHub activity · last 12 months")}
<text x="${pad}" y="112" class="sans" font-size="54" font-weight="700" fill="${t.ink}" letter-spacing="-0.03em">${fmt(d.total)}</text>
<text x="${pad}" y="136" class="sans" font-size="13" fill="${t.soft}">contributions this year</text>
<text x="${pad}" y="158" class="sans" font-size="12" fill="${t.muted}">across ${fmt(d.activeDays)} active days</text>
<line x1="${gx - 28}" y1="58" x2="${gx - 28}" y2="162" stroke="${t.line}"/>
${grid}
${months}${dayLabels}${heat}
<text x="${pad}" y="${legendY + 9}" class="sans" font-size="10.5" fill="${t.muted}">${esc(note)}</text>
${legend}`;
  return frame(t, h, body, { label: `${d.total} GitHub contributions in the last 12 months` });
}

function languages(t, langs) {
  const pad = 28, barY = 62, barH = 12;
  const total = langs.reduce((a, l) => a + l.size, 0) || 1;
  const palette = [t.primary, t.accent, "#38BDF8", "#FBBF24", "#F472B6", "#94A3B8"];
  let x = pad, bar = "";
  const bw = W - pad * 2;
  langs.forEach((l, i) => {
    const w = (l.size / total) * bw;
    bar += `<rect x="${x}" y="${barY}" width="${Math.max(w - 2, 1)}" height="${barH}" fill="${palette[i % palette.length]}"/>`;
    x += w;
  });
  let legend = "";
  const colW = bw / 3;
  langs.forEach((l, i) => {
    const lx = pad + (i % 3) * colW, ly = barY + 44 + Math.floor(i / 3) * 28;
    const pct = ((l.size / total) * 100).toFixed(1);
    legend += `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${palette[i % palette.length]}"/>
<text x="${lx + 18}" y="${ly}" class="sans" font-size="13.5" font-weight="600" fill="${t.ink}">${esc(l.name)}</text>
<text x="${lx + 18 + textW(l.name, 13.5, true) + 8}" y="${ly}" class="mono" font-size="12" fill="${t.muted}">${pct}%</text>`;
  });
  const h = barY + 44 + Math.ceil(langs.length / 3) * 28 + 6;
  const body = `${kicker(t, pad, 40, "Languages · by code written, personal + work")}
<clipPath id="bar"><rect x="${pad}" y="${barY}" width="${bw}" height="${barH}" rx="6"/></clipPath>
<g clip-path="url(#bar)">${bar}</g>
${legend}`;
  return frame(t, h, body, { label: "Top languages" });
}

// ---------------------------------------------------------------- data

async function gql(token, query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-readme-builder" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GraphQL ${res.status}: ${JSON.stringify(json.errors || json.message)}`);
  return json.data;
}

const LANG_FIELDS = `nameWithOwner languages(first: 12, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } }`;

async function fetchAccount(token, login) {
  if (!login) login = (await gql(token, "{ viewer { login } }")).viewer.login;
  const to = new Date(), from = new Date(to.getTime() - 365 * 864e5);
  const main = await gql(token, `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      createdAt
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions
        totalIssueContributions totalRepositoriesWithContributedCommits restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) { nodes { ${LANG_FIELDS} } }
      repositoriesContributedTo(first: 100, includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST]) { nodes { ${LANG_FIELDS} } }
    }
  }`, { login, from: from.toISOString(), to: to.toISOString() });

  const u = main.user, c = u.contributionsCollection;

  return {
    login,
    total: c.contributionCalendar.totalContributions,
    // Private contributions the token cannot see in detail are still in `total`
    // (restrictedContributionsCount), but not in the per-type counts below.
    commits: c.totalCommitContributions,
    prs: c.totalPullRequestContributions,
    reviews: c.totalPullRequestReviewContributions,
    repos: c.totalRepositoriesWithContributedCommits,
    days: c.contributionCalendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
    repoLangs: [...u.repositories.nodes, ...u.repositoriesContributedTo.nodes],
  };
}

function mockAccount(seed, scale) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 864e5);
    const wk = d.getUTCDay() % 6 === 0 ? 0.3 : 1;
    days.push({ date: d.toISOString().slice(0, 10), count: rnd() < 0.18 ? 0 : Math.round(rnd() * 9 * wk * scale) });
  }
  const langs = [["Python", 520], ["TypeScript", 380], ["Rust", 240], ["PHP", 160], ["JavaScript", 120], ["SQL", 60], ["HTML", 400]];
  return {
    login: "mock", total: days.reduce((a, d) => a + d.count, 0),
    commits: Math.round(1100 * scale), prs: Math.round(140 * scale), reviews: Math.round(90 * scale), repos: Math.round(14 * scale), days,
    repoLangs: [{ nameWithOwner: `mock/${seed}`, languages: { edges: langs.map(([name, size]) => ({ size: size * 1000 * scale, node: { name } })) } }],
  };
}

function combine(accounts) {
  const byDate = new Map();
  for (const a of accounts) for (const d of a.days) byDate.set(d.date, (byDate.get(d.date) || 0) + d.count);
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }

  const dow = Array(7).fill(0);
  for (const d of days) dow[new Date(d.date + "T00:00:00Z").getUTCDay()] += d.count;
  const busiestDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow.indexOf(Math.max(...dow))];
  const activeDays = days.filter((d) => d.count > 0).length;
  const peak = Math.max(0, ...days.map((d) => d.count));
  const last30 = days.slice(-30).reduce((a, d) => a + d.count, 0);

  const sum = (k) => accounts.reduce((a, x) => a + x[k], 0);
  const seen = new Set(), langMap = new Map();
  const exclude = new Set(cfg.languages.exclude);
  for (const r of accounts.flatMap((a) => a.repoLangs)) {
    if (seen.has(r.nameWithOwner)) continue;
    seen.add(r.nameWithOwner);
    for (const e of r.languages.edges) if (!exclude.has(e.node.name)) langMap.set(e.node.name, (langMap.get(e.node.name) || 0) + e.size);
  }
  const langs = [...langMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, cfg.languages.top).map(([name, size]) => ({ name, size }));

  return {
    activity: {
      total: sum("total"), commits: sum("commits"), repos: sum("repos"),
      longestStreak: longest, busiestDay, activeDays, peak, last30, days,
      sources: accounts.length > 1 ? "Personal + work accounts, private work counted" : "Public activity",
      updated: new Date().toISOString().slice(0, 10),
    },
    langs,
  };
}

// ---------------------------------------------------------------- main

async function write(name, fn, ...args) {
  for (const mode of ["dark", "light"]) await writeFile(join(OUT, `${name}-${mode}.svg`), fn(THEMES[mode], ...args));
  console.log(`  wrote assets/${name}-{dark,light}.svg`);
}

await mkdir(OUT, { recursive: true });
await write("hero", hero);
await write("impact", impact);
await write("stack", stack);

let accounts = [];
if (MOCK) {
  accounts = [mockAccount(7, 1), mockAccount(13, 0.6)];
} else {
  const personalToken = process.env.PERSONAL_GH_TOKEN || process.env.GITHUB_TOKEN;
  const jobs = [];
  if (personalToken) jobs.push(["personal", personalToken, cfg.accounts.personal]);
  if (process.env.WORK_GH_TOKEN) jobs.push(["work", process.env.WORK_GH_TOKEN, process.env[cfg.accounts.work_env] || ""]);
  for (const [kind, token, login] of jobs) {
    try {
      const a = await fetchAccount(token, login);
      console.log(`  ${kind}: ${a.total} contributions in the last 12 months`);
      accounts.push(a);
    } catch (e) {
      console.warn(`  ${kind} account skipped: ${e.message}`);
    }
  }
}

if (accounts.length) {
  const { activity: act, langs } = combine(accounts);
  await write("activity", activity, act);
  if (langs.length) await write("languages", languages, langs);
} else {
  console.warn("  no account data: activity and language cards left unchanged");
  if (!MOCK && (process.env.WORK_GH_TOKEN || process.env.GITHUB_TOKEN)) process.exitCode = 1;
}
