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
- `app.html` — the OCR wizard UI (served via `index.php` after login)
- `assets/js/app.js` — wizard logic + client-side document builder
- `assets/js/docx.min.js` — vendored `docx` browser build (used by the OCR wizard)
- `assets/css/app.css` — the **shared** P.S.G. design system (indigo/brass). The OCR
  wizard, the audit-letter tool and the chooser all link this one stylesheet.

## Login, the tool chooser and the shared header

Every page is behind the staff login (the shared DRS `users` table). After signing
in, staff land on a **chooser** (`home.php`) with two cards — OCR Automation and the
Audit Letter Generator. Both tools share one header (`lib/ui.php` → `app_header()`,
injected server-side into the static HTML) showing the P.S.G. brand, the signed-in
user's name, a **Switch tool** link back to the chooser, and Log out.

Opening the original OCR URL (`/`) directly still goes **straight to OCR**, not the
chooser: `require_login()` sends a `?next=` back to `login.php`, which returns the
user to the page they asked for (validated against a local allow-list); a fresh
login with no `next` shows the chooser.

- `home.php` — the chooser
- `index.php` / `audit-letters.php` — gate + inject the shared header into
  `app.html` / `audit-letters.html` via `serve_tool()`
- `lib/ui.php` — `app_header()` and `serve_tool()`
- `lib/auth.php` — login guard + `safe_next()`

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
- `audit-letters.html` / `assets/js/audit-letters.js` — form UI and wiring
- `assets/js/audit-letters-core.js` — pure logic (dates, amount-in-words,
  vocabulary). `templateData()` produces the docxtemplater payload;
  `letterText()`/`generate()` produce the plain text the tests check. Shared with the tests.
- `assets/js/audit-letters-render.js` — fills the template, strips highlights,
  splits into three. Shared by the browser and the Node scripts.
- `audit-letters.yaml` — **all** entity-type and framework wording and the 24 MRL
  paragraphs, so a partner can edit the wording without touching code. `verified:
  false` shows a "not yet verified" banner until a partner reviews it.
- `templates/audit-letter-template.docx` — the formatted template (deployed).
- Vendored libraries: `assets/js/nepali-date.umd.js` (BS/AD calendar, same package
  as the website compliance calendar), `assets/js/js-yaml.min.js`,
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
- **Partner list** — the `partners:` block in `audit-letters.yaml` mirrors the
  website's `_data/team.js` partners. When a partner is added, changed or removed
  there, update it here too (name without the "CA " prefix).

## Local preview

Any static server works, e.g.:

```bash
npx serve .
```
