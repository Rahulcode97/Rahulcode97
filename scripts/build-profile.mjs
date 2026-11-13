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
// A terminal / git look, deliberately different from the portfolio's Ink + Indigo.

const THEMES = {
  dark: {
    surface: "#0A0F0D", sunken: "#111915", line: "#1E2A24",
    ink: "#E6EDF3", soft: "#9DAAA3", muted: "#5E6B65",
    green: "#3FB950", green2: "#7EE787", amber: "#F2CC60", cyan: "#56D4DD", pink: "#F778BA", grey: "#8B949E",
    bar0: "#1A2520",
  },
  light: {
    surface: "#FFFFFF", sunken: "#F4F7F5", line: "#D8E0DB",
    ink: "#0F1A14", soft: "#4B5A52", muted: "#86928B",
    green: "#1A7F37", green2: "#2DA44E", amber: "#9A6700", cyan: "#0E7490", pink: "#BF3989", grey: "#6E7781",
    bar0: "#E3E9E5",
  },
};
// The hero is a terminal window, so it stays dark in both themes.
const TERM = THEMES.dark;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
const W = 840;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Number(n).toLocaleString("en-US");
const CH = 0.602; // monospace advance width, in ems

function svg(h, body, label, t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">
<style>
  text{font-family:${MONO}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  .live{animation:pulse 2.4s ease-in-out infinite}
  @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
  .cursor{animation:blink 1.1s step-end infinite}
  @keyframes rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  .in{animation:rise .5s ease-out backwards}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="12" fill="${t.surface}" stroke="${t.line}"/>
${body}
</svg>
`;
}

// "$ command" header line used on every card.
const prompt = (t, x, y, cmd, note = "") =>
  `<text x="${x}" y="${y}" font-size="13"><tspan fill="${t.green}">$</tspan><tspan fill="${t.ink}" dx="8">${esc(cmd)}</tspan>${note ? `<tspan fill="${t.muted}" dx="12"># ${esc(note)}</tspan>` : ""}</text>`;

// ---------------------------------------------------------------- cards

function hero() {
  const t = TERM, h = 284, x = 28;
  const lines = [
    ["whoami", [[t.ink, cfg.name, 700], [t.muted, "  ·  "], [t.soft, cfg.role]]],
    ["cat focus.txt", [[t.amber, cfg.focus]]],
    ["uptime", [[t.green2, cfg.uptime], [t.muted, "  ·  "], [t.soft, "owned from requirements to on-call"]]],
    ["open portfolio", [[t.cyan, "→ case studies, numbers & live demos"]]],
  ];
  let y = 74, body = "", d = 0.15;
  for (const [cmd, out] of lines) {
    body += `<g class="in" style="animation-delay:${d.toFixed(2)}s">${prompt(t, x, y, cmd)}</g>`;
    d += 0.35;
    body += `<g class="in" style="animation-delay:${d.toFixed(2)}s"><text x="${x + 18}" y="${y + 22}" font-size="15">${out
      .map(([c, s, wgt]) => `<tspan fill="${c}"${wgt ? ` font-weight="${wgt}"` : ""}>${esc(s)}</tspan>`).join("")}</text></g>`;
    d += 0.35;
    y += 44;
  }
  body += `<g class="in" style="animation-delay:${d.toFixed(2)}s">${prompt(t, x, y, "")}<rect x="${x + 22}" y="${y - 12}" width="9" height="16" fill="${t.green}" class="cursor"/></g>`;

  const chrome = `<path d="M12.5 0.5h${W - 25}a12 12 0 0 1 12 12v22h-${W - 1}v-22a12 12 0 0 1 12-12z" fill="${t.sunken}"/>
<line x1="0.5" y1="34.5" x2="${W - 0.5}" y2="34.5" stroke="${t.line}"/>
<circle cx="22" cy="17.5" r="5.5" fill="#FF5F57"/><circle cx="40" cy="17.5" r="5.5" fill="#FEBC2E"/><circle cx="58" cy="17.5" r="5.5" fill="#28C840"/>
<text x="${W / 2}" y="22" font-size="12" fill="${t.muted}" text-anchor="middle">${esc(cfg.handle)}@prod: ~</text>`;
  return svg(h, chrome + body, `${cfg.name}, ${cfg.role}`, t);
}

function services(t) {
  const x = 28, top = 84, rowH = 31;
  const cols = [x, x + 196, x + 532];
  const h = top + cfg.services.length * rowH + 22;
  let rows = `<text y="${top - 14}" font-size="11" fill="${t.muted}" letter-spacing=".08em">
<tspan x="${cols[0] + 18}">SERVICE</tspan><tspan x="${cols[1]}">WHAT IT DOES</tspan><tspan x="${cols[2]}">SIGNAL</tspan></text>
<line x1="${x}" y1="${top - 6}" x2="${W - x}" y2="${top - 6}" stroke="${t.line}"/>`;
  cfg.services.forEach((s, i) => {
    const y = top + 14 + i * rowH;
    rows += `<g class="in" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">
<circle cx="${cols[0] + 5}" cy="${y - 4.5}" r="4.5" fill="${t.green}" class="live" style="animation-delay:${(i * 0.3).toFixed(1)}s"/>
<text x="${cols[0] + 18}" y="${y}" font-size="13" font-weight="600" fill="${t.ink}">${esc(s.name)}</text>
<text x="${cols[1]}" y="${y}" font-size="12.5" fill="${t.soft}">${esc(s.does)}</text>
<text x="${cols[2]}" y="${y}" font-size="12.5" fill="${t.amber}">${esc(s.signal)}</text></g>`;
  });
  const body = `${prompt(t, x, 40, "systemctl list-units --state=running", "systems I built and run")}${rows}`;
  return svg(h, body, "Services I built and run in production", t);
}

function activity(t, d) {
  const x = 28;
  const metrics = [
    [`${d.activeWeeks}/${d.weeks.length}`, "active weeks", "last 12 months"],
    [fmt(d.commits), "commits", `across ${fmt(d.repos)} repos`],
    [fmt(d.last30), "contributions", "last 30 days"],
    [d.lastActive, "last active", `${fmt(d.activeDays)} active days this year`],
  ];
  const mw = (W - x * 2) / metrics.length;
  let top = "";
  metrics.forEach(([v, k, sub], i) => {
    const mx = x + i * mw;
    top += `<g class="in" style="animation-delay:${(0.1 + i * 0.1).toFixed(2)}s">
${i ? `<line x1="${mx - 14}" y1="70" x2="${mx - 14}" y2="132" stroke="${t.line}"/>` : ""}
<text x="${mx}" y="100" font-size="30" font-weight="700" fill="${i === 0 ? t.green : t.ink}" letter-spacing="-0.02em">${esc(v)}</text>
<text x="${mx}" y="120" font-size="12" fill="${t.soft}">${esc(k)}</text>
<text x="${mx}" y="136" font-size="10.5" fill="${t.muted}">${esc(sub)}</text></g>`;
  });

  // Weekly bars: one per week, oldest on the left. Empty weeks show as a flat stub.
  const bx = x, by = 172, bh = 78, n = d.weeks.length;
  const step = (W - x * 2) / n, bw = Math.max(step - 3, 2);
  const max = Math.max(1, ...d.weeks.map((w) => w.count));
  const avg = d.weeks.reduce((a, w) => a + w.count, 0) / n;
  let bars = "", months = "", lastM = -1;
  d.weeks.forEach((w, i) => {
    const hgt = w.count ? Math.max(4, (w.count / max) * bh) : 2;
    const fill = w.count ? (i >= n - 4 ? t.green2 : t.green) : t.bar0;
    bars += `<rect x="${(bx + i * step).toFixed(1)}" y="${(by + bh - hgt).toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="1.5" fill="${fill}" opacity="${w.count ? 0.55 + 0.45 * (w.count / max) : 1}"><title>week of ${w.start}: ${w.count}</title></rect>`;
    const m = new Date(w.start + "T00:00:00Z").getUTCMonth();
    if (m !== lastM && i < n - 2) {
      if (lastM !== -1) months += `<text x="${(bx + i * step).toFixed(1)}" y="${by + bh + 18}" font-size="10.5" fill="${t.muted}">${["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][m]}</text>`;
      lastM = m;
    }
  });
  const ay = by + bh - (avg / max) * bh;
  const avgLine = `<line x1="${bx}" y1="${ay.toFixed(1)}" x2="${W - x}" y2="${ay.toFixed(1)}" stroke="${t.amber}" stroke-dasharray="3 4" opacity=".8"/>
<text x="${W - x}" y="${by - 12}" font-size="11" fill="${t.amber}" text-anchor="end">- - avg ${avg.toFixed(1)}/week</text>`;

  const h = by + bh + 50;
  const body = `${prompt(t, x, 40, "git log --since='1 year ago' --all-accounts", d.sources)}
${top}
<text x="${x}" y="${by - 12}" font-size="11" fill="${t.muted}" letter-spacing=".08em">CONTRIBUTIONS PER WEEK · ${fmt(d.total)} TOTAL</text>
${bars}${avgLine}${months}
<text x="${W - x}" y="${h - 14}" font-size="10" fill="${t.muted}" text-anchor="end">refreshed daily · ${d.updated}</text>`;
  return svg(h, body, `${d.total} contributions in the last 12 months, active ${d.activeWeeks} of ${d.weeks.length} weeks`, t);
}

