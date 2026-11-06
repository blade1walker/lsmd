# Update Nexus EMS Bot on Oracle Cloud VM
# Usage: .\scripts\update-bot.ps1

Write-Host "Updating Nexus EMS Discord Bot on Oracle Cloud (130.210.47.31)..." -ForegroundColor Cyan

$remoteCmd = @"
sudo -u lsmd git -C /opt/lsmd/repo fetch origin main
sudo -u lsmd git -C /opt/lsmd/repo reset --hard origin/main
sudo -u lsmd FORCE=1 bash /opt/lsmd/repo/deploy/oracle/deploy-bot.sh
sudo systemctl status lsmd-bot --no-pager
"@

$cleanCmd = $remoteCmd -replace "`r", ""
ssh -i ~/.ssh/lsmd_oracle -o StrictHostKeyChecking=accept-new ubuntu@130.210.47.31 $cleanCmd
