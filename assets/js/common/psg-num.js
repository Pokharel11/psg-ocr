/*
 * P.S.G. & Associates — shared number helpers (ordinals, money grouping, amount in
 * words in the Nepali system). Tool-agnostic: used by Audit Docs and Bank Docs and
 * their tests. No DOM, no network.
 *
 * UMD: window.PSGNum in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSGNum = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function groupIntl(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function groupNepali(intStr) {
    if (intStr.length <= 3) return intStr;
    var last3 = intStr.slice(-3), rest = intStr.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  function formatMoney(amount, decimals, grouping) {
    var neg = amount < 0; amount = Math.abs(amount);
    var fixed = amount.toFixed(decimals);
    var parts = fixed.split(".");
    var intPart = (grouping === "nepali" ? groupNepali : groupIntl)(parts[0]);
    return (neg ? "-" : "") + intPart + (parts[1] ? "." + parts[1] : "");
  }

  var ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  var TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function twoWords(n) {
    if (n < 20) return ONES[n];
    var t = TENS[Math.floor(n / 10)], o = n % 10;
    return o ? t + " " + ONES[o] : t;
  }
  function threeWords(n) {
    var h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(ONES[h] + " Hundred");
    if (r) out.push(twoWords(r));
    return out.join(" ");
  }
  // Nepali numbering (Thousand, Lakh, Crore, Arab), ending "Only"; paisa as "and Paisa NN".
  function amountInWords(amount) {
    var rupees = Math.floor(Math.abs(amount) + 1e-9);
    var paisa = Math.round((Math.abs(amount) - rupees) * 100);
    var parts = [];
    var arab = Math.floor(rupees / 1000000000); rupees %= 1000000000;
    var crore = Math.floor(rupees / 10000000); rupees %= 10000000;
    var lakh = Math.floor(rupees / 100000); rupees %= 100000;
    var thousand = Math.floor(rupees / 1000); rupees %= 1000;
    if (arab) parts.push(twoWords(arab) + " Arab");
    if (crore) parts.push(twoWords(crore) + " Crore");
    if (lakh) parts.push(twoWords(lakh) + " Lakh");
    if (thousand) parts.push(twoWords(thousand) + " Thousand");
    if (rupees) parts.push(threeWords(rupees));
    var words = parts.join(" ");
    if (!words) words = "Zero";
    if (paisa > 0) words += " and Paisa " + twoWords(paisa);
    return words + " Only";
  }

  return { ordinal: ordinal, formatMoney: formatMoney, amountInWords: amountInWords };
});
