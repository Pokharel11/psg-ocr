/*
 * Generate Balance Confirmation samples for review (TAX_DOCS_BALANCE_CONFIRMATION_SPEC
 * section 8/9). Reads the Example sheet of the upload template, fills the built docx
 * template with the browser's core, and writes: the combined .docx (both letters,
 * letterhead repeated at the top of each letter), a .zip of the individual letters,
 * one individual letter, the confirmation register and the Annexure 13 export.
 * Fake data only. Run: npm run balance-samples
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const PSGDocx = require("../assets/js/common/docx-engine.js");
const Core = require("../assets/js/balance-confirmation-core.js");
const Xlsx = require("../assets/js/balance-confirmation-xlsx.js");

const ROOT = path.resolve(__dirname, "..");
const TPL = fs.readFileSync(path.join(ROOT, "templates", "balance-confirmation-template.docx"));
const XLSXFILE = fs.readFileSync(path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Upload_Template.xlsx"));
const OUT = path.join(ROOT, "samples", "balance-confirmation");
fs.mkdirSync(OUT, { recursive: true });

const settings = {
  fy: "2082/83", letterDate: "2083/07/05", asOn: "2083/03/32", responseDays: 15, letterhead: true, vatRate: 0.13,
  senderName: "Himal Traders Private Limited", senderPan: "222222222", senderAddress: "Kathmandu-10, Kathmandu",
  signatoryName: "Ram Bahadur Thapa", signatoryDesignation: "Chairman", hideEmpty: true,
};

const exampleRows = Xlsx.rowsFromNamedSheet(XLSXFILE, "Example");
settings.vatRate = Xlsx.vatRateOf(require("../assets/js/xlsx.full.min.js").read(XLSXFILE, { type: "buffer" }));

function write(name, bytes) {
  const out = path.join(OUT, name);
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log("wrote " + path.relative(ROOT, out) + " (" + Buffer.from(bytes).length + " bytes)");
}

// Combined (both letters, one document)
write("Example_Combined.docx", PSGDocx.combined(TPL, Core.templateData(exampleRows, settings), { highlight: false }));

// Individual letters + a .zip of them
const zip = new PizZip();
exampleRows.forEach(function (r) {
  const bytes = PSGDocx.bytes(PSGDocx.fillZip(TPL, Core.templateData([r], settings), { highlight: false }));
  const name = Core.fileName(r, settings);
  zip.file(name, bytes);
});
write("Example_Letters.zip", zip.generate({ type: "nodebuffer" }));

// One individual letter on its own (first party)
write(Core.fileName(exampleRows[0], settings),
  PSGDocx.bytes(PSGDocx.fillZip(TPL, Core.templateData([exampleRows[0]], settings), { highlight: false })));

// Confirmation register + Annexure 13 export
write("Confirmation_Register.xlsx", Xlsx.registerBytes(exampleRows, settings, true));
write("Annexure_13.xlsx", Xlsx.annexure13Bytes(exampleRows, true));

console.log("Done. Balance Confirmation samples in " + path.relative(ROOT, OUT) + "/");
