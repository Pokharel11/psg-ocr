<?php
/** Tool chooser shown after login: pick OCR Automation or the Audit Letter
 *  Generator. Behind the same staff login as every other page. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
$first = trim((string)($u['full_name'] ?? ''));
$first = $first !== '' ? preg_split('/\s+/', $first)[0] : 'there';
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Staff Tools · P.S.G. &amp; Associates</title>
<meta name="description" content="P.S.G. & Associates internal staff tools.">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,500..700&family=Hanken+Grotesk:wght@300..600&family=Spline+Sans+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/app.css?v=2">
</head>
<body>

<?= app_header('home', $u) ?>

<main class="chooser">
  <span class="eyebrow">Staff Tools</span>
  <h1 class="panel-title">Welcome, <?= e($first) ?></h1>
  <p class="panel-subtitle" style="font-family:var(--body);">Choose a tool to get started. Both run entirely in your browser — nothing is uploaded to a server.</p>

  <div class="chooser-grid">
    <a class="tool-card" href="index.php">
      <span class="tc-icon">🏢</span>
      <h3>OCR Automation</h3>
      <p>Generate Office of the Company Registrar filings — AGM/SGM minutes, Section 50/51/92 and Beneficiary Owner detail — as a Word document.</p>
      <span class="tc-go">Open OCR <span class="arr">→</span></span>
    </a>

    <a class="tool-card" href="audit-letters.php">
      <span class="tc-icon">✒️</span>
      <h3>Audit Letter Generator</h3>
      <p>Produce the appointment, statutory audit engagement and management representation letters for a client, matched to the firm's reference format.</p>
      <span class="tc-go">Open Audit Letters <span class="arr">→</span></span>
    </a>
  </div>
</main>

</body>
</html>
