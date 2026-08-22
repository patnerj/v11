$sourceBackend = "d:\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system"
$destBackend1 = "c:\Users\Administrator\Downloads\Full Propfirm System for antigravity\backend-email-update v10.7.1\propfirm-system"
$destBackend2 = "C:\Users\Administrator\Local Sites\propfirm\app\public\wp-content\plugins\propfirm-system"

$sourceFrontend = "d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1"
$destFrontend1 = "c:\Users\Administrator\Downloads\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1"

Write-Host "Syncing Backend to Downloads..."
robocopy "$sourceBackend" "$destBackend1" /E /NFL /NDL /NJH /NJS /nc /ns /np

Write-Host "Syncing Backend to Local WP Site..."
if (Test-Path "$destBackend2") {
    robocopy "$sourceBackend" "$destBackend2" /E /NFL /NDL /NJH /NJS /nc /ns /np
}

Write-Host "Syncing Frontend to Downloads..."
robocopy "$sourceFrontend" "$destFrontend1" /E /XD node_modules .next /NFL /NDL /NJH /NJS /nc /ns /np

Write-Host "Syncing mt5-price-service to Downloads..."
$sourceMt5 = "d:\Full Propfirm System for antigravity\mt5-price-service"
$destMt5 = "c:\Users\Administrator\Downloads\Full Propfirm System for antigravity\mt5-price-service"
robocopy "$sourceMt5" "$destMt5" /E /NFL /NDL /NJH /NJS /nc /ns /np

Write-Host "Synchronization Complete!"
