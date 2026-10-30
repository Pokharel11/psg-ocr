# PSG — psg-ocr handoff (status for a fresh chat)

_Last updated: 2026-10-22. This file lives under `docs/` which is **excluded from deploy**.
Point a new chat at it (`@docs/HANDOFF.md`). The project auto-memory
(`…/.claude/projects/D--Software-Adhyawadhik/memory/psg-ocr-app.md`) also loads
automatically in this folder._

## What this is
`psg-ocr` is the internal **staff document portal** for **P.S.G. & Associates,
Chartered Accountants** (Kathmandu). Live at **https://ocr.psgassociates.com.np**,
behind a shared staff login (same `users` table as the DRS app). 100% client-side
document generation — nothing is uploaded or stored server-side.

Three sibling properties, three repos, all auto-deploy from GitHub `main` via FTPS
(SamKirkland/FTP-Deploy-Action) to Babal Host cPanel `psgassoc`:
- **psg-ocr** (`Pokharel11/psg-ocr`) → `public_html/ocr/` — THIS repo.
- **psg-website** (`Pokharel11/psg-website`) → main site; has the compliance calendar.
- **psg-drs** — PHP/MySQL staff daily-reporting app (the login source).

## The portal (one page, four compartments, no new URLs)
After login, `lib/ui.php` `render_portal()` serves ONE page with four compartments —
**OCR Docs**, **Audit Docs**, **Bank Docs**, **Tax Docs** — switched by `assets/js/portal.js`
(lazy-loads each tool's scripts on first open; remembers the last compartment in
localStorage; existing URLs `/`, `/audit-letters.php`, `/home.php` just set the
default compartment via `<body data-default-compartment>`). Per-tool ids are
prefixed (`ocr-`, `audit-`, `bank-`, `bank-st-`); shared design-system CSS classes
are unprefixed.

Tools:
- **OCR Docs → OCR Automation** — Office of the Company Registrar annual filing set.
- **Audit Docs → Audit Letters** — appointment / engagement / MRL letters.
- **Bank Docs → Account Opening** and **Statement Request**.
- **Tax Docs → Balance Confirmation** — balance-confirmation letters + Annexure 13
  summary, one party (form) or many (Excel upload); docxtemplater + vendored SheetJS.

## Shared libraries (used across tools, so they never drift)
- `assets/js/common/docx-engine.js` (`PSGDocx`) — docxtemplater fill + highlight strip + section split (Audit/Bank).
- `assets/js/common/psg-num.js` (`PSGNum`), `assets/js/common/psg-bsdate.js` (`PSGBSDate`) — numbers + BS/AD dates. **Calendar range BS 2000–2090** (the `nepali-date-converter` 3.4.0 `dateConfigMap`; latest version). The website's `src/_data/compliance.js` uses its **own independent copy of the same library** — already in sync; don't extend without extending both.
- `assets/js/common/bank-common.js`, `bank-ui.js` — shared Bank Docs logic + members editor.
- `assets/js/common/docx-engine.js` strips the reference's yellow highlights from the
  body **and header/footer parts** (Tax Docs puts the letterhead in a header).
- `assets/js/common/psg-bsdate.js` adds `fyAshadEndYMD(startYear)` — the "as on" date
  (last day of Ashad of the FY end year, e.g. 2082 -> "2083/03/32").
- `assets/js/xlsx.full.min.js` — vendored **SheetJS 0.18.5** (UMD; works in the browser
  and in Node tests). Tax Docs reads uploads and writes the register / Annexure 13 with it.
- `data/entities.yaml` — one shared entity file for Audit + Bank (`bank:` and `bank_statement:` blocks per entity).

## OCR Docs — the current focus
Spec: `docs/ocr-docs/OCR_DOCS_IMPROVEMENT_SPEC.md`. Reference letters:
`docs/ocr-docs/OCR_Auditor_Appointment_Letters_Template.docx` (fake data).

### Stage 1 — LIVE (deployed 2026-10-20, tweaks 2026-10-22)
Documents are still **built in code** (not docxtemplater yet):
- `assets/js/ocr-core.js` (`OCRCore`, UMD — `require('docx')` in Node / `window.docx`
  in browser) builds the filing set from `data/ocr.yaml` wording + the form data.
