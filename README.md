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

## Local preview

Any static server works, e.g.:

```bash
npx serve .
```
