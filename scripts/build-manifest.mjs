#!/usr/bin/env node
/**
 * Builds guides.json by scanning guides/informal and guides/formal.
 *
 * Run locally:   node scripts/build-manifest.mjs
 * Runs in CI:    see .github/workflows/build-manifest.yml
 *
 * A guide is identified by its filename. informal/foo.md and formal/foo.md
 * are treated as two versions of the SAME guide ("foo"). The informal file is
 * the source of truth for title/description/order; formal falls back to it.
 *
 * No dependencies — just Node's fs. The front-matter parser understands the
 * small YAML subset documented in the README (string / number / boolean values).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSIONS = ["informal", "formal"];

function parseFrontMatter(raw) {
  const m = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    value = value.trim().replace(/^["']|["']$/g, "");
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value !== "" && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    data[key] = value;
  }
  return data;
}

function firstHeading(raw) {
  const body = raw.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const h = body.match(/^\s*#\s+(.+?)\s*$/m);
  return h ? h[1].trim() : null;
}

function collect() {
  const bySlug = new Map();

  for (const version of VERSIONS) {
    const dir = join(ROOT, "guides", version);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const full = join(dir, file);
      const raw = readFileSync(full, "utf8");
      const fm = parseFrontMatter(raw);
      const updated =
        fm.updated || statSync(full).mtime.toISOString().slice(0, 10);

      if (!bySlug.has(slug)) bySlug.set(slug, { slug, versions: {} });
      const entry = bySlug.get(slug);
      entry.versions[version] = {
        path: `guides/${version}/${file}`,
        wip: fm.wip === true,
        updated,
      };
      // Metadata: informal wins; otherwise fill from whatever we have.
      const preferInformal = version === "informal";
      if (preferInformal || entry.title == null)
        entry.title = fm.title || firstHeading(raw) || slug;
      if (preferInformal || entry.description == null)
        entry.description = fm.description || "";
      if (preferInformal || entry.order == null)
        entry.order = typeof fm.order === "number" ? fm.order : 999;
    }
  }

  const guides = [...bySlug.values()].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
  return guides;
}

function build() {
  const guides = collect();

  // Preserve an explicit defaultSlug if one was already set by hand.
  let defaultSlug = guides[0]?.slug ?? null;
  const manifestPath = join(ROOT, "guides.json");
  if (existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (prev.defaultSlug && guides.some((g) => g.slug === prev.defaultSlug))
        defaultSlug = prev.defaultSlug;
    } catch {
      /* ignore malformed previous manifest */
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    defaultSlug,
    guides,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `guides.json written: ${guides.length} guide(s), default "${defaultSlug}".`
  );
}

build();
