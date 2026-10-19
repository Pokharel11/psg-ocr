# P.S.G. & Associates — OCR Document Generator

A static web app that generates the standard Office of the Company Registrar (OCR)
compliance documents for Nepali companies (कम्पनी ऐन २०६३), as a single Word (`.docx`) file:

- Beneficiary Owner (वास्तविक धनी) detail
- AGM call minute (संचालक समितिको निर्णय)
- AGM minute (वार्षिक साधरण सभाको निर्णय)
- Application letter (दफा ५०)
- Section 92 (दफा ९२) — one per board member
- Section 51 (दफा ५१) — share/debenture/loan register
- SGM call + SGM minute (only when "Auditor Change" is enabled)

## Architecture

100% client-side. The `.docx` is built in the browser with the
[`docx`](https://docx.js.org) library (self-hosted at `assets/js/docx.min.js`).
There is **no server** — nothing is uploaded; documents are generated on the
user's device and downloaded directly. (PDF: open the `.docx` in Word/Google Docs
and "Save as PDF".)

Files:
- `partials/tool-ocr.html` — the OCR wizard markup (ids prefixed `ocr-`), injected
  into the portal. Generated from the old `app.html`; served via the portal only.
- `assets/js/app.js` — wizard logic + client-side document builder (registers
  `window.PortalTools.ocr`)
- `assets/js/docx.min.js` — vendored `docx` browser build (used by the OCR wizard)
- `assets/css/app.css` — the **shared** P.S.G. design system (indigo/brass). Every
  tool and the portal link this one stylesheet.

## The portal: three compartments, one page, no new URLs

After login, staff see **one page** (the portal) with three compartments —
**OCR Docs**, **Audit Docs**, **Bank Docs** — switched by the header tabs. Switching
a compartment or opening a tool happens on the page with **no change of address**
(no new URLs, paths or hash fragments). The last-used compartment is remembered in
`localStorage` (wrapped in try/catch). Opening a tool shows it in place with a
"Back to …" link; its half-filled form survives switching (panes are hidden, never
destroyed). Each tool's heavy scripts load **only the first time it is opened**, then
its `init()` runs once.

- `lib/ui.php` — `app_header()` (brand, compartment tabs, user, Log out) and
  `render_portal($user, $default)` (assembles the compartments from the `partials/`
  fragments and injects the header server-side).
- `assets/js/portal.js` — the compartment/tool registry, tab switching, lazy script
  loading + `init()`, and the `localStorage` memory.
- `index.php` → portal opened to **OCR Docs**; `audit-letters.php` → **Audit Docs**;
  `home.php` → the last-used compartment. All three serve the *same* portal, so the
  existing URLs keep working exactly as before; only the default compartment differs
  (set from `<body data-default-compartment>` — no hash).
- `lib/auth.php` — login guard + `safe_next()`.
- `partials/` — one markup fragment per tool (`tool-ocr.html`, `tool-audit.html`,
  `tool-bank.html`); never served directly (`partials/.htaccess` denies it).

### Adding a new tool to a compartment

Everything is a small registry, so a new tool (e.g. Bank Docs → "Statement Request")
is **one module + one registry entry**, no layout change:

1. **Markup** — add `partials/tool-<id>.html` with the tool's form. Prefix every
   `id`/`name`/`for` with the tool's prefix (`ocr-`, `audit-`, `bank-`) so tools
   never collide in the shared DOM. Scope any tool-specific CSS under the tool;
   reuse the shared components (`.section-card`, `.field-grid`, `.btn`, …).
