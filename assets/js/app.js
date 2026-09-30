/* P.S.G. & Associates - OCR Document Generator (client-side)
   Builds the OCR compliance .docx entirely in the browser using the docx library.
   No server: documents are generated on the device and downloaded directly. */
(function () {
  "use strict";

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
  } = window.docx;

  // ── STATE ──
  let currentStep = 0;
  let directors = [];
  let auditorChangeEnabled = false;
  let dirCount = 0;
  let lastBlob = null, lastFilename = "";

  // ── NEPALI HELPERS ──
  const nepNums = ['०','१','२','३','४','५','६','७','८','९'];
  function toNep(n) { return String(n).split('').map(c => /[0-9]/.test(c) ? nepNums[+c] : c).join(''); }
  window.toNepaliNum = toNep;
  function toNepaliAmount(n) {
    if (!n) return '';
    const num = parseInt(n.toString().replace(/,/g, ''));
    if (isNaN(num)) return n;
    return toNep(num.toLocaleString('en-IN'));
  }

  // ── DOCX BUILDERS (ported from server.js) ──
  const F = 'Mangal';
  const bdr = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const BORDERS = { top: bdr, bottom: bdr, left: bdr, right: bdr };
  const NOBORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const NOBORDERS = { top: NOBORDER, bottom: NOBORDER, left: NOBORDER, right: NOBORDER };

  function P(text, opts = {}) {
    return new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: opts.spaceBefore ?? 60, after: opts.spaceAfter ?? 60 },
      children: [new TextRun({ text: text || '', bold: opts.bold || false, size: opts.size || 22,
        font: F, underline: opts.underline ? {} : undefined })]
    });
  }
  function PB() { return new Paragraph({ children: [new PageBreak()] }); }
  function heading(text, sub) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: sub ? 60 : 120 },
      children: [new TextRun({ text, bold: true, size: sub ? 24 : 28, font: F })]
    });
  }
  function subHead(text) {
    return new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text, bold: true, size: 22, font: F, underline: {} })]
    });
  }
  function TC(text, opts = {}) {
    return new TableCell({
      borders: opts.noBorder ? NOBORDERS : BORDERS,
      width: { size: opts.w || 2000, type: WidthType.DXA },
      shading: opts.header ? { fill: 'D5D5D5', type: ShadingType.CLEAR } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalMerge: opts.vMerge,
      children: [new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: text || '', bold: opts.header || opts.bold || false, size: 20, font: F })]
      })]
    });
  }
  function attendanceTable(allMembers) {
    const rows = [
      new TableRow({ children: [
        TC('क्र.सं.', { w: 800, header: true, center: true }),
        TC('नाम', { w: 3200, header: true }),
        TC('पद', { w: 2000, header: true }),
        TC('हस्ताक्षर', { w: 3200, header: true }),
      ]}),
      ...allMembers.map((m, i) => new TableRow({ children: [
        TC(toNep(i + 1) + '.', { w: 800, center: true }),
        TC(m.name, { w: 3200 }),
        TC(m.role, { w: 2000 }),
        TC('', { w: 3200 }),
      ]}))
    ];
    return new Table({ width: { size: 9200, type: WidthType.DXA }, columnWidths: [800, 3200, 2000, 3200], rows });
  }

  function buildAllDocs(data) {
    const { companyName, companyAddress, regNumber, chairmanName, chairmanAddr,
      directors, bodAuditorDate, sgmDate, bodDate, agmDate, appDate,
      fiscalYear, nextFiscalYear, prevAuditorFirm, prevAuditorName,
      curAuditorFirm, auditorName, nextAuditorFirm, nextAuditorName,
      numShares, authCapital, issuedCapital, paidUpCapital, paidAmt, unpaidCapital,
      auditorChange } = data;

    const allBOD = [
      { name: chairmanName, addr: chairmanAddr, role: 'अध्यक्ष' },
      ...directors.map(d => ({ name: d.name, addr: d.addr, role: 'संचालक' }))
    ];

    const children = [];

    // DOC 1 & 2: SGM CALL + SGM MINUTE (only if auditor change)
    if (auditorChange) {
      children.push(
        heading(companyName),
        P('कम्पनी दर्ता नं: ' + regNumber, { center: true }),
        P(''),
        heading('सञ्चालक समितिको बैठक', true),
        P(''),
        P(companyName + ' को सञ्चालक समितिको बैठक ' + chairmanName + ' को अध्यक्षतामा, निम्न स्थान, मिति र समयमा, निम्न लिखित व्यक्तिहरुको उपस्थितिमा बसि देहायका विषयमा, देहायका निर्णयहरु पारित गरियो ।'),
        P(''),
        P('स्थान :     ' + companyAddress),
        P('मिति :-     ' + bodAuditorDate),
        P('समय :-     ११.०० बजे'),
        P(''),
        subHead('उपस्थिति'),
        attendanceTable(allBOD),
        P(''),
        subHead('प्रस्तावबहरु'),
        P('(१)   बिशेष साधारण सभा बोलाउने सम्बन्धमा ।'),
        P('(२)   अन्य ।'),
        P(''),
        subHead('निर्णय न १'),
        P('यस कम्पनीको बिशेष साधारण सभा मिति ' + sgmDate + ' गतेका दिन कम्पनीको कार्यालयमा बस्ने र सो साधारण सभामा तपसिल बिषयहरुमा छलफल गर्ने निर्णय सर्बसम्मितबाट पारित गरियो । साथै साधारण सभा बस्ने मिति, स्थान र समयका बारेमा कम्पनीका सम्पूर्ण शेयरहोल्डरहरुलाई सुचना गर्ने निर्णय गरियो ।'),
        P('(१) लेखा परीक्षक परिवर्तन गर्ने ।'),
        P('(२) अन्य ।'),
        P(''),
        subHead('निर्णय न २'),
        P('अन्य बिषय नरहेकाले बैठक यत्तिमै सकियो ।'),
      );
      children.push(
        PB(),
        heading(companyName),
        P('कम्पनी दर्ता नं: ' + regNumber, { center: true }),
        P(''),
        heading('विशेष साधारण सभाको बैठक', true),
        P(''),
        P(companyName + ' को विशेष साधारण सभाको बैठक ' + chairmanName + ' को अध्यक्षतामा, निम्न स्थान, मिति र समयमा, निम्न लिखित व्यक्तिहरुको उपस्थितिमा बसि देहायका विषयमा, देहायका निर्णयहरु पारित गरियो ।'),
        P(''),
        P('स्थान :     ' + companyAddress),
        P('मिति :-     ' + sgmDate),
        P('समय :-     ११.०० बजे'),
        P(''),
        subHead('उपस्थिति'),
        attendanceTable(allBOD),
        P(''),
        subHead('प्रस्तावबहरु'),
        P('(१) लेखा परीक्षक परिवर्तन गर्ने ।'),
        P('(२) अन्य ।'),
        P(''),
        subHead('सभाको वैधानिकता'),
        P('आजको यस सभा वैधानिक भए नभएको सम्बन्धमा छलफल गर्दा यस सभामा गाणपुरक संख्या पुगी सभा वैधानिक भएकोले अध्यक्ष ज्युले सभाको कारवाही अगाडि बढाउन निर्देशन दिनुभयो ।'),
        P(''),
        subHead('निर्णय न १'),
        P('साधारण सभाले नियुक्त गरेको आ. व. ' + fiscalYear + ' को लेखा परिक्षक ' + prevAuditorFirm + ' का लेखापरिक्षक ' + prevAuditorName + ' को कार्यव्यस्तता भएको कारण विशेष साधारण सभाले लेखा परीक्षक परिवर्तन गरी लेखा परीक्षक ' + curAuditorFirm + ' का ' + auditorName + ' लाई लेखा परीक्षकको रुपमा नियुक्त गरेको छ ।'),
        P(''),
        subHead('निर्णय न २'),
        P('अन्य बिषय नरहेकाले बैठक यत्तिमै सकियो ।'),
      );
    }

    // DOC 3: BENEFICIARY OWNER DETAIL
    children.push(
      heading(companyName),
      P(companyAddress, { center: true }),
      P('कम्पनी दर्ता नं: ' + regNumber, { center: true }),
      P(''),
      heading('वास्तविक धनी (Beneficiary Owner) सम्बन्धी विवरण', true),
      P('(कम्पनी ऐन, २०६३ तथा सम्पत्ति शुद्धीकरण (मनि ल्याण्डरिङ) निवारण ऐन, २०६४ को व्यवस्था अनुसार)', { center: true }),
      P(''),
      P('१) कम्पनीका कुन शेयरधनीको अन्य वास्तविक धनी नभएको भनी सो शेयरधनीले स्वघोषणा गरेको भएमा सो उल्लेख गर्नुहोस् (तल नं. २ भर्नु पर्दैन)'),
      P('कम्पनीका कुनै शेयरधनीको अन्य वास्तविक धनी नभएको स्वघोषणा गर्दछु ।'),
      P(''),
      P('२) सम्बन्धित शेयरधनीले घोषणा गरेको अनुसार अन्य वास्तविक धनी भएमा शेयरधनीको विवरण:'),
      new Table({
        width: { size: 9200, type: WidthType.DXA },
        columnWidths: [460, 1300, 1300, 1300, 1300, 1400, 1280, 860],
        rows: [
          new TableRow({ children: [
            TC('क्र.सं.', { w: 460, header: true, center: true }),
            TC('शेयरधनीको नाम', { w: 1300, header: true }),
            TC('शेयरधनीको ठेगाना', { w: 1300, header: true }),
            TC('वास्तविक धनीको नाम', { w: 1300, header: true }),
            TC('वास्तविक धनीको ठेगाना', { w: 1300, header: true }),
            TC('वास्तविक धनीको नागरिकता नं.', { w: 1400, header: true }),
            TC('धारण गरेको शेयर प्रतिशत', { w: 1280, header: true }),
            TC('कैफियत', { w: 860, header: true }),
          ]}),
          new TableRow({ children: [
            TC('', { w: 460 }), TC('', { w: 1300 }), TC('', { w: 1300 }), TC('', { w: 1300 }),
            TC('', { w: 1300 }), TC('', { w: 1400 }), TC('', { w: 1280 }), TC('', { w: 860 }),
          ]}),
        ]
      }),
      P('नोट: कुनै शेयरधनीको एकभन्दा बढी वास्तविक धनी भएमा क्रमशः उल्लेख गर्ने ।'),
      P(''), P(''), P(''), P(''),
      P('.....................................'),
      P(chairmanName),
      P('अध्यक्ष'),
      P(companyName),
    );

    // DOC 4: AGM CALL MINUTE
    children.push(
      PB(),
      heading(companyName + ' को'),
      heading('संचालक समितिको निर्णय', true),
      P(''),
      P('आज मिति ' + bodDate + ' गते दिउँसो १ बजे यस कम्पनीको संचालक समितिको बैठक यस कम्पनीका अध्यक्ष ' + chairmanName + ' को अध्यक्षतामा बैठक बसि तपशिल बमोजिमको महानुभावको उपस्थितिमा निम्नाअनुसारको निर्णय गरियो ।'),
      P(''),
      subHead('उपस्थिति :'),
      attendanceTable(allBOD),
      P(''),
      subHead('छलफलका प्रस्तावहरु'),
      P('१. वार्षिक साधरण सभा बोलाउने सम्बन्धमा ।'),
      P('२. विविध ।'),
      P(''),
      subHead('निर्णयहरु'),
      subHead('निर्णय नं. १ वार्षिक साधरण सभा बोलाउने सम्बन्धमा:'),
      P('प्रस्ताव नं.१ माथि छलफल गर्दा यस कम्पनीको साधरण सभा मिति ' + agmDate + ' गतेका दिन कम्पनीको रजिष्टर्ड कार्यालयमा बिहान १० बजे र सो सभामा तपशिल बमोजिमको विषयहरुमा छलफल गर्ने निर्णय सर्वसम्मति बाट गरियो ।'),
      P(''),
      subHead('तपशिल'),
      P('क) संचालक समितीको वार्षिक प्रतिवेदन उपर छलफल गर्ने सम्बन्धमा ।'),
      P('ख) आ.व. ' + fiscalYear + ' को वार्षिक लेखा परिक्षण प्रतिवेदन एवं नाफा नोक्सान हिसाब, वासलात आदि माथि छलफल सम्बन्धमा ।'),
      P('ग) आ.व. ' + nextFiscalYear + ' को लागि लेखा परिक्षक नियुक्ति गर्ने सम्बन्धमा ।'),
      P('घ) विविध'),
      P(''),
      subHead('निर्णय नं.२. विविधः'),
      P('प्रस्ताव नं. २ माथि छलफल गर्दा विषयहरु उपर छलफल गरि निर्णय गर्न बाँकी विषयहरु नभएकोले उपस्थित सवै महानुभावहरुलाई धन्यवाद प्रदान गर्दै सभाका अध्यक्ष ज्युले यस कम्पनीको संचालक समितिको बैठकको विसर्जन भएको घोषणा गर्नु भयो ।'),
    );

    // DOC 5: AGM MINUTE
    children.push(
      PB(),
      heading(companyName + ' को'),
      heading('वार्षिक साधरण सभाको निर्णय', true),
      P(''),
      P('आज मिति ' + agmDate + ' गते बिहान १० बजे यस कम्पनीको वार्षिक साधरण सभाको बैठक यस कम्पनीका अध्यक्ष ' + chairmanName + ' को अध्यक्षतामा बैठक बसि तपशिल बमोजिमको महानुभावको उपस्थितिमा निम्नाअनुसारको निर्णय गरियो ।'),
      P(''),
      subHead('उपस्थिति :'),
      attendanceTable(allBOD),
      P(''),
      subHead('गणपुरक संख्या'),
      P('यस कम्पनीको नियमावलिको नियम बमोजिम सम्पूर्ण शेयरधनि स्वयं उपस्थित हुनु भई कम्पनी ऐन तथा यस कम्पनीको नियमावली बमोजिम सभा संचालन गर्न आवश्यक गणपुरक संख्या पुगेको हुँदा सो बारेमा सभामा उपस्थिती सवै शेयरधनिहरुलाई सभाको वैधानिकता बारे जानकारि गराउदै मिति ' + bodDate + ' मा बोलाईएको यस कम्पनीको वार्षिक साधरण सभामा निम्न उल्लेखित प्रस्तावहरु उपर सभामा छलफल गरि निर्णय गर्न सभाको अध्यक्ष ज्युले सभा संचालन गर्नु भयो ।'),
      P(''),
      subHead('प्रस्तावहरु'),
      P('१. अध्यक्षद्वारा वार्षिक प्रतिवेदन प्रस्तुत गर्ने सम्बन्धमा ।'),
      P('२. आ.व. ' + fiscalYear + ' को वित्तीय विवरण तथा लेखापरिक्षण प्रतिवेदन सम्बन्धमा छलफल गरि पारित गर्ने सम्बन्धमा ।'),
      P('३. आ.व. ' + nextFiscalYear + ' को लेखा परिक्षक नियुक्ति गर्ने सम्बन्धमा ।'),
      P('४. विविध'),
      P(''),
      subHead('निर्णयहरु'),
      subHead('निर्णय नं: १.अध्यक्षद्वारा वार्षिक विवरण प्रस्तुत गर्ने सम्बन्धमा:'),
      P('प्रस्ताव नं १ माथि छलफल गर्दा कम्पनीका अध्यक्षले प्रस्तुत गर्नु भएको वार्षिक प्रतिवेदन प्रति धन्यवाद दिने निर्णय गरियो ।'),
      P(''),
      subHead('निर्णय नं. २. गत वर्षको वित्तीय विवरण तथा लेखापरिक्षण प्रतिवेदन सम्बन्धमा छलफल गरि पारित गर्ने सम्बन्धमा:'),
      P('प्रस्ताव नं २ माथि छलफल गर्दा कम्पनीका लेखापरिक्षक ' + curAuditorFirm + ' का ' + auditorName + ' ज्युले यस सभा समक्ष प्रस्तुत गर्नुभएको आ.व. ' + fiscalYear + ' को लेखापरिक्षक प्रतिवेदन तथा आय व्यय विवरण र वासलात माथि छलफल भई समर्थन गर्ने निर्णय गरियो ।'),
      P(''),
      subHead('निर्णय नं. ३. आ.व. ' + nextFiscalYear + ' को लागि लेखा परिक्षक नियुक्ति गर्ने सम्बन्धमा:'),
      P('प्रस्ताव नं ३ माथि छलफल गर्दा कम्पनी ऐन २०६३ को दफा १११ बमोजिम आर्थिक वर्ष ' + nextFiscalYear + ' को लागि कम्पनीका लेखापरिक्षक ' + nextAuditorFirm + ' का ' + nextAuditorName + ' ज्युलाई नियुक्ति गर्ने र पारिश्रमिकको हकमा लेखापरिक्षकज्युको आपिस सहमतिमा निर्धारण गर्ने निर्णय गरियो ।'),
      P(''),
      subHead('निर्णय नं ४ विविधः'),
      P('प्रस्ताव नं ४ माथि छलफल गर्दा बैठकको अन्य विषय नहुनाले आजको बैठक यहि समाप्त गर्ने निर्णय गरियो ।'),
    );

    // DOC 6: APPLICATION LETTER (Section 50)
    children.push(
      PB(),
      P('मिति ' + appDate, { right: true }),
      P(''),
      P('श्रीमान कम्पनी रजिष्ट्रार ज्यू'),
      P('कम्पनी रजिष्ट्रारको कार्यालय'),
      P('त्रिपुरेश्वर, काठमाण्डौ'),
      P(''),
      subHead('विषय :-दफा ५० (२) बमोजिमको कागजात पेश गरेको सम्बन्धमा ।'),
      P(''),
      P('महोदय,'),
      P(''),
      P('उपरोक्त सम्बन्धमा यस कम्पनीको मिति ' + agmDate + ' मा बसेको वार्षिक साधारण सभा, उक्त सभाले गरेको निर्णयहरु र लेखापरिक्षककोको आर्थिक बर्षको वार्षिक प्रतिवेदन र दफा ५१ को विवरण, कम्पनी ऐन २०६३ को दफा ५० (२) को प्रयोजनको लागि पेश गरेका छौं । सोको अभिलेख गराई पाउँ ।'),
      P(''),
      P('निवेदक'),
      P(''), P(''), P(''), P(''), P(''),
      P(chairmanName),
      P('अध्यक्ष'),
      P(companyName),
    );

    // DOC 7: SECTION 92 — ONE PER BOD MEMBER
    allBOD.forEach((member) => {
      children.push(
        PB(),
        heading(companyName + ' को'),
        heading('कम्पनी ऐन, २०६३ को दफा ९२ को विवरण', true),
        P(''),
        P('क) कम्पनीको कारोबार संग सम्बन्धित कुनै प्रकारको खरिद बिक्की वा अन्य प्रकारको ठेक्का पट्टामा आफू वा आफ्नो निजकको नातेदारको प्रत्यक्ष संलग्नता भएमा वा कुनै किसिमको निजी स्वार्थ भएमा - छैन ।'),
        P('ख) कम्पनीको प्रबन्ध सञ्चालक, कम्पनी सचिव, पदाधिकारीको नियुक्तिको सम्बन्धमा कुनै प्रकारको स्वार्थ भएमा - छैन ।'),
        P('ग) अन्य कुनै कम्पनीको सञ्चालक रहेमा- छ ।'),
        P('घ) कम्पनी वा त्यस्तो कम्पनीको मुख्य वा सहायक कम्पनीको शेयर वा डिबेञ्चरको कारोबार गरेको भएमा त्यस्तो कारोबारको विषयमा - नभएको ।'),
        P(''), P(''), P(''), P(''), P(''), P(''),
        P('.....................................'),
        P(member.name),
        P(member.role),
        P(companyName),
      );
    });

    // DOC 8: SECTION 51
    const dirRows = allBOD.map((m, i) => new TableRow({ children: [
      TC(toNep(i + 1), { w: 700, center: true }),
      TC(m.name, { w: 2700 }),
      TC(i === 0 ? 'संचालक/ अध्यक्ष' : 'संचालक', { w: 2000 }),
      TC(m.addr, { w: 3800 }),
    ]}));

    children.push(
      PB(),
      heading(companyName),
      P('कम्पनी दर्ता नं: ' + regNumber, { center: true }),
      P(''),
      heading('कम्पनी रजिष्ट्रारको कार्यालयमा पेश गर्नुपर्ने', true),
      heading('कम्पनी ऐन, २०६३ को दफा ५१ बमोजिमको', true),
      heading('शेयर, डिवेन्चर र ऋणको लगत', true),
      P(''),
      subHead('दफा ५१ (१)'),
      P('यस ' + companyName + ' मा स्वीकृत साविकको शेयरलागतमा उल्लेख भएबमोजिम नै शेयधनीहरु भएको कुरा जानकारी गराउदछौं ।'),
      P(''),
      subHead('दफा ५१ (२)'),
      P('क) कम्पनीको अधिकृत पूँजि र शेयरको संख्या:- अधिकृत पूँजि रु. ' + authCapital + '/- शेयर संख्या ' + (numShares ? toNep(numShares) : '') + '/'),
      P('ख) कम्पनीको जारी शेयर पूँजि :रु. ' + issuedCapital + '/-'),
      P('ग) कम्पनीको चुक्ता पूँजि :- रु. ' + paidUpCapital + '/-'),
      P('घ) शेयरपिच्छे माग भएको रकम :-प्रतिकित्ता रु १००/-का दरले ।'),
      P('ड) किस्ता असुल भएको जम्मा रकम : रु. ' + paidAmt + '/-'),
      P('च) असुल हुन बाँकी रहेको रकम:- ' + unpaidCapital),
      P('छ) शेयर वा डिवेन्चरमा दलाली दस्तुर वापत दिएको जम्मा रकम: छैन ।'),
      P('ज) कुनै शेयर जफत गरिएकोमा त्यस्तो शेयरको जम्मा संख्या, जफत भएको कारण र मिति: छैन ।'),
      P('फ) बैंक, वित्तिय संस्था वा अन्य कुनै व्यक्तिबाट लिएको ऋण वा कम्पनीले दिएको जमानत:- नभएको ।'),
      P('(१) यस कम्पनीले अन्य कुनै कम्पनीमा लगानी गरेको भए त्यस्तो कम्पनीको नाम, दर्ता नम्बर लगानी गरेको रकम: छैन ।'),
      P(''), P(''), P(''), P(''), P(''), P(''), P(''), P(''), P(''), P(''), P(''),
      subHead('ञ) बहालवाला सञ्चालकको नाम र ठेगाना :-'),
      new Table({
        width: { size: 9200, type: WidthType.DXA },
        columnWidths: [700, 2700, 2000, 3800],
        rows: [
          new TableRow({ children: [
            TC('क्र.सं.', { w: 700, header: true, center: true }),
            TC('नाम थर', { w: 2700, header: true }),
            TC('पद', { w: 2000, header: true }),
            TC('ठेगाना', { w: 3800, header: true }),
          ]}),
          ...dirRows,
        ]
      }),
      P(''), P(''), P(''), P(''), P(''), P(''),
      P(chairmanName),
      P('अध्यक्ष'),
      P(companyName),
    );

    return children;
  }

  // ── NAVIGATION ──
  function goTo(step) {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-' + step).classList.add('active');
    document.getElementById('nav-' + step).classList.add('active');
    document.querySelectorAll('#m-steps .ms').forEach((el, i) => el.classList.toggle('active', i === step));
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 4) buildReview();
  }
  window.goTo = goTo;

  // ── DIRECTORS ──
  function addDirector() {
    dirCount++;
    const idx = dirCount;
    const container = document.getElementById('directors-container');
    const block = document.createElement('div');
    block.className = 'director-block';
    block.id = 'dir-block-' + idx;
    block.innerHTML =
      '<div class="director-block-title">Director ' + (directors.length + 1) + ' (संचालक ' + toNep(directors.length + 1) + ')</div>' +
      '<button class="remove-btn" onclick="removeDirector(' + idx + ')">✕</button>' +
      '<div class="field-grid">' +
        '<div class="field-group"><label>Director Name <span class="required">*</span><span class="hint">Full name in Nepali</span></label>' +
        '<input type="text" class="np" id="dirName-' + idx + '" placeholder="श्री श्याम शर्मा" /></div>' +
        '<div class="field-group"><label>Director Address <span class="required">*</span></label>' +
        '<input type="text" class="np" id="dirAddr-' + idx + '" placeholder="का.जि.का.म.न.पा. वडा नं.९" /></div>' +
      '</div>';
    container.appendChild(block);
    directors.push(idx);
  }
  window.addDirector = addDirector;

  function removeDirector(idx) {
    const el = document.getElementById('dir-block-' + idx);
    if (el) el.remove();
    directors = directors.filter(d => d !== idx);
    renumberDirectors();
  }
  window.removeDirector = removeDirector;

  function renumberDirectors() {
    directors.forEach((idx, i) => {
      const block = document.getElementById('dir-block-' + idx);
      if (block) block.querySelector('.director-block-title').textContent = 'Director ' + (i + 1) + ' (संचालक ' + toNep(i + 1) + ')';
    });
  }

  function getDirectors() {
    return directors.map(idx => ({
      name: (document.getElementById('dirName-' + idx)?.value || '').trim(),
      addr: (document.getElementById('dirAddr-' + idx)?.value || '').trim()
    })).filter(d => d.name);
  }

  // ── AUDITOR TOGGLE ──
  function toggleAuditor() {
    auditorChangeEnabled = !auditorChangeEnabled;
    document.getElementById('auditorToggle').classList.toggle('on', auditorChangeEnabled);
    document.getElementById('auditorDatesSection').classList.toggle('visible', auditorChangeEnabled);
    document.getElementById('prevAuditorCard').style.display = auditorChangeEnabled ? 'block' : 'none';
  }
  window.toggleAuditor = toggleAuditor;

  // ── NEPALI DATE MATH ──
  const BS_MONTHS = {
    2079:[31,32,31,32,31,30,30,30,29,30,29,30],
    2080:[31,32,31,32,31,30,30,30,29,30,29,30],
    2081:[31,31,32,31,31,31,30,29,30,29,30,30],
    2082:[31,31,32,32,31,30,30,29,30,29,30,30],
    2083:[31,32,31,32,31,30,30,30,29,30,29,30],
    2084:[31,31,32,31,31,30,30,30,29,30,29,31],
    2085:[30,32,31,32,31,30,30,30,29,30,29,31],
    2086:[31,31,32,31,31,31,30,29,30,29,30,30],
    2087:[31,31,32,32,31,30,29,30,30,29,30,30],
  };
  function parseNepDate(str) {
    if (!str) return null;
    const s = str.replace(/[०-९]/g, d => '0123456789'['०१२३४५६७८९'.indexOf(d)]);
    const parts = s.split('/');
    if (parts.length < 3) return null;
    return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) };
  }
  function formatNepDate(y, m, d) {
    return toNep(y) + '/' + toNep(String(m).padStart(2,'0')) + '/' + toNep(String(d).padStart(2,'0'));
  }
  function addNepDays(dateStr, days) {
    let dt = parseNepDate(dateStr);
    if (!dt) return '';
    let { y, m, d } = dt;
    d += days;
    while (true) {
      const months = BS_MONTHS[y] || BS_MONTHS[2082];
      const mDays = months[m - 1];
      if (d <= mDays) break;
      d -= mDays; m++;
      if (m > 12) { m = 1; y++; }
    }
    return formatNepDate(y, m, d);
  }
  function autoSGM() {
    const bod = document.getElementById('bodAuditorDate').value;
    if (!bod) { alert('Please enter BOD Auditor Date first'); return; }
    const result = addNepDays(bod, 15);
    document.getElementById('sgmDate').value = result;
    document.getElementById('sgmHint').textContent = '✓ १५ दिन पछि: ' + result;
  }
  window.autoSGM = autoSGM;
  function autoAGM() {
    const bod = document.getElementById('bodDate').value;
    if (!bod) { alert('Please enter BOD Meeting Date first'); return; }
    const result = addNepDays(bod, 21);
    document.getElementById('agmDate').value = result;
    document.getElementById('agmHint').textContent = '✓ २१ दिन पछि: ' + result;
  }
  window.autoAGM = autoAGM;

  function calcCapital() {
    const n = parseInt(document.getElementById('numShares').value) || 0;
    if (n > 0) document.getElementById('authCapital').value = toNepaliAmount(n * 100);
  }
  window.calcCapital = calcCapital;

  // ── COLLECT DATA ──
  function collectData() {
    const val = id => (document.getElementById(id).value || '').trim();
    return {
      companyName: val('companyName'), companyAddress: val('companyAddress'), regNumber: val('regNumber'),
      chairmanName: val('chairmanName'), chairmanAddr: val('chairmanAddr'),
      directors: getDirectors(),
      bodAuditorDate: val('bodAuditorDate'), sgmDate: val('sgmDate'), bodDate: val('bodDate'),
      agmDate: val('agmDate'), appDate: val('appDate'),
      fiscalYear: val('fiscalYear'), nextFiscalYear: val('nextFiscalYear'),
      prevAuditorFirm: val('prevAuditorFirm'), prevAuditorName: val('prevAuditorName'),
      curAuditorFirm: val('curAuditorFirm'), auditorName: val('auditorName'),
      nextAuditorFirm: val('nextAuditorFirm'), nextAuditorName: val('nextAuditorName'),
      numShares: val('numShares'), authCapital: val('authCapital'), issuedCapital: val('issuedCapital'),
      paidUpCapital: val('paidUpCapital'), paidAmt: val('paidAmt'),
      unpaidCapital: val('unpaidCapital') || 'छैन',
      auditorChange: auditorChangeEnabled,
    };
  }

  // ── REVIEW ──
  function buildReview() {
    const d = collectData();
    const allDirs = [{ name: d.chairmanName, addr: d.chairmanAddr, role: 'अध्यक्ष' },
      ...d.directors.map(x => ({ ...x, role: 'संचालक' }))];
    const docs = [
      d.auditorChange ? 'SGM Call for Auditor Change (Sanchaalak Meeting)' : null,
      d.auditorChange ? 'SGM Minute (Bishesh Sadharan Sabha)' : null,
      'Beneficiary Owner Detail',
      'AGM Call Minute (Sanchaalak Samiti)',
      'AGM Minute (Vaarsik Sadharan Sabha)',
      'Application Letter (Section 50)',
      ...allDirs.map(x => 'Section 92 — ' + x.name + ' (' + x.role + ')'),
      'Section 51 (Share, Debenture & Loan Register)',
    ].filter(Boolean);

    document.getElementById('reviewContent').innerHTML =
      '<div class="review-grid">' +
        item('Company', d.companyName) + item('Registration', d.regNumber) +
        item('BOD Date', d.bodDate) + item('AGM Date', d.agmDate) +
        item('Fiscal Year', d.fiscalYear) + item('Total BOD Members', allDirs.length) +
      '</div>' +
      '<div class="doc-checklist"><div class="dc-head">Documents to be generated</div>' +
        docs.map(x => '<div class="doc-check-item"><span class="ck">✓</span> ' + escapeHtml(x) + '</div>').join('') +
      '</div>';
    document.getElementById('generateSubText').textContent = docs.length + ' documents will be generated into one Word file.';
  }
  function item(label, value) {
    return '<div class="review-item"><div class="review-item-label">' + label + '</div><div class="review-item-value">' + escapeHtml(String(value || '—')) + '</div></div>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // ── GENERATE (client-side) ──
  async function generateDocs() {
    const data = collectData();
    if (!data.companyName || !data.regNumber || !data.chairmanName) {
      showError('Please fill in the required fields: Company Name, Registration Number and Chairman Name.');
      return;
    }
    hideError();
    const btns = document.getElementById('generateBtns');
    btns.style.opacity = '0.4'; btns.style.pointerEvents = 'none';
    document.getElementById('progressWrap').classList.add('visible');
    document.getElementById('resultDownloads').classList.remove('visible');
    document.getElementById('resultDownloads').innerHTML = '';

    const steps = [
      'Preparing company data…', 'Building document structure…',
      'Writing AGM Call Minute…', 'Writing AGM Minute…', 'Writing Beneficiary Owner…',
      'Writing Section 92 declarations…', 'Writing Section 51 register…',
      data.auditorChange ? 'Writing SGM documents…' : null,
      'Writing Application Letter…', 'Finalizing document…',
    ].filter(Boolean);
    for (let i = 0; i < steps.length; i++) { setProgress(Math.round((i / steps.length) * 80), steps[i]); await sleep(160); }

    try {
      const children = buildAllDocs(data);
      const doc = new Document({
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
          children
        }]
      });
      setProgress(92, 'Packaging .docx…');
      const blob = await Packer.toBlob(doc);
      const safeName = (data.companyName || 'Company').replace(/[^a-zA-Z0-9ऀ-ॿ]/g, '_').slice(0, 40);
      lastBlob = blob;
      lastFilename = safeName + '_OCR_documents.docx';
      setProgress(100, 'Document ready!');
      downloadBlob(blob, lastFilename);
      showResult(data.companyName);
    } catch (err) {
      console.error(err);
      showError('Could not generate the document: ' + (err && err.message ? err.message : err));
    } finally {
      btns.style.opacity = '1'; btns.style.pointerEvents = 'auto';
    }
  }
  window.generateDocs = generateDocs;

  function showResult(companyName) {
    const c = document.getElementById('resultDownloads');
    c.classList.add('visible');
    c.innerHTML =
      '<a class="download-btn" id="reDownload" href="#" onclick="reDownload(event)">' +
        '<span class="dl-icon">📝</span>' +
        '<div><div class="dl-main">Download Word Document</div>' +
        '<div class="dl-sub">' + escapeHtml(companyName || 'Company') + ' — सम्पूर्ण कागजात.docx</div></div>' +
      '</a>';
  }
  function reDownload(e) { e.preventDefault(); if (lastBlob) downloadBlob(lastBlob, lastFilename); }
  window.reDownload = reDownload;

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function setProgress(pct, label) {
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = label;
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function showError(msg) { const e = document.getElementById('errMsg'); e.textContent = msg; e.classList.add('visible'); }
  function hideError() { document.getElementById('errMsg').classList.remove('visible'); }
})();
