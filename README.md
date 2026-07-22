# yatay geçiş field guide

A small, no-framework static site for publishing student guides about **yatay geçiş** (horizontal university transfer) for **YTB / Türkiye Bursları** scholarship students. It's built to run on **GitHub Pages** with zero build step.

Every guide can exist in two registers:

- **Informal** — the student's own draft voice (always present).
- **Formal** — a revised, cleaned-up version (added when you're ready).

A toggle in the reader switches between them, and the little status stamp flips from **draft** (informal) to **reviewed** (formal).

---

## Repository layout

```
.
├── index.html                     # the app shell
├── guides.json                    # generated manifest (list of guides + versions)
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── app.js                 # routing + markdown rendering
│       └── marked.js              # vendored Markdown parser (marked v12)
├── guides/
│   ├── informal/                  # informal .md files live here
│   │   └── yatay-gecis.md
│   └── formal/                    # formal .md files live here
│       └── yatay-gecis.md
├── scripts/
│   └── build-manifest.mjs         # regenerates guides.json
└── .github/workflows/
    └── build-manifest.yml         # rebuilds guides.json + deploys on push
```

---

## Deploying to GitHub Pages

1. Create a new GitHub repository and push these files to the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push any commit (or run the *Build manifest & deploy to Pages* workflow manually from the **Actions** tab). The included workflow rebuilds `guides.json` and publishes the site.

Your site will be served at `https://<username>.github.io/<repo>/`. All paths in the site are relative, so it works under that sub-path without changes.

> Fonts (Newsreader, Public Sans, Space Mono) load from Google Fonts at runtime. The parser and all app code are vendored into the repo, so the site otherwise has no external dependencies.

### Optional: link to your source

Open `assets/js/app.js` and set `REPO_URL` near the top to your repository URL to show a "source" link in the sidebar. Leave it as `""` to hide the link.

---

## Adding a new guide

1. Write the informal version as a Markdown file in `guides/informal/`, e.g. `guides/informal/burslu-staj.md`.
2. (Optional) Write the formal version at the **same filename** under `guides/formal/`, e.g. `guides/formal/burslu-staj.md`.
3. Commit and push. The GitHub Action rebuilds `guides.json` and redeploys.

**The filename is the pairing key.** `informal/burslu-staj.md` and `formal/burslu-staj.md` are treated as two versions of the *same* guide. A guide can have just an informal version — the formal toggle then shows a friendly "coming soon" until you add the matching file.

### Prefer to edit the manifest by hand?

You don't have to use the Action. `guides.json` is a plain file you can edit directly, or you can regenerate it locally:

```bash
node scripts/build-manifest.mjs
```

Both approaches are supported. If you set a `defaultSlug` in `guides.json` by hand, the generator preserves it.

---

## Front matter

Put an optional YAML block at the very top of each `.md` file, between `---` fences:

```markdown
---
title: A Guide to Yatay Geçiş for YTB Students
description: One-line summary shown in the sidebar.
order: 1
updated: 2026-07-21
wip: true
---
```

| Field | Purpose |
|---|---|
| `title` | Sidebar + browser-tab title. Falls back to the first `# heading`, then the filename. The informal file's title is used for the pair. |
| `description` | Short blurb under the title in the sidebar. |
| `order` | Sort position in the sidebar (lower first). Lowest-ordered guide is the default landing page. |
| `updated` | Date shown next to the version toggle. Falls back to the file's modified date. |
| `wip` | `true` shows the amber "still being written" banner and a dot in the sidebar. |

The parser understands strings, numbers, and `true`/`false` — that's all you need here.

---

## Markdown features

Standard Markdown works (headings, lists, tables, links, code, blockquotes). On top of that:

### Callout containers

Wrap content in `:::type` … `:::` to make a callout. An optional title follows the type on the first line.

```markdown
:::warning Set your expectations early
Transfers often don't go through. Keep your hopes measured.
:::

:::note In short
The transfer you want is **kurumlar arası yatay geçiş**.
:::

:::tip Always go to the source
Read the university's official directive (*yönerge*).
:::

:::important Read this twice
Apply as a 2nd/3rd-year student — never as a credit-transferred first year.
:::
```

Types: `note`, `tip`, `warning`, `important` (anything unrecognized renders as `note`). The inside is full Markdown.

### tl;dr summaries

Any paragraph that starts with `tl;dr:` automatically becomes a summary callout tinted to match the current register:

```markdown
tl;dr: start worrying around mid-to-end of June, but your GPA matters all year.
```

### Postscripts

A paragraph starting with `PS.` (or `ps:`) is styled as a quiet postscript note.

### Automatic table of contents

Every `##` and `###` heading is collected into the "On this page" rail (visible on wide screens) with scroll tracking. Headings get hover anchors for in-page jumps. An empty trailing `##` is ignored.

### Tables

Standard Markdown tables are wrapped so they scroll horizontally on small screens instead of breaking the layout.

---

## Running locally

Because the site fetches `guides.json` and the `.md` files, open it through a local server rather than `file://`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Notes on the source guide

The informal guide (`guides/informal/yatay-gecis.md`) is the author's original text with only two kinds of corrections applied — Turkish letters/diacritics (e.g. *gecis → geçiş*, *osys → ösys*) and three spelling slips (*kontejan → kontenjan*, *yongresi → yönergesi*, *isler → işleri*). The wording, lowercase style, and voice are otherwise untouched. The formal guide is a separate, revised rewrite.
