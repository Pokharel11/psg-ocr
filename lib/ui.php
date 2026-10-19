<?php
/** Shared chrome for the staff portal: one page, three compartments (OCR Docs,
 *  Audit Docs, Bank Docs), switched client-side with no change of address. */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/** The staff-portal header: branding, the three compartment tabs, the signed-in
 *  user and Log out. The tabs switch compartments on the page (portal.js); the
 *  active one is chosen client-side, so this markup is the same on every entry. */
function app_header(array $user): string {
    $name = e($user['full_name'] ?? $user['username'] ?? 'Signed in');
    return <<<HTML
<header class="appbar">
  <a href="home.php" class="brand" aria-label="P.S.G. & Associates, Chartered Accountants" style="text-decoration:none;">
    <span class="logo-word">P.S.G.<span class="amp">&amp;</span>Associates</span>
    <span class="logo-sub">Chartered Accountants</span>
  </a>
  <nav class="compartments" data-compartments aria-label="Document compartments">
    <button type="button" class="comp-tab" data-compartment="ocr-docs">OCR Docs</button>
    <button type="button" class="comp-tab" data-compartment="audit-docs">Audit Docs</button>
    <button type="button" class="comp-tab" data-compartment="bank-docs">Bank Docs</button>
  </nav>
  <div class="appbar-right">
    <span class="appbar-user" title="Signed in"><span class="who">{$name}</span></span>
    <a href="logout.php" class="appbar-link muted">Log out</a>
  </div>
</header>
HTML;
}

/** Read a tool markup fragment from partials/. */
function tool_fragment(string $name): string {
    $f = __DIR__ . '/../partials/' . $name;
    $html = is_file($f) ? file_get_contents($f) : '';
    return $html === false ? '' : $html;
}

/** One compartment section: a heading, the tool cards, and each tool's pane. */
function compartment(string $id, string $label, string $title, string $intro, string $cards, string $panes): string {
    return <<<HTML
<section class="compartment" data-compartment="{$id}" hidden>
  <div class="compartment-head">
    <span class="eyebrow">{$label}</span>
    <h1 class="panel-title">{$title}</h1>
    <p class="panel-subtitle" style="font-family:var(--body);">{$intro}</p>
  </div>
  <div class="tool-cards">{$cards}</div>
  {$panes}
</section>
HTML;
}

function tool_card(string $tool, string $icon, string $title, string $desc, bool $available = true): string {
    if (!$available) {
        return <<<HTML
<div class="tool-card is-soon" aria-disabled="true">
  <span class="tc-icon">{$icon}</span>
  <h3>{$title}</h3>
  <p>{$desc}</p>
  <span class="tc-badge">Coming soon</span>
</div>
HTML;
    }
    return <<<HTML
<button type="button" class="tool-card" data-open-tool="{$tool}">
  <span class="tc-icon">{$icon}</span>
  <h3>{$title}</h3>
  <p>{$desc}</p>
  <span class="tc-go">Open <span class="arr">&rarr;</span></span>
</button>
HTML;
}

function tool_pane(string $tool, string $backLabel, string $body): string {
    return <<<HTML
<div class="tool-pane" data-tool="{$tool}" hidden>
  <button type="button" class="back-link" data-back><span class="arr">&larr;</span> {$backLabel}</button>
  <div class="tool-body">{$body}</div>
</div>
HTML;
}

/**
 * Render the whole staff portal. $default is the compartment to open on arrival
 * ('ocr-docs' | 'audit-docs' | 'bank-docs'), or '' to restore the last-used one.
 * Every existing URL serves THIS page; only the default compartment differs.
 */
function render_portal(array $user, string $default = ''): void {
    $assets_v = '20261018';
    $head = app_header($user);

    // OCR Docs
    $ocrCards = tool_card('ocr', '🏢', 'OCR Automation',
        'Office of the Company Registrar filings — AGM/SGM minutes, Section 50/51/92 and Beneficiary Owner detail — as a Word document.');
    $ocrPanes = tool_pane('ocr', 'Back to OCR Docs', tool_fragment('tool-ocr.html'));
    $ocr = compartment('ocr-docs', 'OCR Docs', 'OCR Automation',
        'Company Registrar compliance documents, generated in your browser.', $ocrCards, $ocrPanes);

    // Audit Docs
    $auditCards = tool_card('audit', '✒️', 'Audit Letters',
        'Appointment, statutory audit engagement and management representation letters, matched to the firm&rsquo;s reference format.');
    $auditPanes = tool_pane('audit', 'Back to Audit Docs', tool_fragment('tool-audit.html'));
    $audit = compartment('audit-docs', 'Audit Docs', 'Audit Documents',
        'Audit engagement paperwork, generated in your browser.', $auditCards, $auditPanes);

    // Bank Docs — two tools: Account Opening and Statement Request.
    $bankCards = tool_card('bank-account', '🏦', 'Account Opening',
        'Minutes and the bank application letter for opening a company / entity bank account.')
      . tool_card('bank-statement', '📄', 'Statement Request',
        'Letter and minutes requesting bank account statements for a period.');
    $bankPanes = tool_pane('bank-account', 'Back to Bank Docs', tool_fragment('tool-bank.html'))
      . tool_pane('bank-statement', 'Back to Bank Docs', tool_fragment('tool-bank-statement.html'));
    $bank = compartment('bank-docs', 'Bank Docs', 'Bank Documents',
        'Bank account paperwork, generated in your browser.', $bankCards, $bankPanes);

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Staff Tools · P.S.G. &amp; Associates</title>
<meta name="description" content="P.S.G. & Associates internal staff document tools.">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,500..700&family=Hanken+Grotesk:wght@300..600&family=Spline+Sans+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/app.css?v={$assets_v}">
</head>
<body data-default-compartment="{$default}">

{$head}

<div class="portal">
{$ocr}
{$audit}
{$bank}
</div>

<script src="assets/js/portal.js?v={$assets_v}"></script>
</body>
</html>
HTML;
}
