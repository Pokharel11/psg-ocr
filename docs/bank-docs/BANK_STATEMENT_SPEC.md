# Bank Docs: Statement Request Generator Specification

Reference templates (variable text highlighted in yellow):
- `Bank_Statement_Request_Template_With_Letterhead.docx`
- `Bank_Statement_Request_Template_No_Letterhead.docx`

Fake data, the same as the Account Opening templates: Himal Traders Private Limited, Kathmandu-10, Kathmandu; Mr. Ram Bahadur Thapa (Chairman), Ms. Sita Kumari Shrestha (Director), Mr. Hari Prasad Adhikari (Director); XYZ Bank Limited, Kathmandu Branch; account 00112233445566.

## 1. Placement

The second tool in the **Bank Docs** compartment, "Statement Request", added as one module plus one registry entry, exactly as the README describes. Same docxtemplater engine, same shared entity data file, lazy-loaded, in-browser only.

Reuse from Account Opening rather than duplicating: the letterhead block, the members editor (title, name, designation, chair), the signature-block loop and the entity vocabulary. Move any of these that still live inside the Account Opening module into a shared Bank Docs module. Account Opening output must not change: rerun its tests.

Add a "Copy details from Account Opening" button that fills entity, address, members and bank from the Account Opening form if it has been filled in this session.

## 2. Output

One .docx with two parts, separated by the existing page break, in this order:
1. Application letter to the bank (REF: Request for Account Statements)
2. Minutes of the meeting

File name: `{EntityShortName}_{LetterDateAD}_Bank_Statement_Request.docx`. "Highlight filled fields" checkbox as in the other tools.

## 3. Form inputs

| Group | Field | Rules |
|---|---|---|
| Entity | Entity type, name, address | Same as Account Opening. Proprietorship: letter only, no minute |
| | Letterhead | "Include letterhead" / "No letterhead required" |
| Bank | Bank name, bank address, branch name | Address line under the bank name in the letter (e.g. "Kathmandu, Nepal"); branch name used in the letter and minute (e.g. "Kathmandu Branch") |
| Accounts | Repeatable: account number | Minimum 1. Account name defaults to the entity name (editable once, applies to all) |
| Period | From and To dates | Date system: AD (default, shown as 2025/07/17) or BS (shown as 2082/04/01). A "Fill fiscal year" picker sets Shrawan 1 to the last day of Ashad of the chosen FY, using the shared BS calendar, in whichever system is selected |
| Purpose | Dropdown | Internal accounting (default), statutory audit, income tax return, loan or credit facility, custom text |
| Meeting | Date, time | Date shown as "16th October 2026" with superscript ordinal |
| Members | Same editor as Account Opening | Chair defaults to the first row |
| | All members present | Checkbox, default on |
| Authorization | Authorized person(s) | One or more members. They sign the application and collect the statement |
| Letter | Letter date | Defaults to the meeting date |

## 4. Wording rules

**Letter, opening sentence:** "We have been maintaining our {noun}'s bank account{s} at your esteemed bank. We would like to request you to kindly provide us with a bank statement for the period from **{from}** to **{to}**. Our banking details are provided below:"

**Banking details block (bold, as in the reference):**
- Account Name: {account name}
- Account Number: {number} (one line per account; label "Account Number" on each)
- Branch Name: {branch}

**Signature:** one block per authorized person (name, designation). With two or more, side by side, two per row, as in Account Opening.

**Minute heading:** entity name and address in capitals, then the title from the data file.

**Attendance table:** one row per member (name with title, designation, blank third column for signature). Keep the reference table's widths, borderless style and row heights.

**Attendance heading and narrative by entity type (data file, `verified: false` except Company):**

| Key | Company | NPO | Partnership Firm |
|---|---|---|---|
| Minute title | MINUTES OF THE BOARD OF DIRECTORS | MINUTES OF THE EXECUTIVE COMMITTEE MEETING | MINUTES OF THE PARTNERS' MEETING |
| Attendance heading | Directors Present: | Members Present: | Partners Present: |
| Meeting of | the board of directors | the executive committee | the partners |
| Office | the company's office | the organization's office | the firm's office |
| Members word | board members | committee members | partners |

Note the reference uses "MINUTES OF THE BOARD OF DIRECTORS" while Account Opening uses "MINUTES OF BOARD OF DIRECTORS". Keep each tool's title as in its own reference; store them as separate keys.

**Narrative:** "A meeting of {meeting of} of {entity} was held on the above date and time at {office}, presided over by {chair title} {chair name}. {presence sentence}, and the following matter was discussed and decided."
- All present: "All {members word} were present"
- Not all present: "The {members word} listed above were present, forming the quorum" (`verified: false`)

**Agenda:** "Request for bank statement of the {noun}'s account{s} maintained at {bank}, {branch}."

**Discussion:** "The {members word} discussed the need to obtain the {noun}'s bank statement{s} for the period from {from} to {to} for the purpose of {purpose}."

**Decision:**
- "It was unanimously decided to request {bank}, {branch}, to provide the bank statement{s} of the {noun}'s {Account No. X | Account Nos. X and Y | Account Nos. X, Y and Z} for the period from {from} to {to}."
- One person: "{Title} {Name} is hereby authorized to sign the application, submit it to the bank, and collect the bank statement on behalf of the {noun}."
- Two or more: "{Title} {Name} and {Title} {Name} are hereby authorized to sign the application, submit it to the bank, and collect the bank statement{s} on behalf of the {noun}."
- "The bank is authorized to debit any applicable service charges from the {noun}'s account{s}."

**BS period:** when BS is chosen, write "from 2082/04/01 to 2083/03/32 (B.S.)" in the letter, discussion and decision.

## 5. Letterhead

- **Include:** the same letterhead block as Account Opening (entity name and address, 24 pt bold centred, horizontal line beneath) at the top of the application, then one blank line, then the date. Both bank tools must render an identical letterhead.
- **Not required:** the reference layout: three blank lines at the top of the application, then the date.

## 6. Corrections already applied in the templates

1. "Dear Sir/Maam," becomes "Dear Sir/Madam,"
2. The duplicate closing "Regards," after "Yours faithfully," is removed
3. "Partners Present:" in a company board minute becomes "Directors Present:" (now driven by entity type)

## 7. Validation

- At least one account; From not after To; warn if To is after the letter date.
- At least one authorized person, and they must be members (or proprietor for a proprietorship).
- Bank name and branch required.
- Warn on duplicate account numbers.

## 8. Tests

1. Parity: the reference case (company, three members, one account, AD period, Ms. Sita Kumari Shrestha authorized, letterhead included) matches `Bank_Statement_Request_Template_With_Letterhead.docx` text.
2. No letterhead: matches the No Letterhead reference; no 24 pt heading and no line drawing.
3. Two accounts: plural "accounts", "Account Nos. X and Y", two "Account Number" lines in the letter. Three accounts: "X, Y and Z".
4. Two authorized persons: "are hereby authorized", two signature blocks side by side.
5. BS fiscal-year fill for FY 2082/83: 2082/04/01 to the correct last day of Ashad 2083 from the calendar, with "(B.S.)".
6. "All members present" off: quorum sentence.
7. NPO and Partnership wording from the data file; Proprietorship produces the letter only.
8. Account Opening test suite still passes unchanged.
9. Visual: render the reference and the test 1 output to PDF and compare page images; only highlight differences allowed.