function stack(t, langs) {
  const x = 28, top = 76, rowH = 30, colR = 440;
  const total = langs.reduce((a, l) => a + l.size, 0) || 1;
  const palette = [t.green, t.amber, t.cyan, t.pink, t.green2, t.grey];
  const barW = colR - x - 200;
  let left = "";
  langs.forEach((l, i) => {
    const y = top + i * rowH, pct = (l.size / total) * 100;
    left += `<text x="${x}" y="${y}" font-size="12.5" fill="${t.ink}">${esc(l.name.toLowerCase())}</text>
<rect x="${x + 120}" y="${y - 9}" width="${barW}" height="8" rx="4" fill="${t.sunken}"/>
<rect x="${x + 120}" y="${y - 9}" width="${Math.max(3, (pct / 100) * barW).toFixed(1)}" height="8" rx="4" fill="${palette[i % palette.length]}"/>
<text x="${x + 128 + barW}" y="${y}" font-size="11.5" fill="${t.muted}">${pct.toFixed(1)}%</text>`;
  });
  let right = "";
  cfg.toolbox.forEach(([k, v], i) => {
    const y = top + i * rowH;
    right += `<text x="${colR}" y="${y}" font-size="12.5"><tspan fill="${t.cyan}">${esc(k)}</tspan><tspan fill="${t.muted}">:</tspan></text>
<text x="${colR + 82}" y="${y}" font-size="12.5" fill="${t.soft}">${esc(v)}</text>`;
  });
  const rows = Math.max(langs.length, cfg.toolbox.length);
  const h = top + (rows - 1) * rowH + 30;
  const body = `${prompt(t, x, 40, "languages --by-bytes")}
${prompt(t, colR, 40, "cat toolbox.yml")}
<line x1="${colR - 22}" y1="58" x2="${colR - 22}" y2="${h - 20}" stroke="${t.line}"/>
${left}${right}`;
  return svg(h, body, "Languages and toolbox", t);
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
  const { user: u } = await gql(token, `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions totalRepositoriesWithContributedCommits
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) { nodes { ${LANG_FIELDS} } }
      repositoriesContributedTo(first: 100, includeUserRepositories: false, contributionTypes: [COMMIT, PULL_REQUEST]) { nodes { ${LANG_FIELDS} } }
    }
  }`, { login, from: from.toISOString(), to: to.toISOString() });
  const c = u.contributionsCollection;
  return {
    total: c.contributionCalendar.totalContributions,
    commits: c.totalCommitContributions,
    repos: c.totalRepositoriesWithContributedCommits,
    days: c.contributionCalendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))),
    repoLangs: [...u.repositories.nodes, ...u.repositoriesContributedTo.nodes],
  };
}

