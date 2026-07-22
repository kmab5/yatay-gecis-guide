/* =========================================================================
   yatay geçiş field guide — app logic (no framework, no build step)
   ========================================================================= */

/* Set this to your repository URL to show a "source" link in the sidebar.
   Leave "" to hide it. e.g. "https://github.com/you/yatay-gecis-guide" */
const REPO_URL = "";

const VERSIONS = ["informal", "formal"];
const STAMP = { informal: "draft", formal: "reviewed" };
const DEFAULT_CALLOUT_LABEL = {
  note: "note",
  tip: "tip",
  warning: "warning",
  important: "important",
  tldr: "tl;dr",
};

const ICONS = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
  tldr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>',
  tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2h6c0-.8.3-1.3 1-2A6 6 0 0 0 12 3z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  important: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2 3 7v6c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7z"/><path d="M12 8v4M12 16h.01"/></svg>',
};

const state = {
  manifest: null,
  slug: null,
  version: null,
  lastVersion: null,
  mdCache: new Map(),
  headings: [],
};

const $ = (sel) => document.querySelector(sel);

/* ---------- front matter ---------- */
function splitFrontMatter(raw) {
  const m = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  let body = raw;
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!kv) continue;
      let [, k, v] = kv;
      v = v.trim().replace(/^["']|["']$/g, "");
      if (v === "true") v = true;
      else if (v === "false") v = false;
      meta[k] = v;
    }
  }
  return { meta, body };
}

