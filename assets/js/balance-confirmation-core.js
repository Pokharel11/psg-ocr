/*
 * P.S.G. & Associates - Balance Confirmation core (pure logic, no DOM/network).
 * Turns one canonical party row + the batch settings into the docxtemplater
 * payload for templates/balance-confirmation-template.docx, and holds the
 * calculations (TAX_DOCS_BALANCE_CONFIRMATION_SPEC section 6), validation
 * (section 5), and the Annexure 13 / confirmation-register row shapes.
 *
 * A "row" here is an object keyed by canonical field name (see KEYS). The UI
 * maps Excel headers (by name, not position) and the Individual form to these
 * keys; the test builds them directly. Amounts may arrive as numbers or strings.
 *
 * UMD: window.BalanceConfirmationCore in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./common/psg-num"));
  else root.BalanceConfirmationCore = factory(root.PSGNum);
})(typeof self !== "undefined" ? self : this, function (PSGNum) {
  "use strict";

  // Canonical field keys <- Annexure 13 / template header names.
  var KEYS = {
    pan: "PAN", tradename: "Tradename", opening: "OpeningBalance",
    servicePurchaseCapital: "ServicePurchaseCapital", servicePurchaseOthers: "ServicePurchaseOthers",
    goodPurchaseCapital: "GoodPurchaseCapital", goodPurchaseOthers: "GoodPurchaseOthers",
    serviceSales: "ServiceSales", goodSales: "GoodSales", closing: "ClosingBalance",
    openingDrCr: "Opening Dr/Cr", closingDrCr: "Closing Dr/Cr",
    salesReturn: "Sales Return", purchaseReturn: "Purchase Return",
    senderEmail: "Sender's Email", receiverEmail: "Receiver's Email",
    senderName: "Sender Company's Name", senderPan: "Sender Company's PAN No.",
    senderAddress: "Sender Company's Address", receiverAddress: "Receiver Company's Address",
    vatPurchase: "VAT on Purchase", vatSales: "VAT on Sales",
    exemptPurchase: "Exempt Purchase", exemptSales: "Exempt Sales",
    tdsUs: "TDS Deducted By Us", tdsParty: "TDS Deducted By Party", retention: "Retention Money",
  };
  // Annexure 13 block, columns A..J, headers exactly as the template.
  var ANNEXURE13 = [
    "PAN", "Tradename", "OpeningBalance", "ServicePurchaseCapital", "ServicePurchaseOthers",
    "GoodPurchaseCapital", "GoodPurchaseOthers", "ServiceSales", "GoodSales", "ClosingBalance",
  ];
  var ANNEXURE13_KEYS = [
    "pan", "tradename", "opening", "servicePurchaseCapital", "servicePurchaseOthers",
    "goodPurchaseCapital", "goodPurchaseOthers", "serviceSales", "goodSales", "closing",
  ];
  var REGISTER_HEADERS = [
    "Party", "PAN", "Opening Balance", "Reportable Purchase", "Reportable Sales", "Closing Balance",
    "Letter date", "Sent on", "Response received on", "Agreed / Differs", "Difference amount", "Remarks",
  ];

  var DEFAULT_VAT_RATE = 0.13;

  function round2(n) { return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
  function fmt(n) { return PSGNum.formatMoney(round2(n), 2, "nepali"); } // "1,46,203.21" / "0.00"
  function fmtBalance(n, drcr) {
    n = round2(n);
    if (n === 0) return "0.00";
    return fmt(n) + (drcr ? " " + drcr : "");
  }

  function normDrCr(v) {
    var s = String(v == null ? "" : v).trim().toLowerCase().replace(/\.$/, "");
    if (s === "dr" || s === "debit") return "Dr.";
    if (s === "cr" || s === "credit") return "Cr.";
    return "";
  }
  // Parse a numeric field. Blank -> {ok:true, value:0, blank:true}; a number ->
  // {ok:true, value}; otherwise {ok:false}. Commas tolerated.
  function toNum(v) {
    if (v == null || String(v).trim() === "") return { ok: true, value: 0, blank: true };
    var s = String(v).trim().replace(/,/g, "");
    if (!/^-?\d*\.?\d+$/.test(s)) return { ok: false, value: NaN };
    return { ok: true, value: parseFloat(s) };
  }
  function n(raw, key) { var r = toNum(raw[key]); return r.ok ? r.value : 0; }
  function filled(raw, key) { return String(raw[key] == null ? "" : raw[key]).trim() !== ""; }
  function panDigits(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }

  // Computed figures for one row (section 6).
  function figures(raw, settings) {
    var rate = (settings && settings.vatRate != null) ? +settings.vatRate : DEFAULT_VAT_RATE;
    var D = n(raw, "servicePurchaseCapital"), E = n(raw, "servicePurchaseOthers"),
        F = n(raw, "goodPurchaseCapital"), G = n(raw, "goodPurchaseOthers");
    var H = n(raw, "serviceSales"), I = n(raw, "goodSales");
    var W = n(raw, "exemptPurchase"), X = n(raw, "exemptSales");
    var reportablePurchase = D + E + F + G;
    var reportableSales = H + I;
    var netTaxablePurchase = reportablePurchase - W;
    var netTaxableSales = reportableSales - X;
    var vatPurchase = filled(raw, "vatPurchase") ? n(raw, "vatPurchase") : netTaxablePurchase * rate;
    var vatSales = filled(raw, "vatSales") ? n(raw, "vatSales") : netTaxableSales * rate;
    return {
      D: D, E: E, F: F, G: G, H: H, I: I, W: W, X: X,
      opening: n(raw, "opening"), closing: n(raw, "closing"),
      openingDrCr: normDrCr(raw.openingDrCr), closingDrCr: normDrCr(raw.closingDrCr),
      salesReturn: n(raw, "salesReturn"), purchaseReturn: n(raw, "purchaseReturn"),
      tdsUs: n(raw, "tdsUs"), tdsParty: n(raw, "tdsParty"), retention: n(raw, "retention"),
      reportablePurchase: round2(reportablePurchase), reportableSales: round2(reportableSales),
      netTaxablePurchase: round2(netTaxablePurchase), netTaxableSales: round2(netTaxableSales),
      vatPurchase: round2(vatPurchase), vatSales: round2(vatSales),
      vatPurchaseCalc: round2(netTaxablePurchase * rate), vatSalesCalc: round2(netTaxableSales * rate),
      rate: rate,
    };
  }

  // Per-letter docxtemplater object for one row.
  function letterData(raw, settings) {
    var f = figures(raw, settings);
    var hideEmpty = !settings || settings.hideEmpty !== false; // default on
    var purchaseActive = !(f.D === 0 && f.E === 0 && f.F === 0 && f.G === 0 && f.W === 0 && f.purchaseReturn === 0 && f.vatPurchase === 0);
    var salesActive = !(f.H === 0 && f.I === 0 && f.X === 0 && f.salesReturn === 0 && f.vatSales === 0);
    var showPurchase = hideEmpty ? purchaseActive : true;
    var showSales = hideEmpty ? salesActive : true;
    var hasExemptPurchase = f.W !== 0, hasExemptSales = f.X !== 0;
    var senderName = (filled(raw, "senderName") ? raw.senderName : settings.senderName) || "";
    return {
      date: settings.letterDate, fy: settings.fy, as_on: settings.asOn,
      response_days: settings.responseDays,
      sender_name: senderName,
      party_name: String(raw.tradename == null ? "" : raw.tradename).trim(),
      party_address: String(raw.receiverAddress == null ? "" : raw.receiverAddress).trim(),
      party_pan: panDigits(raw.pan),
      signatory_name: settings.signatoryName || "", signatory_designation: settings.signatoryDesignation || "",
      opening: fmtBalance(f.opening, f.openingDrCr),
      closing: fmtBalance(f.closing, f.closingDrCr),
      show_purchase: showPurchase,
      net_taxable_purchase: fmt(f.netTaxablePurchase),
      vat_purchase: fmt(f.vatPurchase),
      has_exempt_purchase: hasExemptPurchase, exempt_purchase: fmt(f.W),
      reportable_purchase: fmt(f.reportablePurchase),
      reportable_purchase_label: "Reportable Purchase as per Annexure 13 (" + (hasExemptPurchase ? "A+B" : "A") + ")",
      has_purchase_return: f.purchaseReturn !== 0, purchase_return: fmt(f.purchaseReturn),
      show_sales: showSales,
      net_taxable_sales: fmt(f.netTaxableSales),
      vat_sales: fmt(f.vatSales),
      has_exempt_sales: hasExemptSales, exempt_sales: fmt(f.X),
      reportable_sales: fmt(f.reportableSales),
      reportable_sales_label: "Reportable Sales as per Annexure 13 (" + (hasExemptSales ? "C+D" : "C") + ")",
      has_sales_return: f.salesReturn !== 0, sales_return: fmt(f.salesReturn),
      has_tds_party: f.tdsParty !== 0, tds_party: fmt(f.tdsParty),
      has_tds_us: f.tdsUs !== 0, tds_us: fmt(f.tdsUs),
      has_retention: f.retention !== 0, retention: fmt(f.retention),
    };
  }

  // Top-level payload for one or more rows.
  function templateData(rows, settings) {
    var letters = rows.map(function (raw) { return letterData(raw, settings); });
    letters.forEach(function (l, i) { l.last = (i === letters.length - 1); });
    return {
      letterhead: !!settings.letterhead,
      entity_name: settings.senderName || "",
      entity_address: settings.senderAddress || "",
      letters: letters,
    };
  }

  // Validation (section 5). Returns { errors, warnings }. File-level checks
  // (duplicate PAN) are done by validateAll.
  function validateRow(raw, settings) {
    var errors = [], warnings = [];
    var NUM_KEYS = ["opening", "closing", "servicePurchaseCapital", "servicePurchaseOthers",
      "goodPurchaseCapital", "goodPurchaseOthers", "serviceSales", "goodSales", "salesReturn",
      "purchaseReturn", "vatPurchase", "vatSales", "exemptPurchase", "exemptSales", "tdsUs",
      "tdsParty", "retention"];
    NUM_KEYS.forEach(function (k) {
      var r = toNum(raw[k]);
      if (!r.ok) errors.push("'" + (KEYS[k] || k) + "' is not a number.");
      else if (r.value < 0) errors.push("'" + (KEYS[k] || k) + "' is negative.");
    });
    if (panDigits(raw.pan).length !== 9) errors.push("PAN must be exactly 9 digits.");
    if (!String(raw.tradename == null ? "" : raw.tradename).trim()) errors.push("Party name is required.");
    if (!String(raw.receiverAddress == null ? "" : raw.receiverAddress).trim()) errors.push("Receiver address is required.");

    var f = figures(raw, settings);
    if (f.opening !== 0 && !f.openingDrCr) errors.push("Opening Dr/Cr is missing or invalid.");
    if (f.closing !== 0 && !f.closingDrCr) errors.push("Closing Dr/Cr is missing or invalid.");
    if (f.W > f.reportablePurchase + 1e-9) errors.push("Exempt Purchase is greater than the reportable purchase (D+E+F+G).");
    if (f.X > f.reportableSales + 1e-9) errors.push("Exempt Sales is greater than the reportable sales (H+I).");

    if (filled(raw, "vatPurchase") && Math.abs(f.vatPurchase - f.vatPurchaseCalc) > 1)
      warnings.push("VAT on Purchase differs from the calculated figure by more than Rs 1 (letter uses the entered figure).");
    if (filled(raw, "vatSales") && Math.abs(f.vatSales - f.vatSalesCalc) > 1)
      warnings.push("VAT on Sales differs from the calculated figure by more than Rs 1 (letter uses the entered figure).");
    if (settings && settings.senderPan && filled(raw, "senderPan") && panDigits(raw.senderPan) !== panDigits(settings.senderPan))
      warnings.push("Row sender PAN differs from the form's sender PAN.");

    var allZero = [f.D, f.E, f.F, f.G, f.H, f.I, f.W, f.X, f.salesReturn, f.purchaseReturn,
      f.vatPurchase, f.vatSales, f.tdsUs, f.tdsParty, f.retention, f.opening, f.closing]
      .every(function (x) { return x === 0; });
    if (allZero) warnings.push("All transaction amounts and both balances are 0.");

    return { errors: errors, warnings: warnings };
  }

  // Validate a set of rows; adds the duplicate-PAN warning. Returns an array of
  // { errors, warnings, status } aligned with rows.
  function validateAll(rows, settings) {
    var counts = {};
    rows.forEach(function (r) { var p = panDigits(r.pan); if (p) counts[p] = (counts[p] || 0) + 1; });
    return rows.map(function (raw) {
      var v = validateRow(raw, settings);
      var p = panDigits(raw.pan);
      if (p && counts[p] > 1) v.warnings = v.warnings.concat(["Duplicate PAN in the file: " + p + "."]);
      v.status = v.errors.length ? "error" : (v.warnings.length ? "warning" : "ok");
      return v;
    });
  }

  // Annexure 13 export row (values only, columns A..J as entered).
  function annexure13Row(raw) {
    return ANNEXURE13_KEYS.map(function (k) {
      if (k === "pan") return panDigits(raw.pan);
      if (k === "tradename") return String(raw.tradename == null ? "" : raw.tradename).trim();
      return n(raw, k);
    });
  }
  // Confirmation-register row (follow-up columns left blank).
  function registerRow(raw, settings) {
    var f = figures(raw, settings);
    return [
      String(raw.tradename == null ? "" : raw.tradename).trim(),
      panDigits(raw.pan),
      fmtBalance(f.opening, f.openingDrCr),
      fmt(f.reportablePurchase),
      fmt(f.reportableSales),
      fmtBalance(f.closing, f.closingDrCr),
      settings.letterDate, "", "", "", "", "",
    ];
  }

  // File-name tag for one letter (sanitised): {Party}_{PAN}_Balance_Confirmation_{FY}
  function fileName(raw, settings) {
    function san(s) { return String(s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
    var party = san(raw.tradename).slice(0, 40) || "Party";
    var fy = san(settings.fy);
    return party + "_" + panDigits(raw.pan) + "_Balance_Confirmation_" + fy + ".docx";
  }

  return {
    KEYS: KEYS, ANNEXURE13: ANNEXURE13, ANNEXURE13_KEYS: ANNEXURE13_KEYS,
    REGISTER_HEADERS: REGISTER_HEADERS, DEFAULT_VAT_RATE: DEFAULT_VAT_RATE,
    normDrCr: normDrCr, toNum: toNum, figures: figures,
    letterData: letterData, templateData: templateData,
    validateRow: validateRow, validateAll: validateAll,
    annexure13Row: annexure13Row, registerRow: registerRow, fileName: fileName,
    fmt: fmt, fmtBalance: fmtBalance,
  };
});