function mockAccount(seed, scale) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const days = [], today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 864e5);
    const busy = rnd() < 0.3 ? 0 : rnd() * 6 * scale * (1 + Math.sin(i / 40));
    days.push({ date: d.toISOString().slice(0, 10), count: Math.round(busy) });
  }
  const langs = [["PHP", 450], ["JavaScript", 200], ["Python", 190], ["TypeScript", 140], ["Rust", 20], ["PLpgSQL", 6]];
  return {
    total: days.reduce((a, d) => a + d.count, 0), commits: Math.round(600 * scale), repos: Math.round(10 * scale), days,
    repoLangs: [{ nameWithOwner: `mock/${seed}`, languages: { edges: langs.map(([name, size]) => ({ size: size * 1000 * scale, node: { name } })) } }],
  };
}

function combine(accounts) {
  const byDate = new Map();
  for (const a of accounts) for (const d of a.days) byDate.set(d.date, (byDate.get(d.date) || 0) + d.count);
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  // Group into Sunday-starting weeks, matching GitHub's calendar.
  const weeks = [];
  for (const d of days) {
    const dt = new Date(d.date + "T00:00:00Z");
    const start = new Date(dt.getTime() - dt.getUTCDay() * 864e5).toISOString().slice(0, 10);
    if (!weeks.length || weeks.at(-1).start !== start) weeks.push({ start, count: 0 });
    weeks.at(-1).count += d.count;
  }
  while (weeks.length > 52) weeks.shift();

  const lastIdx = days.findLastIndex((d) => d.count > 0);
  const ago = lastIdx < 0 ? -1 : days.length - 1 - lastIdx;
  const lastActive = ago < 0 ? "—" : ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago}d ago`;

  const sum = (k) => accounts.reduce((a, x) => a + x[k], 0);
  const seen = new Set(), langMap = new Map(), exclude = new Set(cfg.languages.exclude);
  for (const r of accounts.flatMap((a) => a.repoLangs)) {
    if (seen.has(r.nameWithOwner)) continue;
    seen.add(r.nameWithOwner);
    for (const e of r.languages.edges) if (!exclude.has(e.node.name)) langMap.set(e.node.name, (langMap.get(e.node.name) || 0) + e.size);
  }
  const langs = [...langMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, cfg.languages.top).map(([name, size]) => ({ name, size }));

  return {
    activity: {
      total: sum("total"), commits: sum("commits"), repos: sum("repos"),
      weeks, activeWeeks: weeks.filter((w) => w.count > 0).length,
      activeDays: days.filter((d) => d.count > 0).length,
      last30: days.slice(-30).reduce((a, d) => a + d.count, 0),
      lastActive,
      sources: accounts.length > 1 ? "personal + work, private counted" : "public activity",
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
await writeFile(join(OUT, "hero.svg"), hero());
console.log("  wrote assets/hero.svg");
await write("services", services);

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
  if (langs.length) await write("stack", stack, langs);
} else {
  console.warn("  no account data: activity and stack cards left unchanged");
  if (!MOCK && (process.env.WORK_GH_TOKEN || process.env.GITHUB_TOKEN)) process.exitCode = 1;
}
