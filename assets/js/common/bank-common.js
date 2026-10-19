/*
 * P.S.G. & Associates - shared Bank Docs logic (pure, no DOM, no network).
 * Used by BOTH Bank Docs tools: Account Opening (bank-core.js) and Statement
 * Request (bank-statement-core.js). Holds the date helpers and the signature
 * "two per row" block loop so the two tools never drift.
 *
 * UMD: window.BankCommon in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BankCommon = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }
  function ordSuffix(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return (s[(v - 20) % 10] || s[v] || s[0]); }
  function longAD(d) { return MONTHS[d.m - 1] + " " + d.d + ", " + d.y; }          // July 28, 2026
  function monthYear(d) { return MONTHS[d.m - 1] + " " + d.y; }                    // July 2026
  // Superscript-ordinal date parts: "16" / "th" / "October 2026"
  function ordinalParts(d) { return { day: String(d.d), ord: ordSuffix(d.d), monthyear: monthYear(d) }; }
  function fmtYMD(d) { return d.y + "/" + pad2(d.m) + "/" + pad2(d.d); }           // 2025/07/17
  function adUTC(d) { return Date.UTC(d.y, d.m - 1, d.d); }
  function hisHer(title) { return /^mr/i.test(String(title || "").trim()) ? "His" : "Her"; }
  function titleName(p) { return ((p.title ? p.title + " " : "") + (p.name || "")).trim(); }

  // Signature blocks, two per row (left/right), as a docxtemplater loop payload.
  function group2(list) {
    var rows = [];
    for (var i = 0; i < list.length; i += 2) {
      var a = list[i], b = list[i + 1];
      rows.push({
        a_name: a.name, a_designation: a.designation,
        has_b: !!b, b_name: b ? b.name : "", b_designation: b ? b.designation : "",
      });
    }
    return rows;
  }

  function shortName(name) { return (name || "Entity").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) || "Entity"; }

  return {
    MONTHS: MONTHS, pad2: pad2, ordSuffix: ordSuffix, longAD: longAD, monthYear: monthYear,
    ordinalParts: ordinalParts, fmtYMD: fmtYMD, adUTC: adUTC, hisHer: hisHer,
    titleName: titleName, group2: group2, shortName: shortName,
  };
});
