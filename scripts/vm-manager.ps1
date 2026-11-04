param(
    [string]$Target = "",
    [string]$Action = ""
)

$sshKey = "$HOME\.ssh\lsmd_oracle"
$vmHost = "ubuntu@130.210.47.31"

function Invoke-Remote {
    param([string]$Cmd)
    ssh -i $sshKey -o StrictHostKeyChecking=no -o ConnectTimeout=5 $vmHost $Cmd
}

if ($Target -ne "") {
    if ($Target -eq "status") {
        Invoke-Remote "manage status"
        exit
    }
    if ($Action -ne "") {
        Invoke-Remote "manage $Target $Action"
        exit
    }
    Invoke-Remote "manage $Target"
    exit
}

function Show-Menu {
    Clear-Host
    Invoke-Remote "manage status"
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "           Oracle VM Service Control Panel            " -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "  WEBSITE (https://lsmd.tech):" -ForegroundColor Blue
    Write-Host "    [1] Restart Website"
    Write-Host "    [2] Start Website"
    Write-Host "    [3] Stop Website"
    Write-Host "    [4] View Website Live Logs (last 50 lines)"
    Write-Host ""
    Write-Host "  BACKUP BOT (Oracle VM Standby):" -ForegroundColor Yellow
    Write-Host "    [5] Start Backup Bot (Activate if CloudLaag is down)"
    Write-Host "    [6] Stop Backup Bot  (Safe standby when CloudLaag is active)"
    Write-Host "    [7] Restart Backup Bot"
    Write-Host "    [8] Pull & Deploy Latest Bot Version from GitHub"
    Write-Host "    [9] View Bot Live Logs (last 50 lines)"
    Write-Host ""
    Write-Host "  [0] Exit"
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option [0-9]"
    switch ($choice) {
        "1" { Invoke-Remote "manage website restart"; pause }
        "2" { Invoke-Remote "manage website start"; pause }
        "3" { Invoke-Remote "manage website stop"; pause }
        "4" { Invoke-Remote "manage website logs 50"; pause }
        "5" { Invoke-Remote "manage bot start"; pause }
        "6" { Invoke-Remote "manage bot stop"; pause }
        "7" { Invoke-Remote "manage bot restart"; pause }
        "8" { Invoke-Remote "manage bot deploy"; pause }
        "9" { Invoke-Remote "manage bot logs 50"; pause }
        "0" { exit }
        default { Write-Host "Invalid option"; Start-Sleep -Seconds 1 }
    }
}
