<?php
/** Gate: require a valid login, then serve the audit letter generator UI
 *  with the shared header injected. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
serve_tool(__DIR__ . '/audit-letters.html', 'audit', $u);