2. **Module** — add `assets/js/<id>.js`. Do its setup in an `init()` and register it:
   `window.PortalTools["<id>"] = { init: function () { /* fetch assets, build form */ } };`
   (don't run on load — the portal calls `init()` on first open).
3. **Compartment wiring** — in `lib/ui.php` add a `tool_card('<id>', …)` to the
   compartment's cards and a `tool_pane('<id>', 'Back to …', tool_fragment('tool-<id>.html'))`.
4. **Registry** — in `assets/js/portal.js` add `"<id>": [ …scripts in dependency order… ]`
   to `SCRIPTS` (list every module the tool needs; the last one registers `PortalTools["<id>"]`).
5. Bump the `$assets_v` / `V` version strings (in `lib/ui.php` and `portal.js`) so
   browsers pick up the change.

## Deployment

Auto-deploys to **https://ocr.psgassociates.com.np** on every push to `main`
via GitHub Actions (`.github/workflows/deploy.yml`, FTPS to `public_html/ocr/`).
Requires repo secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
(same Babal Host `psgassoc` account as the main site).

## Audit letter generator

A second tool behind the same login (`audit-letters.php` → `audit-letters.html`).
Staff fill one form and download a Word file with three letters (Appointment,
Statutory Audit Engagement, Management Representation) for a Company, Partnership
Firm, Proprietorship Firm or NPO. Generated entirely in the browser; nothing is sent
or stored.

### How the .docx is built (template, not from scratch)

The output is produced by **filling a copy of the firm's reference letter**, so it
matches the reference in font, spacing, margins, page breaks and styles:

- `templates/audit-letter-template.docx` — the reference file with docxtemplater
  placeholders (`{entity_name}`, `{fee_figure}`, …) and three loops for the MRL
  items. **Only run text was edited** when making it; paragraph properties, spacing,
  spacer paragraphs, the table, page breaks, margins and styles are the reference's.
- The browser fetches the template and fills it with
  [docxtemplater](https://docxtemplater.com) + [PizZip](https://github.com/open-xml-templating/pizzip)
  (vendored at `assets/js/docxtemplater.min.js` and `assets/js/pizzip.min.js`).
- MRL items 12 and 21 are dropped for non-company entities via loop filtering; the
  list uses **native Word numbering** (`numId=8`), so it re-numbers 1…N with no gaps.
- **Download three files** splits the filled document at the two letter-boundary
  page breaks, keeping each letter's formatting.
- The reference yellow-highlights every filled value. The tool keeps those
  highlights only when **"Highlight filled values for review"** is on; otherwise they
  are stripped from the output.

Files:
- `partials/tool-audit.html` / `assets/js/audit-letters.js` — form markup (ids
  prefixed `audit-`) and wiring (registers `window.PortalTools.audit`).
- `assets/js/audit-letters-core.js` — pure logic. `templateData()` produces the
  docxtemplater payload; `letterText()`/`generate()` produce the plain text the tests
  check. Shared with the tests.
- `audit-letters.yaml` — framework wording and the 24 MRL paragraphs (entity
  vocabulary + partners now live in the **shared** `data/entities.yaml`; the loader
  merges them in). `verified: false` shows a "not yet verified" banner.
- `templates/audit-letter-template.docx` — the formatted template (deployed).

Shared modules (used by Audit Docs, Bank Docs and their tests — the common engine):
- `data/entities.yaml` — **the one entity data file both tools read**: entity
  vocabulary (audit fields + a `bank:` block per entity) and the partner list.
- `assets/js/common/psg-num.js` — ordinals, money grouping, amount in words.
- `assets/js/common/psg-bsdate.js` — BS/AD date helpers (on `nepali-date-converter`).
- `assets/js/common/docx-engine.js` — the docxtemplater fill / highlight-strip /
  page-break split engine. `audit-letters-render.js` is a thin wrapper over it.
- Vendored libraries: `assets/js/nepali-date.umd.js`, `assets/js/js-yaml.min.js`,
  `assets/js/pizzip.min.js`, `assets/js/docxtemplater.min.js`.

Tests and sample generation are dev-only tooling (not deployed), run from this repo:

```bash
npm install
npm test        # section-12 tests + template↔text parity for every entity type
npm run samples # writes four sample .docx (one per entity type) to samples/
```

The tests fill `templates/audit-letter-template.docx` and assert the extracted text
is identical to `audit-letters-core.js`, which in turn is checked against the
anonymized reference — so the Word template can never silently drift from the
approved wording.

### Rebuilding the template / editing wording

- **Wording** (sentences, the 24 MRL paragraphs, entity/framework vocabulary) lives
  in `audit-letters.yaml`. Editing it changes both the on-screen text and the filled
  letters — no template change needed, as long as the static prose in the template
  still matches (the parity test will flag any mismatch).
- **Formatting / new placeholders** require editing the template. The template was
  generated from the reference by a one-off build script
  (`scripts/build-template.js` is kept for reference); re-running it needs the
  original `Audit_Letter_Reference.docx`, which is **not** stored in the repo (it
  contains real names).
- Known, deliberate difference from the reference: date ordinals render **inline**
  (`25th`), not as superscript. Everything else matches the reference except the
  agreed wording corrections listed in `audit-letters.yaml` under `meta.corrections`.

### Keep in sync with the website repo

Two things here are **copies** of data that lives in the website repo
(`Pokharel11/psg-website`) and must be kept in sync by hand:

- **BS calendar table** — `assets/js/nepali-date.umd.js` is the same
  `nepali-date-converter` build the website compliance calendar uses. If the
  website upgrades that package, re-copy the UMD build here so both sites use the
  same Ashad day-counts and BS↔AD mapping.
- **Partner list** — the `partners:` block in `data/entities.yaml` mirrors the
  website's `_data/team.js` partners. When a partner is added, changed or removed
  there, update it here too (name without the "CA " prefix).

## Bank Docs — Account Opening

Bank Docs > Account Opening produces one Word file with the **meeting minutes** and the
**bank account-opening application letter**, built the same way as the audit letters —
by filling a copy of the firm's reference template:

- `templates/bank-account-template.docx` — the reference
  (`Bank_Account_Opening_Template_With_Letterhead.docx`) with docxtemplater
  placeholders, **loops** for members, lettered signatory sub-items and the
  side-by-side signature blocks, and **conditions** for the letterhead
  (`{#letterhead}` — the two headings + the line drawing), internet banking
  (`{#internet_banking}`), single vs multiple signatory (`{#single_sig}` /
  `{#multi_sig}`), and no-minute entities (`{#has_minute}` — Proprietorship is
  application-only). MRL-style numbering is native Word numbering, so dropping
  internet banking re-flows 1→2 with no gap.
- `assets/js/bank-core.js` — pure logic: turns the form inputs + the shared
  `data/entities.yaml` into the docxtemplater payload (operating-instruction wording,
  single/multiple signatory, mandatory signatory, AD date formatting, signature rows).
- `assets/js/bank.js` — the portal tool module (`PortalTools["bank-account"]`,
  ids prefixed `bank-`). `partials/tool-bank.html` is the form.
- Entity wording (minute title, noun, chair designation, member designations) is the
  `bank:` block of each entity in `data/entities.yaml` (`verified: false` except
  Company; NPO uses "organization" — confirm before verifying).

```bash
npm test          # audit (51) + bank (23) section-9 tests
npm run bank-samples   # writes the three review samples to samples/
```

Known, deliberate difference from the bank reference: the purpose sentence uses the
**meeting chair's designation** ("The Chairman informed…") per spec §4
`{Chair designation}`, where the reference had the generic "The Chairperson informed…".
Section-5 corrections (the "Name - Designation" space, the stray space in the address,
and "are compulsory") are baked into the template.

## Local preview

Any static server works, e.g.:

```bash
npx serve .
```
