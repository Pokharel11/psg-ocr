<?php
/** Gate: require a valid DRS login, then serve the OCR generator UI.
 *  Opened directly (the original OCR bookmark), this goes straight to the
 *  OCR tool — not the chooser — with the shared header injected. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
serve_tool(__DIR__ . '/app.html', 'ocr', $u);
