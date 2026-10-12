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
- `index.html` — the wizard UI (P.S.G. indigo/brass theme)
- `assets/js/app.js` — wizard logic + client-side document builder
- `assets/js/docx.min.js` — vendored `docx` browser build (v9.6.1)

## Deployment

Auto-deploys to **https://ocr.psgassociates.com.np** on every push to `main`
via GitHub Actions (`.github/workflows/deploy.yml`, FTPS to `public_html/ocr/`).
Requires repo secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
(same Babal Host `psgassoc` account as the main site).

## Audit letter generator

A second tool behind the same login (`audit-letters.php` → `audit-letters.html`),
linked from the OCR app header. Staff fill one form and download a Word file with
three letters (Appointment, Statutory Audit Engagement, Management Representation)
for a Company, Partnership Firm, Proprietorship Firm or NPO. Generated entirely in
the browser; nothing is sent or stored.

Files:
- `audit-letters.html` / `assets/js/audit-letters.js` — form UI and wiring
- `assets/js/audit-letters-core.js` — pure logic (dates, amount-in-words,
  vocabulary, letter assembly). Shared with the tests.
- `assets/js/audit-letters-render.js` — builds the `.docx`
- `audit-letters.yaml` — **all** entity-type and framework wording and the 24 MRL
  paragraphs, so a partner can edit the letters without touching code. `verified:
  false` shows a "not yet verified" banner until a partner reviews it.
- Vendored libraries: `assets/js/nepali-date.umd.js` (BS/AD calendar, same package
  as the website compliance calendar) and `assets/js/js-yaml.min.js`.

Tests and sample generation are dev-only tooling (not deployed), run from this repo:

```bash
npm install
npm test        # section-12 tests, incl. the PSG Private Limited parity test
npm run samples # writes four sample .docx (one per entity type) to samples/
```

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
