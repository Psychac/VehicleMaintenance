# Registers a daily Windows scheduled task that runs `npm run backup`.
# Run once from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
# Remove later with:                 Unregister-ScheduledTask -TaskName "VehicleLogBackup" -Confirm:$false

param(
    [string]$Time = "21:00"
)

$projectDir = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$log = Join-Path $projectDir "backups\backup.log"

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"`"$npm`" run backup >> `"$log`" 2>&1`"" `
    -WorkingDirectory $projectDir
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
# StartWhenAvailable: if the PC was off at the scheduled time, run at next startup.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

New-Item -ItemType Directory -Force (Join-Path $projectDir "backups") | Out-Null
Register-ScheduledTask -TaskName "VehicleLogBackup" -Action $action -Trigger $trigger -Settings $settings `
    -Description "Daily local backup of Vehicle Log data from Supabase" -Force | Out-Null

Write-Host "Scheduled daily backup at $Time. Log: $log"
Write-Host "Test it now with: Start-ScheduledTask -TaskName VehicleLogBackup"
