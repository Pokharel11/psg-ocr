/*
 * P.S.G. & Associates — shared Bikram Sambat / AD date helpers, on the SAME
 * nepali-date-converter library the website compliance calendar uses. Month
 * display names match the website (Ashad / Ashoj). Tool-agnostic: used by Audit
 * Docs and Bank Docs and their tests.
 *
 * UMD: window.PSGBSDate in the browser (needs NepaliDate + PSGNum already loaded),
 * module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("nepali-date-converter"), require("./psg-num"));
  } else {
    root.PSGBSDate = factory(root.NepaliDate, root.PSGNum);
  }
})(typeof self !== "undefined" ? self : this, function (ndModule, PSGNum) {
  "use strict";

  var NepaliDate = ndModule.default || ndModule;
  var CONFIG = ndModule.dateConfigMap;
  var ordinal = PSGNum.ordinal;

  // Display month names and the library's internal config keys (for day counts).
  var BS_MONTHS = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var BS_CFG = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var AD_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var ASHAD = 2; // month index of Ashad (FY end month)
  var DAY = 86400000;

  function bsMonthDays(y, m0) { var row = CONFIG[String(y)]; return row ? row[BS_CFG[m0]] : 32; }
  function bsToAdUTC(y, m0, day) { var ad = new NepaliDate(y, m0, day).getAD(); return Date.UTC(ad.year, ad.month, ad.date); }
  function adUTCtoBS(utc) { var d = new NepaliDate(new Date(utc + 12 * 3600000)); return { y: d.getYear(), m0: d.getMonth(), day: d.getDate() }; }
  function formatBS(y, m0, day) { return ordinal(day) + " " + BS_MONTHS[m0] + ", " + y; }
  function formatAD(utc) { var d = new Date(utc); return ordinal(d.getUTCDate()) + " " + AD_MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function addBSDays(y, m0, day, n) { return adUTCtoBS(bsToAdUTC(y, m0, day) + n * DAY); }

  // FY start year -> its Ashad end {y, m0, day, adUTC}
  function fyEnd(startYear) {
    var endY = startYear + 1, day = bsMonthDays(endY, ASHAD);
    return { y: endY, m0: ASHAD, day: day, adUTC: bsToAdUTC(endY, ASHAD, day) };
  }
  function fyShort(startYear) { return "FY " + startYear + "/" + String(startYear + 1).slice(-2); }
  function fyLabel(fromY, toY) { return fromY === toY ? fyShort(fromY) : fyShort(fromY) + " to " + fyShort(toY); }

  return {
    BS_MONTHS: BS_MONTHS, BS_CFG: BS_CFG, AD_MONTHS: AD_MONTHS, ASHAD: ASHAD, DAY: DAY,
    bsMonthDays: bsMonthDays, bsToAdUTC: bsToAdUTC, adUTCtoBS: adUTCtoBS,
    formatBS: formatBS, formatAD: formatAD, addBSDays: addBSDays,
    fyEnd: fyEnd, fyShort: fyShort, fyLabel: fyLabel,
  };
});
