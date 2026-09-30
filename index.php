<?php
/** Gate: require a valid DRS login, then serve the OCR generator UI. */
require_once __DIR__ . '/lib/auth.php';
require_login();
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
