<?php
/**
 * Login-gated static asset server for the firm's templates and entity data.
 *
 * The files under data/ and templates/ (blank .docx templates + the entity
 * vocabulary) are the firm's own material and must not be world-readable, but
 * the browser tools still need to fetch() them after sign-in. The data/ and
 * templates/ .htaccess route every direct request here; this script enforces
 * the SAME login check as the portal (require_login) and then streams the file.
 * A logged-in browser's fetch() carries the PSGOCR session cookie, so the tools
 * keep working unchanged; an unauthenticated request is redirected to login.
 *
 * Nothing here reads request bodies or client data — it only serves whitelisted
 * static files that ship with the app.
 */
declare(strict_types=1);

require_once __DIR__ . '/lib/auth.php';
require_login(); // 302 -> login.php?next=... when there is no valid session.

// Only these two folders are served this way, and only these extensions.
$allowedDirs = ['data', 'templates'];
$types = [
    'yaml' => 'text/yaml; charset=utf-8',
    'yml'  => 'text/yaml; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

$dir  = (string)($_GET['dir'] ?? '');
$file = (string)($_GET['file'] ?? '');

if (!in_array($dir, $allowedDirs, true)) { http_response_code(404); exit; }

// Reject anything that could escape the folder.
$file = ltrim($file, '/');
if ($file === '' || strpos($file, '..') !== false || strpos($file, "\0") !== false) {
    http_response_code(404); exit;
}

$base = realpath(__DIR__ . '/' . $dir);
$path = realpath(__DIR__ . '/' . $dir . '/' . $file);
if ($base === false || $path === false
    || strncmp($path, $base . DIRECTORY_SEPARATOR, strlen($base) + 1) !== 0
    || !is_file($path)) {
    http_response_code(404); exit;
}

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!isset($types[$ext])) { http_response_code(404); exit; }

header('Content-Type: ' . $types[$ext]);
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, no-cache, max-age=0');
header('X-Content-Type-Options: nosniff');
readfile($path);
