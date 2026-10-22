# Tax Docs: Balance Confirmation Generator Specification

Reference files (fake data, variable text highlighted in yellow):
- `Balance_Confirmation_Template_With_Letterhead.docx` and `Balance_Confirmation_Template_No_Letterhead.docx`: two letters each. Letter 1 (Sagarmatha Suppliers) shows most rows, including Exempt Purchase, both return rows, TDS by us and retention. Letter 2 (Manaslu Traders) shows a sales-only party: purchase block hidden, exempt and return rows hidden, TDS by party shown.
- `Balance_Confirmation_Upload_Template.xlsx`: Instructions, Data and Example sheets. The Example sheet holds the same two parties and produces exactly the two letters.

Fake sender: Himal Traders Private Limited, Kathmandu-10, Kathmandu, PAN 999999999, signed by Ram Bahadur Thapa, Chairman.

## 1. Placement

A new, fourth compartment **Tax Docs** in the staff portal (same page, no new URLs), with one tool, **Balance Confirmation**, added through the registry like the other tools. Lazy-loaded, generated in the browser with the shared docxtemplater engine. Read uploaded Excel files in the browser with SheetJS (vendored locally). Nothing is uploaded to or stored on the server. Templates live in the login-gated `templates/` folder.

## 2. Two modes, one letter

- **Individual:** a form with the same fields as one Excel row. Generates one letter.
- **Bulk:** upload the Excel file. Generates one letter per selected row.

Both modes share the batch settings (section 3) and produce identical letters for identical data.

## 3. Batch settings (entered once in the form)

| Field | Rules |
|---|---|
| Sender company name, PAN, address | Used in the subject, "For ..." signature and letterhead. "Copy from Bank Docs" fills them if Bank Docs was used this session. Excel columns Q, R, S override per row only if filled |
| Signatory name and designation | Printed under the sender's signature |
| Fiscal year | Same dropdown component as the other tools (2060/61 to 2098/99). Printed as "FY 2082/83" |
| "As on" date | **Automatic**: last day of Ashad of the fiscal year's end year, from the shared BS calendar (e.g. FY 2082/83 gives 2083/03/32; FY 2080/81 gives 2081/03/31). Editable for mid-year confirmations, with a note when changed. Same out-of-range handling as the OCR tool |
| Letter date | Default today in BS (YYYY/MM/DD) |
| Response period (days) | Default 15 |
| Letterhead | "Include letterhead" / "No letterhead required" (shared Bank Docs letterhead block) |
| Hide empty purchase or sales block | Checkbox, default on (section 6) |

## 4. Excel upload

- "Download Excel template" button serves `Balance_Confirmation_Upload_Template.xlsx`.
- Find the header row by matching header names (ignore case, extra spaces and trailing dots), not by column position, so older files in the original sample layout also work. Read the sheet named "Data", else the first sheet with matching headers. Never read "Example" or "Instructions". Skip blank rows.
- Normalise Dr/Cr values: Dr, Dr., DR, Debit become "Dr."; Cr, Cr., CR, Credit become "Cr.".
- PAN read as text (keep leading zeros).
- After upload, show a preview grid: party, PAN, opening, reportable purchase, reportable sales, closing, and a status (OK / warning / error) with the message. Rows with errors are unticked and cannot be generated. Staff tick or untick rows before generating.

## 5. Validation

| Check | Level |
|---|---|
| PAN not 9 digits; party name blank; receiver address blank | Error |
| Opening or closing Dr/Cr missing or invalid when the balance is not 0 | Error |
| Any amount not a number or negative | Error |
| Exempt purchase greater than D+E+F+G, or exempt sales greater than H+I | Error |
| VAT entered (U or V) differs from the calculated figure by more than Rs 1 | Warning (letter uses the entered figure) |
| Duplicate PAN in the file | Warning |
| Row sender PAN (R) differs from the form's sender PAN | Warning |
| All transaction amounts and both balances are 0 | Warning |

## 6. Calculations and row rules

- Reportable Purchase (A+B) = D + E + F + G. Net Taxable Purchase (A) = Reportable Purchase minus Exempt Purchase (W).
- Reportable Sales (C+D) = H + I. Net Taxable Sales (C) = Reportable Sales minus Exempt Sales (X).
- VAT on Purchase = U if entered, else (A) x 13%. VAT on Sales = V if entered, else (C) x 13%. Round to 2 decimals. The VAT rate is a data-file setting (0.13).
- Annexure 13 amounts are net of returns; return rows are for reference only.
- **"Filled" means a non-zero amount.** Blank or 0 hides the row.

