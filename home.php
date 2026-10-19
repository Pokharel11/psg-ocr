<?php
/** Gate: require login, then serve the staff portal. No forced compartment, so it
 *  opens to the last-used one (remembered in the browser), else OCR Docs. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
render_portal($u, '');
