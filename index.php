<?php
/** Gate: require a valid DRS login, then serve the staff portal opened to OCR Docs.
 *  This is the original OCR bookmark (/), so it goes straight to the OCR compartment. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
render_portal($u, 'ocr-docs');
