<?php
/** Gate: require login, then serve the staff portal opened to Audit Docs.
 *  Existing bookmark (/audit-letters.php) keeps working, now inside the portal. */
require_once __DIR__ . '/lib/ui.php';
$u = require_login();
render_portal($u, 'audit-docs');
