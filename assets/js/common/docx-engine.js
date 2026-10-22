/*
 * P.S.G. & Associates — shared Word-template engine (docxtemplater + PizZip).
 * Fills a reference-based .docx template so output matches the firm's reference in
 * font, spacing and layout; strips the reference's yellow highlights unless review
 * mode is on; and can split a filled document at its letter/section page breaks.
 * Tool-agnostic: used by Audit Docs and Bank Docs and their tests. Nothing is sent
 * or stored; data stays in memory.
 *
 * UMD: window.PSGDocx in the browser (needs PizZip + docxtemplater already loaded),
 * module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("pizzip"), require("docxtemplater"));
  } else {
    root.PSGDocx = factory(root.PizZip, root.docxtemplater);
  }
})(typeof self !== "undefined" ? self : this, function (PizZip, DocxtemplaterMod) {
  "use strict";
  var Docxtemplater = DocxtemplaterMod && (DocxtemplaterMod.default || DocxtemplaterMod);

  // Fill the template and return a PizZip instance (filled doc).
  function fillZip(templateBytes, data, opts) {
    opts = opts || {};
    var zip = new PizZip(templateBytes);
    var doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });
    doc.render(data);
    var out = doc.getZip();
    if (!opts.highlight) {
      // Normal output: no yellow highlights, in the body AND any header/footer
      // parts (the Balance Confirmation letterhead lives in a header). Review
      // mode keeps them, as in the reference.
      Object.keys(out.files).forEach(function (name) {
        if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) {
          out.file(name, out.file(name).asText().replace(/<w:highlight w:val="yellow"\/>/g, ""));
        }
      });
    }
    return out;
  }

  function bytes(zip) { return zip.generate({ type: "uint8array" }); }

  // One combined .docx (all parts, with the template's own page breaks between them).
  function combined(templateBytes, data, opts) { return bytes(fillZip(templateBytes, data, opts)); }

  // Split a filled document into (cuts + 1) .docx, cutting at the first `cuts`
  // letter/section-boundary page breaks (an empty paragraph whose only content is a
  // page break). Any later page break stays inside its section. Each output keeps
  // the body's section properties and all other parts (styles, numbering, …).
  function sections(templateBytes, data, opts, cuts) {
    var filled = fillZip(templateBytes, data, opts);
    var xml = filled.file("word/document.xml").asText();
    var bodyOpenEnd = xml.indexOf(">", xml.indexOf("<w:body")) + 1;
    var bodyEnd = xml.lastIndexOf("</w:body>");
    var head = xml.slice(0, bodyOpenEnd);
    var tail = xml.slice(bodyEnd); // "</w:body></w:document>"
    var inner = xml.slice(bodyOpenEnd, bodyEnd);

    var sect = "";
    var sectM = inner.match(/<w:sectPr\b[\s\S]*<\/w:sectPr>\s*$/);
    if (sectM) { sect = sectM[0]; inner = inner.slice(0, sectM.index); }

    var blocks = (inner.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g)) || [];
    function isBreak(b) {
      if (!/^<w:p[ >]/.test(b)) return false;
      if (!/<w:br w:type="page"\/>/.test(b)) return false;
      var t = (b.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
        .map(function (s) { return s.replace(/<[^>]+>/g, ""); }).join("");
      return !t.trim();
    }
    var cutIdx = [];
    for (var i = 0; i < blocks.length && cutIdx.length < cuts; i++) if (isBreak(blocks[i])) cutIdx.push(i);

    function build(group) {
      var z = new PizZip(bytes(filled)); // clone the filled package
      z.file("word/document.xml", head + group.join("") + sect + tail);
      return z.generate({ type: "uint8array" });
    }
    var out = [], start = 0;
    for (var c = 0; c < cutIdx.length; c++) { out.push(build(blocks.slice(start, cutIdx[c]))); start = cutIdx[c] + 1; }
    out.push(build(blocks.slice(start)));
    return out;
  }

  return { fillZip: fillZip, bytes: bytes, combined: combined, sections: sections };
});
