/*
 * P.S.G. & Associates - Balance Confirmation spreadsheet I/O (SheetJS wrapper).
 * Reads an uploaded workbook into canonical rows by matching header NAMES (not
 * column position), so both the current template and older sample layouts work;
 * and writes the confirmation register and the Annexure 13 export. Pure data in,
 * bytes out: no DOM, no network. Uses the vendored SheetJS (assets/js/xlsx.full.min.js).
 *
 * UMD: window.BalanceConfirmationXlsx in the browser (needs window.XLSX +
 * window.BalanceConfirmationCore), module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./xlsx.full.min.js"), require("./balance-confirmation-core.js"));
  else root.BalanceConfirmationXlsx = factory(root.XLSX, root.BalanceConfirmationCore);
})(typeof self !== "undefined" ? self : this, function (XLSX, Core) {
  "use strict";

  // Normalise a header for name matching: lower case, straight apostrophes,
  // drop trailing dots, collapse inner whitespace.
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  }
  // canonical key -> set of accepted normalised header names.
  var HEADER_LOOKUP = (function () {
    var map = {};
    Object.keys(Core.KEYS).forEach(function (k) { map[norm(Core.KEYS[k])] = k; });
    return map;
  })();

  function cellText(v) { return v == null ? "" : String(v); }

  // Find the header row in a matrix (array of arrays): the row (within the first
  // 6) that recognises the most header names, needing PAN + Tradename at least.
  function findHeaderRow(matrix) {
    var best = -1, bestScore = 0;
    for (var r = 0; r < Math.min(matrix.length, 6); r++) {
      var rowCells = matrix[r] || [];
      var keys = {};
      rowCells.forEach(function (c) { var k = HEADER_LOOKUP[norm(c)]; if (k) keys[k] = 1; });
      var score = Object.keys(keys).length;
      if (keys.pan && keys.tradename && score > bestScore) { bestScore = score; best = r; }
    }
    return best;
  }

  // Map a worksheet to canonical rows. Returns { rows, headerRow } or null when
  // no header row matches. Blank rows (no PAN and no Tradename) are skipped.
  function rowsFromSheet(ws) {
    var matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false });
    var hr = findHeaderRow(matrix);
    if (hr < 0) return null;
    var colKey = {};
    (matrix[hr] || []).forEach(function (c, i) { var k = HEADER_LOOKUP[norm(c)]; if (k) colKey[i] = k; });
    var rows = [];
    for (var r = hr + 1; r < matrix.length; r++) {
      var cells = matrix[r] || [];
      var obj = {};
      Object.keys(colKey).forEach(function (i) { obj[colKey[i]] = cellText(cells[i]); });
      if (!String(obj.pan || "").trim() && !String(obj.tradename || "").trim()) continue;
      rows.push(obj);
    }
    return { rows: rows, headerRow: hr };
  }

  // Read an uploaded workbook (ArrayBuffer/Uint8Array or a parsed workbook).
  // Prefers the sheet named "Data"; else the first sheet with matching headers;
  // never "Example" or "Instructions". Returns { rows, sheetName, vatRate }.
  function readWorkbook(input) {
    var wb = (input && input.SheetNames) ? input : XLSX.read(input, { type: "array" });
    var order = wb.SheetNames.slice();
    var skip = { example: 1, instructions: 1 };
    // Data first, then the rest (minus skipped), preserving order.
    order.sort(function (a, b) {
      var ad = a.toLowerCase() === "data" ? 0 : 1, bd = b.toLowerCase() === "data" ? 0 : 1;
      return ad - bd;
    });
    var picked = null, sheetName = "";
    for (var i = 0; i < order.length; i++) {
      if (skip[order[i].toLowerCase()]) continue;
      var res = rowsFromSheet(wb.Sheets[order[i]]);
      if (res) { picked = res; sheetName = order[i]; break; }
    }
    if (!picked) return { rows: [], sheetName: "", vatRate: vatRateOf(wb) };
    return { rows: picked.rows, sheetName: sheetName, vatRate: vatRateOf(wb) };
  }

  // Read the data-file VAT rate from the Instructions sheet ("VAT rate" row),
  // else the default (0.13).
  function vatRateOf(wb) {
    var ws = wb.Sheets.Instructions || wb.Sheets.instructions;
    if (ws) {
      var m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
      for (var r = 0; r < m.length; r++) {
        var row = m[r] || [];
        for (var c = 0; c < row.length; c++) {
          if (norm(row[c]) === "vat rate") {
            var v = parseFloat(row[c + 1]);
            if (!isNaN(v) && v > 0 && v < 1) return v;
          }
        }
      }
    }
    return Core.DEFAULT_VAT_RATE;
  }

  // Read a named sheet into canonical rows (used by the parity test for the
  // Example sheet, which the live reader skips).
  function rowsFromNamedSheet(input, name) {
    var wb = (input && input.SheetNames) ? input : XLSX.read(input, { type: "array" });
    var ws = wb.Sheets[name];
    if (!ws) return [];
    var res = rowsFromSheet(ws);
    return res ? res.rows : [];
  }

  function aoaWorkbookBytes(sheetName, aoa, nodeBuffer) {
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: nodeBuffer ? "buffer" : "array", bookType: "xlsx" });
  }

  // Confirmation register: one row per generated letter + follow-up columns.
  function registerBytes(rows, settings, nodeBuffer) {
    var aoa = [Core.REGISTER_HEADERS].concat(rows.map(function (r) { return Core.registerRow(r, settings); }));
    return aoaWorkbookBytes("Register", aoa, nodeBuffer);
  }
  // Annexure 13 export: columns A..J only, values only, headers as the template.
  function annexure13Bytes(rows, nodeBuffer) {
    var aoa = [Core.ANNEXURE13].concat(rows.map(Core.annexure13Row));
    return aoaWorkbookBytes("Annexure13", aoa, nodeBuffer);
  }

  return {
    norm: norm, HEADER_LOOKUP: HEADER_LOOKUP,
    findHeaderRow: findHeaderRow, rowsFromSheet: rowsFromSheet,
    readWorkbook: readWorkbook, rowsFromNamedSheet: rowsFromNamedSheet, vatRateOf: vatRateOf,
    registerBytes: registerBytes, annexure13Bytes: annexure13Bytes,
  };
});
