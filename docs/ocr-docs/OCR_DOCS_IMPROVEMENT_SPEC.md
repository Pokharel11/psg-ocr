# OCR Docs: Improvement Specification

Scope: the OCR Docs tool in psg-ocr (`partials/tool-ocr.html`, `assets/js/app.js`). Three parts: fix the documents, make the form easier, add the auditor appointment letters.

New reference template: `OCR_Auditor_Appointment_Letters_Template.docx` (Nepali, fake names, variable text highlighted). Fake data: हिमाल ट्रेडर्स प्रा.लि., अध्यक्ष राम बहादुर थापा; next and new auditor श्री दिपक शर्मा, एक्स वाई जेड एण्ड एसोसिएट्स; previous auditor श्री अशोक शर्मा, ए बी सी एण्ड एसोसिएट्स.

## Part A. Document fixes

### A1. Page and layout
- Page size is US Letter (12240 x 15840). Change to **A4** (11906 x 16838).
- Replace runs of blank paragraphs used as spacing (up to 11 in a row in the Section 51 document) with proper paragraph spacing, so layout does not shift with content length.
- Use one consistent heading block on every document: company name, address, registration number.
- One consistent signature block (dotted line, name, designation, company) everywhere.
- Add the same letterhead option as Bank Docs: "Include letterhead" / "No letterhead required".
- **Justify all body text** (every paragraph of running text in minutes, declarations and letters). Headings stay centred; dates stay right-aligned; addresses, signature blocks and short list lines stay left-aligned.
- **Signature and attendance tables AutoFit.** Every attendance table (क्र.सं., नाम, पद, हस्ताक्षर) and the Section 51 directors table uses Word's AutoFit to window: the table spans the full text width between the margins and the columns adjust to their content, so long names do not wrap awkwardly and the table never runs past the margin. The हस्ताक्षर column keeps a minimum width that leaves room to sign, and rows keep a minimum height for signatures. Check the result opens correctly in both Word and Google Docs.

### A2. Facts currently hard-coded that may be wrong
| Where | Hard-coded now | Change to |
|---|---|---|
| Section 92, all four items (every director) | Item ग printed "छ" for everyone | Per-director answer for each item (क, ख, ग, घ). **Default छैन for all four items for every director**, including ग. Changing ग to छ asks for the other company names |
| Section 51, loans and guarantees | "नभएको" | **Default नभएको**. Option to enter details instead |
| Section 51, investment in other companies | "छैन" | **Default छैन**. Option to enter company name, registration no., amount (repeatable) |
| Section 51, brokerage and forfeited shares | "छैन" | **Default छैन** for both. Option to enter details |
| Section 51, call per share | "प्रतिकित्ता रु १००" | Face value input (default 100). Authorized capital = shares x face value |
| Section 51(1) | Shareholders unchanged | Option: unchanged (current text) / changed (attach list sentence) |
| Meeting times | ११.०० बजे, दिउँसो १ बजे, बिहान १० बजे | Time input per meeting, with those as defaults |
| Auditor change reason | "कार्यव्यस्तता" | Dropdown: कार्यव्यस्तता (default), राजीनामा, custom text |
| AGM and SGM attendance | Board list | Shareholders list (name, number of shares). Toggle "Shareholders are the same as directors", default on |
| AGM quorum text | All shareholders present in person | Variant when not all present (`verified: false`) |
| Director roles | Only अध्यक्ष / संचालक; Section 51 table says "संचालक/ अध्यक्ष" | Role select: अध्यक्ष, प्रबन्ध सञ्चालक, सञ्चालक, स्वतन्त्र सञ्चालक, used consistently in every document |

### A3. Spelling and consistency (apply, then list in the PR for partner confirmation)
- प्रस्तावबहरु → प्रस्तावहरु
- गाणपुरक → गणपूरक
- साधरण → साधारण (every occurrence)
- निर्णय न → निर्णय नं. (consistent numbering style in every minute)
- लेखापरिक्षककोको → लेखापरीक्षकको
- आपिस सहमतिमा → आपसी सहमतिमा
- बिक्की → बिक्री
- शेयधनीहरु → शेयरधनीहरु; शेयरधनि → शेयरधनी
- निम्नाअनुसार → निम्नानुसार
- सर्बसम्मितबाट → सर्वसम्मतिबाट
- बिशेष → विशेष; जानकारि → जानकारी; उपस्थिती → उपस्थित; पूँजि → पूँजी
- One spelling each throughout: लेखापरीक्षक (not लेखा परिक्षक / लेखापरिक्षक), सञ्चालक (not संचालक), तपसिल (not तपशिल), डिबेञ्चर (not डिवेन्चर)
- Section 51 list letters: "ड)" → "ङ)", "फ)" → "झ)"; remove the stray "(१)" line or number it correctly

