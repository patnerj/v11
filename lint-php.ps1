$php = "C:\Users\Administrator\AppData\Roaming\Local\lightning-services\php-8.2.29+0\bin\win64\php.exe"
$files = Get-ChildItem -Path "d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system" -Filter "*.php" -Recurse

$errors = 0
foreach ($f in $files) {
    $out = & $php -l $f.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SYNTAX ERROR: $($f.FullName)" -ForegroundColor Red
        Write-Host $out
        $errors++
    }
}

if ($errors -eq 0) {
    Write-Host "SUCCESS: All $($files.Count) PHP files passed syntax validation with 0 errors!" -ForegroundColor Green
} else {
    Write-Host "FAILED: $errors files had syntax errors." -ForegroundColor Red
}
