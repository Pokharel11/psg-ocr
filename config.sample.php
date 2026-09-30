<?php
/**
 * OCR sign-in config. Copy this to `config.php` ON THE SERVER and use the SAME
 * database credentials as the DRS app (it reads the shared `users` table to
 * verify logins). `config.php` is git-ignored and excluded from deploys.
 */
return [
    'db_host' => 'localhost',
    'db_name' => 'psgassoc_drs',      // same database as DRS
    'db_user' => 'psgassoc_drsuser',  // same DB user as DRS
    'db_pass' => 'CHANGE_ME',         // same password as DRS
    'timezone' => 'Asia/Kathmandu',
];