### A4. Bugs
- `addNepDays` uses its own BS table that ends at 2087 and silently falls back to 2082 month lengths for other years. Use the shared `common/psg-bsdate.js` calendar and show an error if a year is outside it.
- Remove the artificial progress delay (`sleep(160)` per step).
- `alert()` calls: replace with inline messages.

## Part B. Ease of use

1. **English digits accepted everywhere.** Dates, numbers and amounts can be typed with 0-9; convert to Nepali digits on blur. Amounts get Nepali grouping (२५,००,०००).
2. **Romanized typing for names and addresses.** A toggle on Nepali text fields: type "ram bahadur thapa", get "राम बहादुर थापा", editable afterwards. Use a vendored client-side transliteration library (no server); evaluate output on 20 common names and addresses before adopting.
3. **BS date picker** on every date field, plus live validation: AGM at least 21 days after the AGM-call BOD meeting; SGM at least 15 days after its BOD meeting; application date after the AGM; letters dated on or after their meeting. Show warnings inline on the step, not only at the end.
4. **Fiscal year dropdown.** Next fiscal year fills automatically.
5. **Auditor quick-fill.** "Our firm" button fills P.S.G. & Associates and a chosen partner in Nepali (from the shared data file). "Next year auditor same as this year" checkbox, default on.
6. **Capital helpers.** Paid amount defaults to paid-up capital; unpaid = paid-up minus paid (छैन when zero).
7. **Save and load client file.** "Save client details" downloads a small .json file; "Load client details" fills the form from it. "Roll forward to next year" loads last year's file, moves both fiscal years forward by one, makes last year's next-year auditor this year's auditor, and clears all dates. Nothing is stored on the server.
8. **Choose documents.** Checkboxes on the review step for each document (all on by default). Download as one combined file or as separate files in a .zip.
9. **Step validation.** Required fields marked and checked when leaving each step, with the sidebar step showing a warning dot if incomplete.
10. **Directors editor.** Role select, drag to reorder, "same as company address" shortcut.

## Part C. New documents

All on the company's letterhead option, Mangal font, A4, matching the rest of the set. Wording in the reference template; mark `verified: false` until partner approval.

| Document | When included | Default date | Placed after |
|---|---|---|---|
| C1. Appointment letter to next year's auditor (लेखापरीक्षक नियुक्ति सम्बन्धमा) | Always | AGM date | AGM minute |
| C2. Appointment letter to the new auditor for the current year | Auditor change on | SGM date | SGM minute |
| C3. Auditor's acceptance letter (लेखापरीक्षक नियुक्ति स्वीकार गरिएको सम्बन्धमा) | Optional checkbox, for C1 and/or C2 | Letter date + 1 day | Its appointment letter |

New inputs:
- Auditor address (for next-year auditor, and new current-year auditor when changed).
- Auditor designation for the acceptance letter (साझेदार / प्रोप्राइटर).
- Fee: "By mutual agreement" (default; sentence: लेखापरीक्षकको पारिश्रमिक आपसी सहमतिमा निर्धारण गरिनेछ ।) or an amount with VAT exclusive/inclusive (sentence with figures and Nepali amount in words: लाख/करोड, "रुपैयाँ मात्र").
- C2 uses the change reason from A2.

## Part D. Format workflow

After Parts A to C, generate a corrected sample set with the fake data. Gaurav adjusts the format of that sample directly in Word (fonts, spacing, headings, signature positions). His edited file then becomes the reference template, and the OCR tool is converted to the same docxtemplater method as Audit Docs and Bank Docs, filling his file instead of building documents in code.

## Part E. Tests

1. Page size A4 in output.
2. Every A3 spelling fix present; none of the old spellings remain anywhere in the output.
3. Section 92: with no changes, every director's declaration prints छैन for all four items (क, ख, ग, घ). Setting ग to छ prints the other company names. Section 51 with no changes prints नभएको for loans and छैन for investments, brokerage and forfeited shares.
3a. Format: every body paragraph is justified; every attendance and directors table is AutoFit to window, spans the text width, and keeps the minimum signature column width.
4. Section 51: face value 1000 gives authorized capital = shares x 1000; loans and investments print entered details.
5. Dates: BOD 2083/03/25 + 21 days crosses into Shrawan correctly from the shared calendar; a year outside the calendar shows an error.
6. Auditor change on: SGM minute, C2 and (if ticked) C3 appear in the right order. Off: they do not.
7. C1 dated the AGM date; fee by agreement and fee amount variants both render, with correct Nepali words for 1,00,000 and 2,50,000.
8. Save, reload and roll-forward produce the expected form state.
9. Choosing documents and separate-files download work.
