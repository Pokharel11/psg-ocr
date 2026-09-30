<?php
require_once __DIR__ . '/lib/auth.php';
if (current_user()) redirect('index.php');

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $username = trim($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $_SESSION['login_fail'] = (int)($_SESSION['login_fail'] ?? 0);
    if ($_SESSION['login_fail'] >= 5) usleep(700000);

    if ($username === '' || $password === '') {
        $error = 'Enter your username and password.';
    } else {
        $st = db()->prepare('SELECT * FROM users WHERE username = ? AND active = 1');
        $st->execute([$username]);
        $u = $st->fetch();
        if ($u && password_verify($password, $u['password_hash'])) {
            $_SESSION['login_fail'] = 0;
            login_user($u);
            redirect('index.php');
        } else {
            $_SESSION['login_fail']++;
            $error = 'Incorrect username or password.';
        }
    }
}
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Sign in · OCR Document Generator</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&family=Hanken+Grotesk:wght@300..600&family=Spline+Sans+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{ --ink:#14122a; --indigo:#2f2a76; --indigo-2:#3b3690; --slate:#565b6e; --brass:#b89455; --brass-deep:#97742f;
    --gold:#d8b877; --paper:#fff; --paper-2:#f5f6f9; --line:rgba(24,28,56,.12);
    --display:"Plus Jakarta Sans",system-ui,sans-serif; --body:"Hanken Grotesk",system-ui,sans-serif; --mono:"Spline Sans Mono",monospace; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:var(--body); background:var(--paper-2); color:var(--ink); min-height:100vh; display:grid; place-items:center; padding:24px; }
  .card{ background:var(--paper); border:1px solid var(--line); border-radius:18px; box-shadow:0 8px 20px rgba(20,24,55,.07),0 22px 48px rgba(20,24,55,.10); padding:34px 30px; width:100%; max-width:390px; }
  .brand{ display:flex; flex-direction:column; gap:.3em; margin-bottom:20px; }
  .logo-word{ font-family:var(--display); font-weight:800; color:var(--indigo); font-size:1.2rem; letter-spacing:-.02em; display:flex; align-items:center; }
  .amp{ display:inline-grid; place-items:center; background:var(--indigo); color:#fff; font-weight:700; padding:.05em .38em .1em; margin:0 .22em; clip-path:polygon(0 0,100% 9%,100% 91%,0 100%); }
  .logo-sub{ font-family:var(--mono); font-size:.55rem; letter-spacing:.3em; text-transform:uppercase; color:var(--brass-deep); }
  .eyebrow{ font-family:var(--mono); font-size:.66rem; letter-spacing:.22em; text-transform:uppercase; color:var(--brass-deep); }
  h1{ font-family:var(--display); font-size:1.5rem; font-weight:700; letter-spacing:-.02em; margin:.5rem 0 .2rem; }
  .sub{ color:var(--slate); font-size:.88rem; margin-bottom:22px; }
  label{ font-family:var(--mono); font-size:.66rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink); display:block; margin-bottom:6px; }
  input{ width:100%; border:1.5px solid var(--line); border-radius:8px; padding:11px 13px; font-size:.95rem; font-family:var(--body); outline:none; margin-bottom:16px; transition:border-color .18s,box-shadow .18s; }
  input:focus{ border-color:var(--indigo); box-shadow:0 0 0 3px rgba(47,42,118,.12); }
  button{ width:100%; background:var(--indigo); color:#eef0f6; border:none; border-radius:8px; padding:13px; font-family:var(--mono); font-size:.78rem; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; transition:background .2s; }
  button:hover{ background:var(--indigo-2); }
  .err{ background:#fbecec; border:1px solid #f0cccc; color:#b23b3b; padding:10px 14px; border-radius:9px; font-size:.85rem; margin-bottom:16px; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="logo-word">P.S.G.<span class="amp">&amp;</span>Associates</span><span class="logo-sub">Chartered Accountants</span></div>
    <span class="eyebrow">Staff Access</span>
    <h1>Sign in</h1>
    <p class="sub">OCR Document Generator — use your Daily Reporting login.</p>
    <?php if ($error): ?><div class="err"><?= e($error) ?></div><?php endif; ?>
    <form method="post" autocomplete="off">
      <?= csrf_field() ?>
      <label>Username</label>
      <input type="text" name="username" autofocus required>
      <label>Password</label>
      <input type="password" name="password" required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>
