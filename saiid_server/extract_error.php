<?php
$logFilePath = __DIR__ . '/storage/logs/laravel.log';
$contents = file_get_contents($logFilePath);
preg_match_all('/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] local\.ERROR: (.*?)(?=\n\[\d{4}-\d{2}-\d{2}|\z)/s', $contents, $matches);
$errors = [];
foreach ($matches[1] as $err) {
    if (strpos($err, 'Psy\Exception') === false && strpos($err, 'Psy\CodeCleaner') === false && strpos($err, 'Syntax error') === false) {
        $errors[] = $err;
    }
}
$lastErrors = array_slice($errors, -3);
foreach ($lastErrors as $i => $e) {
    echo "--- ERROR $i ---\n$e\n";
}
