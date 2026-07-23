param(
  [string]$InstallDir = "$env:ProgramData\FitCRMBridge",
  [switch]$KeepData
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName "FitCRMBridge" -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName "FitCRMBridge" -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName "FitCRMBridge" -Confirm:$false
}

if (-not $KeepData -and (Test-Path $InstallDir)) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
}

Write-Host "FitCRM Bridge task removed."
if ($KeepData) {
  Write-Host "Configuration and queue kept at $InstallDir"
}
