<?php
/** Shared chrome for the staff tools: the one header used by every page. */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/**
 * Render the shared app header.
 *
 * @param string $active  'ocr' | 'audit' | 'home' — which tool is in view.
 * @param array  $user    The row from current_user() (needs full_name).
 */
function app_header(string $active, array $user): string {
    $tags = [
        'ocr'   => 'OCR Document Generator',
        'audit' => 'Audit Letter Generator',
        'home'  => 'Staff Tools',
    ];
    $tag  = $tags[$active] ?? 'Staff Tools';
    $name = e($user['full_name'] ?? $user['username'] ?? 'Signed in');

    // "Switch tool" takes you back to the chooser; hide it when already there.
    $switch = $active === 'home'
        ? ''
        : '<a href="home.php" class="appbar-link">Switch tool</a>';

    return <<<HTML
<header class="appbar">
  <a href="home.php" class="brand" aria-label="P.S.G. & Associates, Chartered Accountants" style="text-decoration:none;">
    <span class="logo-word">P.S.G.<span class="amp">&amp;</span>Associates</span>
    <span class="logo-sub">Chartered Accountants</span>
  </a>
  <div class="appbar-right">
    <span class="app-tag">{$tag}</span>
    <span class="appbar-user" title="Signed in"><span class="who">{$name}</span></span>
    {$switch}
    <a href="logout.php" class="appbar-link muted">Log out</a>
  </div>
</header>
HTML;
}

/**
 * Serve a static HTML shell (app.html / audit-letters.html) with the shared
 * header injected server-side in place of the <!--APPBAR--> marker. Keeps the
 * tool UIs as plain static files while the header stays one source of truth
 * and the signed-in user's name never has to be fetched by client JS.
 */
function serve_tool(string $htmlFile, string $active, array $user): void {
    $html = file_get_contents($htmlFile);
    if ($html === false) {
        http_response_code(500);
        exit('Unable to load the tool.');
    }
    $html = str_replace('<!--APPBAR-->', app_header($active, $user), $html);
    header('Content-Type: text/html; charset=utf-8');
    // Never cache the shell itself, so bumped ?v= asset versions always take effect.
    header('Cache-Control: no-cache, must-revalidate');
    echo $html;
}
