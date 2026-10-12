<?php
/** Gate: require a valid login, then serve the audit letter generator UI. */
require_once __DIR__ . '/lib/auth.php';
require_login();
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/audit-letters.html');