- `assets/js/app.js` is the form/UX layer; `partials/tool-ocr.html` is the form.
- **All Nepali wording is in `data/ocr.yaml`, `verified: false`** (spelling fixes +
  new letters + variants pending a partner's confirmation).
- Covers: A4, justified body, AutoFit tables, letterhead option, consistent heading +
  signature blocks (generous signature space); §92 per-director (default छैन for
  क/ख/ग/घ), §51 defaults/variants + face value, §51(1)-changed + shareholder table,
  shareholders list + partial-quorum variant, director roles, meeting-time inputs,
  auditor-change reason (complete phrase, shared by SGM minute + C2); the three
  auditor letters C1 (next-year, after AGM), C2 (new current-year, after SGM),
  C3 acceptance (optional, dated letter+1, **on the audit firm's letterhead**).
- Auditor **title** is optional (default blank; PSG partners carry सी.ए.; never
  hardcode CA). Firm selector: PSG auto-fills firm/address/partner/title/designation
  from the `firm:` block in `data/ocr.yaml`. Auditor-change toggle is in **step 3**.
- Part B UX: English-digit entry, date validation + auto +15/+21, FY dropdown
  (2060/61–2089/90, capped at BS 2090), capital helpers, save/load/roll-forward
  JSON, choose-documents + combined-or-zip, step validation.
- **Deferred:** Part B2 romanized transliteration (spec gates it on a 20-name eval).
- Tests: `scripts/ocr.test.js` (Part E, 66 tests). Samples: `npm run ocr-samples`
  (writes to `samples/`, gitignored). Build the letters-only reference is not needed
  for Stage 1 (documents are code-built).

### Stage 2 — NOT started (blocked on one file)
Convert OCR to the **docxtemplater** method (fill the user's reformatted file) like
Audit/Bank, with a **visual-comparison test**, keeping Part E green. **Blocked:** the
user must attach the **reformatted full `OCR_2_AuditorChange_On.docx`** (all 12
documents reformatted in Word). The file attached on 2026-10-20 was only the 3
auditor letters — not enough. When it arrives: build the docx template from it →
`ocr-core` fills it → visual test → regenerate samples → deploy after approval.

## Tax Docs — Balance Confirmation (LIVE, deployed 2026-10-22)
Spec: `docs/tax-docs/TAX_DOCS_BALANCE_CONFIRMATION_SPEC.md`. **Authoritative reference (fake
data): `docs/tax-docs/Balance_Confirmation_Reference.docx`** — the user's reformatted single
letter (2026-10-22): **Georgia** letterhead with a **sender VAT/PAN line**, **Aptos 11pt** body,
shortened subject ("Balance Confirmation and Transaction details", names dropped), and extra
**signing space**. The original `Balance_Confirmation_Template_{With,No}_Letterhead.docx` are the
earlier format and are **superseded** by this file. Upload template:
`docs/tax-docs/Balance_Confirmation_Upload_Template.xlsx` (Instructions / Data / Example sheets).
- **docxtemplater method** like Audit/Bank. `scripts/build-balance-confirmation-template.js`
  builds `templates/balance-confirmation-template.docx` by inserting tags into a COPY of the
  reformatted reference (so Georgia/Aptos fonts, borders/widths, signature layout + signing space
  carry over verbatim): one letter inside a `{#letters}` loop, a **condition on every optional row
  and on the purchase / sales blocks** (`{#show_purchase}` / `{#has_exempt_purchase}` / …), and
  computed `(A)`/`(A+B)` and `(C)`/`(C+D)` labels. The amount rows are cloned from the reference
  table's own non-bold/bold prototype rows. The **letterhead is a first-page section header**
  (`word/header1.xml`: name / address / `VAT/PAN: {entity_pan}` / rule, `{#letterhead}`-conditioned;
  empty `header2`/`header3` default) shown only on the first page of each letter and never repeated;
  each letter is its own next-page section, all referencing the one header (the sender is constant
  per batch). `entity_pan` is the sender PAN from the form.
- **Logic** `assets/js/balance-confirmation-core.js` (pure): figures (section 6), row/block
  visibility (filled = non-zero), validation (section 5), `templateData`, and the Annexure 13 /
  register row shapes. **Spreadsheet I/O** `assets/js/balance-confirmation-xlsx.js` (SheetJS):
  reads uploads by matching header **names** (not position; reads "Data" else the first matching
  sheet, never "Example"/"Instructions"), writes the register and the Annexure 13 export.
- **UI** `assets/js/balance-confirmation.js` + `partials/tool-tax-balance.html` (ids `tax-bc-`):
  Individual (form) and Bulk (upload + preview grid with tick/untick + status). Shared FY dropdown
  (2060/61–2089/90, capped at BS 2090), automatic BS "as on" date, letterhead / hide-empty-block /
  highlight options. Outputs: one `.docx`; combined `.docx`; separate files `.zip`; the register
  `.xlsx`; the Annexure 13 `.xlsx`. The "Download Excel template" button serves the login-gated
  `templates/balance-confirmation-upload-template.xlsx`.
- **The Example sheet was corrected** (its optional-tail cells were in the wrong columns and could
  not reproduce the reference letters): Sagarmatha `111`→TDS-by-us, `1245`→Retention; Manaslu
  `444`→TDS-by-party. With that, name-matching + the Example reproduces both letters exactly.
- Tests: `scripts/balance-confirmation.test.js` (40, spec section 9, incl. exact parity of the
  generated Sagarmatha letter vs the reformatted reference). Samples: `npm run balance-samples`
  (writes to `samples/balance-confirmation/`, gitignored). Verified end-to-end in the browser
  (earlier format): the generated combined/zip/register/Annexure bytes were identical to the Node samples.
- **LIVE** (merged to `main` + FTPS-deployed 2026-10-22; rollback tag **`pre-tax-docs`**). Verified
  live: `home.php` 302, `templates/*` 403, `docs/*` 404, public JS 200, `portal.js` has `tax-balance`.
  **Open:** partner still to confirm wording/figures (the letter data is partner-unverified).

## Security / gating (don't regress)
- `data/` and `templates/` are **login-gated**: a `.htaccess` in each routes every
  request to `protected-asset.php`, which runs the portal's `current_user()` check and
  returns **403** when signed out (JS/CSS stay public; a logged-in browser's `fetch()`
  carries the cookie so the tools work). `docs/**` is **excluded from deploy**.
- `config.php` holds live DB creds — gitignored + excluded from deploy, never touched.
  FTP creds only in GitHub Secrets. `dangerous-clean-slate: false` (never true).
- No real client/signatory names anywhere (repo/tests/samples use fake "Demo"/Himal data).

## Commands
```
npm test            # audit 51 + bank 23 + statement 29 + ocr 66 + balance 40 = 209
npm run balance-samples  # Balance Confirmation samples (combined, zip, letter, register, annexure)
npm run ocr-samples # OCR sample sets (auditor change on/off, shareholders-different)
npm run samples / bank-samples / statement-samples
node scripts/build-bank-statement-template.js   # rebuild a Bank template from its reference
```
`docx@9.6.1` is a devDependency so Node tests build real .docx (browser uses the
vendored `assets/js/docx.min.js`). Deploy excludes `scripts/`, `samples/`, `docs/`,
`node_modules/`, `package.json`, `config.php`, `README.md`, `.github/`, `.claude/`, `_dev*`.

## Branches & rollback tags
`main` = everything above, deployed (HEAD `63673e0`). Feature branches were merged
fast-forward. Rollback tags (point to main just before each deploy):
`pre-bank-docs`, `pre-statement-request`, `pre-ocr-docs`, `pre-ocr-tweaks`.
Roll back: `git reset --hard <tag> && git push --force origin main`.

## Working agreements
- Work on a branch; **do not deploy until the user approves**. Deploy = merge to
  `main` + push (triggers FTPS). After deploy, verify live: login gates 302;
  `data/`+`templates/` 403; `docs/` 404; other properties unaffected.
- The OCR Nepali wording is `verified: false` — a partner must confirm spellings,
  the amount-in-words 1–99 table, and the new/variant letter wording.

## Immediate next step
- **Tax Docs / Balance Confirmation** is LIVE (deployed 2026-10-22, `main` HEAD `e429231`, rollback
  tag `pre-tax-docs`). Only open item: a partner confirming the letter wording/figures.
- OCR Stage 2: still blocked on the reformatted full `OCR_2` file from the user.

## OCR Docs > Initial Update (deployed 2026-10-30, rollback tag `pre-initial-update`)
- Second item in OCR Docs (first filing after registration): cover letter, minutes of the first shareholders' meeting, auditor appointment minutes (optional), Section 184 statement. Spec: OCR_INITIAL_UPDATE_SPEC.md (Desktop copy, not in repo).
- Code: `assets/js/ocr-initial-core.js` (blocks -> Word and preview text from the same model), `ocr-initial.js` + `partials/tool-ocr-initial.html` (ids `oiu-`), wording in `data/ocr.yaml` under `initial:`. Tests `scripts/ocr-initial.test.js` (82); samples `npm run initial-update-samples`.
- Decisions: Unicode Mangal (no Preeti converter exists in OCR Docs), A4 with 1 inch margins, `OCRCore.possessive()` joins company and "को" with NO space (new documents only; the annual set still writes "{company} को" with a space in ocr.yaml lines 77, 89, 158, 159, 179, 183), spellings उपस्थिति, तपसिल, कारबाही.
- Open: plural founder wording needs Gaurav's review (marked NEEDS REVIEW); meeting numbers 01/02 vs 01/03; auditor default on; a real set still to be compared against the original PDF.