/* ---------- ::: containers ---------- */
function extractContainers(body) {
  const blocks = [];
  const text = body.replace(
    /:::([a-zA-Z]+)[ \t]*([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?=\n|$)/g,
    (_, type, title, inner) => {
      type = type.toLowerCase();
      if (!DEFAULT_CALLOUT_LABEL[type]) type = "note";
      const label = (title || "").trim() || DEFAULT_CALLOUT_LABEL[type];
      const innerHtml = marked.parse(inner.trim());
      const icon = ICONS[type] || ICONS.note;
      const html =
        `<aside class="callout callout-${type}">` +
        `<div class="callout-title">${icon}<span>${escapeHtml(label)}</span></div>` +
        `<div class="callout-body">${innerHtml}</div>` +
        `</aside>`;
      const i = blocks.push(html) - 1;
      return `\n<!--CALLOUT:${i}-->\n`;
    }
  );
  return { text, blocks };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/* ---------- full markdown render ---------- */
function renderMarkdown(body) {
  const { text, blocks } = extractContainers(body);
  let html = marked.parse(text);
  html = html.replace(/<!--CALLOUT:(\d+)-->/g, (_, i) => blocks[Number(i)] || "");

  const holder = document.createElement("div");
  holder.innerHTML = html;

  // tl;dr:  and  PS.  paragraphs
  holder.querySelectorAll("p").forEach((p) => {
    const t = p.textContent.replace(/^\s+/, "");
    if (/^tl;dr\s*:/i.test(t)) {
      const rest = p.innerHTML.replace(/^\s*tl;dr\s*:\s*/i, "");
      const el = document.createElement("aside");
      el.className = "callout callout-tldr";
      el.innerHTML =
        `<div class="callout-title">${ICONS.tldr}<span>tl;dr</span></div>` +
        `<div class="callout-body"><p>${rest}</p></div>`;
      p.replaceWith(el);
    } else if (/^ps\s*[.:]/i.test(t)) {
      p.classList.add("postscript");
      p.innerHTML = p.innerHTML.replace(
        /^(\s*)(ps\s*[.:])/i,
        (_, s, mark) => `${s}<span class="ps-mark">${mark}</span> `
      );
    }
  });

  // external links
  holder.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (/^https?:\/\//i.test(href) && !href.startsWith(location.origin)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });

  // tables -> scroll wrapper
  holder.querySelectorAll("table").forEach((tbl) => {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    tbl.replaceWith(wrap);
    wrap.appendChild(tbl);
  });

  // headings -> ids, anchors, toc
  const used = new Set();
  const toc = [];
  holder.querySelectorAll("h2, h3").forEach((h) => {
    const text = h.textContent.trim();
    if (!text) return;
    let id = slugify(text);
    let n = 1;
    while (used.has(id)) id = `${slugify(text)}-${++n}`;
    used.add(id);
    h.id = id;
    const anchor = document.createElement("a");
    anchor.className = "anchor";
    anchor.href = `#${id}`;
    anchor.dataset.id = id;
    anchor.setAttribute("aria-label", "Link to this section");
    anchor.textContent = "#";
    h.appendChild(anchor);
    toc.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
  });

  return { html: holder.innerHTML, toc };
}

/* ---------- data ---------- */
async function loadManifest() {
  const res = await fetch("guides.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load guides.json");
  return res.json();
}

async function loadMarkdown(path) {
  if (state.mdCache.has(path)) return state.mdCache.get(path);
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Missing file: ${path}`);
  const raw = await res.text();
  state.mdCache.set(path, raw);
  return raw;
}

/* ---------- sidebar ---------- */
function renderSidebar(filter = "") {
  const list = $("#guideList");
  const q = filter.trim().toLowerCase();
  const items = state.manifest.guides.filter(
    (g) =>
      !q ||
      g.title.toLowerCase().includes(q) ||
      (g.description || "").toLowerCase().includes(q)
  );
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="list-empty">No guides match “${escapeHtml(filter)}”.</div>`;
    return;
  }
  for (const g of items) {
    const anyWip = VERSIONS.some((v) => g.versions[v]?.wip);
    const a = document.createElement("a");
    a.className = "guide-item";
    a.href = `#/${g.slug}/${defaultVersionFor(g)}`;
    a.dataset.slug = g.slug;
    if (g.slug === state.slug) a.setAttribute("aria-current", "true");
    a.innerHTML =
      `<span class="guide-item-title">${anyWip ? '<span class="wip-dot" title="Work in progress"></span>' : ""}<span>${escapeHtml(g.title)}</span></span>` +
      (g.description ? `<span class="guide-item-desc">${escapeHtml(g.description)}</span>` : "");
    list.appendChild(a);
  }
}

function defaultVersionFor(g) {
  return g.versions.informal ? "informal" : "formal";
}

/* ---------- toc ---------- */
function renderToc(toc) {
  const el = $("#tocList");
  el.innerHTML = "";
  if (!toc.length) {
    $("#toc").style.visibility = "hidden";
    return;
  }
  $("#toc").style.visibility = "visible";
  for (const h of toc) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.dataset.id = h.id;
    a.textContent = h.text;
    if (h.level === 3) a.classList.add("sub");
    li.appendChild(a);
    el.appendChild(li);
  }
}

function scrollToHeading(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- render a guide/version ---------- */
async function renderCurrent() {
  const guide =
    state.manifest.guides.find((g) => g.slug === state.slug) ||
    state.manifest.guides[0];
  state.slug = guide.slug;

  const reader = $("#reader");
  const article = $("#article");
  const versionData = guide.versions[state.version];

  // chrome: toggle + stamp + meta
  reader.dataset.version = state.version;
  $("#btnInformal").setAttribute("aria-pressed", String(state.version === "informal"));
  $("#btnFormal").setAttribute("aria-pressed", String(state.version === "formal"));
  $("#btnInformal").disabled = !guide.versions.informal;
  $("#btnFormal").disabled = !guide.versions.formal;

  const stamp = $("#stamp");
  stamp.textContent = STAMP[state.version];
  if (state.lastVersion && state.lastVersion !== state.version) {
    stamp.classList.remove("press");
    void stamp.offsetWidth; // restart animation
    stamp.classList.add("press");
  }

  // sidebar active state
  document.querySelectorAll(".guide-item").forEach((a) =>
    a.toggleAttribute("aria-current", a.dataset.slug === guide.slug)
  );

  // no file for this version -> coming soon
  if (!versionData) {
    $("#updated").textContent = "";
    $("#wipBanner").hidden = true;
    article.innerHTML = `<div class="coming-soon"><strong>${state.version === "formal" ? "Formal" : "Informal"} version coming soon</strong>This guide hasn't been ${state.version === "formal" ? "revised into a formal version" : "drafted"} yet. Switch versions using the toggle above.</div>`;
    $("#tocList").innerHTML = "";
    state.lastVersion = state.version;
    document.title = `${guide.title} · yatay geçiş field guide`;
    return;
  }

  $("#updated").textContent = versionData.updated ? `updated ${versionData.updated}` : "";
  $("#wipBanner").hidden = !versionData.wip;

  try {
    const raw = await loadMarkdown(versionData.path);
    const { body } = splitFrontMatter(raw);
    const { html, toc } = renderMarkdown(body);
    article.classList.remove("prose"); // restart enter animation
    void article.offsetWidth;
    article.classList.add("prose");
    article.innerHTML = html;
    state.headings = toc;
    renderToc(toc);
    document.title = `${guide.title} · yatay geçiş field guide`;
    window.scrollTo({ top: 0, behavior: "auto" });
    updateSpy();
  } catch (err) {
    article.innerHTML = `<div class="coming-soon"><strong>Couldn't load this guide</strong>${escapeHtml(err.message)}</div>`;
    $("#tocList").innerHTML = "";
  }

  state.lastVersion = state.version;
}

/* ---------- routing ---------- */
function parseRoute() {
  const h = location.hash;
  if (h.startsWith("#/")) {
    const [, slug, version] = h.slice(1).split("/"); // "#/slug/version"
    return {
      slug: slug || null,
      version: VERSIONS.includes(version) ? version : null,
    };
  }
  return { slug: null, version: null };
}

function applyRoute() {
  const r = parseRoute();
  const guides = state.manifest.guides;
  let slug = r.slug && guides.some((g) => g.slug === r.slug) ? r.slug : state.manifest.defaultSlug || guides[0].slug;
  const guide = guides.find((g) => g.slug === slug) || guides[0];
  let version = r.version || defaultVersionFor(guide);
  if (!guide.versions[version] && !r.version) version = defaultVersionFor(guide);

  state.slug = slug;
  state.version = version;
  renderCurrent();
  closeDrawer();
}

function navigate(slug, version) {
  const next = `#/${slug}/${version}`;
  if (location.hash === next) applyRoute();
  else location.hash = next;
}

/* ---------- scroll spy + progress ---------- */
let spyRaf = 0;
function updateSpy() {
  cancelAnimationFrame(spyRaf);
  spyRaf = requestAnimationFrame(() => {
    // progress
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    $("#progress").style.width = `${pct}%`;

    // active heading
    if (!state.headings.length) return;
    const line = (parseFloat(getComputedStyle(doc).getPropertyValue("--topbar-h")) || 60) + 28;
    let activeId = state.headings[0].id;
    for (const h of state.headings) {
      const el = document.getElementById(h.id);
      if (el && el.getBoundingClientRect().top <= line) activeId = h.id;
    }
    document.querySelectorAll(".toc-list a").forEach((a) =>
      a.classList.toggle("active", a.dataset.id === activeId)
    );
  });
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem("ytb-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("ytb-theme", next);
}

/* ---------- mobile drawer ---------- */
function openDrawer() {
  document.body.classList.add("nav-open");
  $("#menuBtn").setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  document.body.classList.remove("nav-open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

/* ---------- wiring ---------- */
function wireEvents() {
  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("scroll", updateSpy, { passive: true });
  window.addEventListener("resize", updateSpy, { passive: true });

  $("#themeBtn").addEventListener("click", toggleTheme);

  $("#menuBtn").addEventListener("click", () =>
    document.body.classList.contains("nav-open") ? closeDrawer() : openDrawer()
  );
  $("#scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  $("#search").addEventListener("input", (e) => renderSidebar(e.target.value));

  // version toggle
  $("#toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-version]");
    if (!btn || btn.disabled) return;
    navigate(state.slug, btn.dataset.version);
  });

  // in-page anchors (article anchors + toc) — smooth scroll without touching the route hash
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.anchor, .toc-list a");
    if (!a) return;
    e.preventDefault();
    scrollToHeading(a.dataset.id);
    closeDrawer();
  });
}

/* ---------- init ---------- */
async function init() {
  initTheme();

  if (REPO_URL) {
    const link = $("#repoLink");
    link.href = REPO_URL;
  } else {
    $("#repoLink").parentElement.style.display = "none";
  }

  try {
    marked.setOptions({ gfm: true, breaks: false });
    state.manifest = await loadManifest();
  } catch (err) {
    $("#article").innerHTML = `<div class="coming-soon"><strong>Setup needed</strong>${escapeHtml(err.message)}. Run <code>node scripts/build-manifest.mjs</code> or serve this folder over HTTP.</div>`;
    return;
  }

  renderSidebar();
  wireEvents();

  // ensure the URL reflects a real route for sharing/bookmarking
  const r = parseRoute();
  if (!r.slug || !state.manifest.guides.some((g) => g.slug === r.slug)) {
    const slug = state.manifest.defaultSlug || state.manifest.guides[0].slug;
    const guide = state.manifest.guides.find((g) => g.slug === slug);
    history.replaceState(null, "", `#/${slug}/${defaultVersionFor(guide)}`);
  }
  applyRoute();
}

init();