Table rows, in this order:

| # | Row label | Value | Shown |
|---|---|---|---|
| 1 | Opening Balance (Dr/Cr) | C + K | Always |
| 2 | Net Taxable Purchase (A) | as above | Purchase block |
| 3 | VAT on Purchase | as above | Purchase block |
| 4 | Exempt Purchase (B) | W | Only if W is not 0 |
| 5 | **Reportable Purchase as per Annexure 13 (A+B)**; label ends "(A)" when row 4 is hidden | D+E+F+G | Purchase block, bold |
| 6 | Purchase Return (already adjusted above) | N | Only if N is not 0 |
| 7 | Net Taxable Sales (C) | as above | Sales block |
| 8 | VAT on Sales | as above | Sales block |
| 9 | Exempt Sales (D) | X | Only if X is not 0 |
| 10 | **Reportable Sales as per Annexure 13 (C+D)**; label ends "(C)" when row 9 is hidden | H+I | Sales block, bold |
| 11 | Sales Return (already adjusted above) | M | Only if M is not 0 |
| 12 | TDS Deducted by Party | Z | Only if Z is not 0 |
| 13 | TDS Deducted by us | Y | Only if Y is not 0 |
| 14 | Retention Money | AA | Only if AA is not 0 |
| 15 | **Closing Balance (Dr/Cr)** | J + L | Always, bold |

**Purchase block** (rows 2 to 6) is hidden when D to G, W, N and U are all 0, if the "Hide empty block" setting is on; likewise the **sales block** (rows 7 to 11) for H, I, X, M and V. With the setting off, the blocks show with 0.00.

**Amounts:** Nepali digit grouping with two decimals (1,46,203.21). Balances carry the suffix: "10,152.20 Cr.". A zero balance prints "0.00" with no suffix.

## 7. Letter wording

As in the reference templates. Changes from the original sample, already applied:
1. "Dear Sir/Mam," becomes "Dear Sir/Madam,"
2. "return us received copy" becomes "return to us a received copy"
3. "Vat/Pan No." becomes "VAT/PAN No."; "Vat on Purchase/Sales" becomes "VAT on Purchase/Sales"
4. A right-aligned "Date: {letter date}" line is added (needed for the response period)
5. FY printed as "FY 2082/83" and dates as BS YYYY/MM/DD, matching the other tools
6. The subject's "between ........ and ......" filled with sender and party names

## 8. Output

- Individual: one .docx, `{Party}_{PAN}_Balance_Confirmation_{FY}.docx`.
- Bulk: choose **one combined .docx** (each letter on a new page, the letterhead repeated at the top of each letter) or **separate files in a .zip** named as above. Sanitise file names.
- With every bulk run, also offer:
  - **Confirmation register (.xlsx):** one row per letter: party, PAN, opening, reportable purchase, reportable sales, closing, letter date, plus empty columns "Sent on", "Response received on", "Agreed / Differs", "Difference amount", "Remarks" for follow-up.
  - **Annexure 13 export (.xlsx):** columns A to J only, headers exactly as in the template, values only, for IRD upload.
- "Highlight filled fields" checkbox as in the other tools.

## 9. Tests

1. Parity: the Example sheet uploaded with the reference batch settings (FY 2082/83, letter date 2083/07/05, 15 days, letterhead on) produces text matching `Balance_Confirmation_Template_With_Letterhead.docx`; letterhead off matches the No Letterhead file.
2. The Individual form with the Sagarmatha Suppliers values produces letter 1 exactly.
3. Each optional row hides at 0 and blank, and shows at a non-zero amount; label switches between (A) and (A+B), (C) and (C+D).
4. Purchase block hidden for a sales-only party with the setting on; shown with 0.00 with it off.
5. VAT: calculated when U/V blank; entered value used and warning raised when it differs by more than Rs 1.
6. Validation: bad PAN, exempt greater than total, invalid Dr/Cr, duplicate PAN.
7. Header matching: a file in the original sample layout (row 1 banners, headers in row 2, no Instructions sheet) reads correctly.
8. As-on date: FY 2080/81 gives 2081/03/31, FY 2082/83 gives 2083/03/32.
9. Combined and .zip outputs, the register and the Annexure 13 export.
10. All other tools' tests still pass.
