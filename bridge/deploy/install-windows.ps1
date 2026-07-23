param(
  [string]$InstallDir = "$env:ProgramData\FitCRMBridge",
  [string]$ConfigPath = "$PSScriptRoot\..\config.json"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw "Node.js 20+ is required"
}
$nodeCommand = Get-Command node.exe
$nodePath = [IO.Path]::GetFullPath($nodeCommand.Source)
$programFilesRoots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) |
  Where-Object { $_ } |
  ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd('\') + '\' }
if (-not ($programFilesRoots | Where-Object { $nodePath.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })) {
  throw "Node.js must be installed machine-wide under Program Files"
}
$signature = Get-AuthenticodeSignature -FilePath $nodePath
if ($signature.Status -ne "Valid") {
  throw "node.exe must have a valid Authenticode signature"
}
$nodeVersion = [int]((& $nodePath --version).TrimStart("v").Split(".")[0])
if ($nodeVersion -lt 20) { throw "Node.js 20+ is required" }
if (-not (Test-Path $ConfigPath)) { throw "Config not found: $ConfigPath" }

$configText = Get-Content -LiteralPath $ConfigPath -Raw
$configObject = $configText | ConvertFrom-Json
$vendorUsername = $null
$vendorPassword = $null
if ($configText.Contains('${VENDOR_USERNAME}')) {
  $vendorUsername = Read-Host "Vendor API username"
}
if ($configText.Contains('${VENDOR_PASSWORD}')) {
  $securePassword = Read-Host "Vendor API password" -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $vendorPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item "$PSScriptRoot\..\bin" "$InstallDir\bin" -Recurse -Force
Copy-Item "$PSScriptRoot\..\src" "$InstallDir\src" -Recurse -Force
Copy-Item "$PSScriptRoot\..\package.json" "$InstallDir\package.json" -Force
if ($vendorUsername) {
  if ($configObject.provider.username -eq '${VENDOR_USERNAME}') {
    $configObject.provider.username = $vendorUsername
  }
  if ($configObject.provider.auth.body.username -eq '${VENDOR_USERNAME}') {
    $configObject.provider.auth.body.username = $vendorUsername
  }
}
if ($vendorPassword) {
  if ($configObject.provider.password -eq '${VENDOR_PASSWORD}') {
    $configObject.provider.password = $vendorPassword
  }
  if ($configObject.provider.auth.body.password -eq '${VENDOR_PASSWORD}') {
    $configObject.provider.auth.body.password = $vendorPassword
  }
}
$configObject | ConvertTo-Json -Depth 20 | Set-Content "$InstallDir\config.json" -Encoding UTF8
$vendorPassword = $null
New-Item -ItemType Directory -Force -Path "$InstallDir\data" | Out-Null

# The task runs JavaScript as SYSTEM and the queue contains credential UIDs.
# Protect the full tree from both disclosure and executable-code replacement.
& icacls $InstallDir /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" /T | Out-Null

$action = New-ScheduledTaskAction -Execute $nodePath `
  -Argument "`"$InstallDir\bin\fitcrm-bridge.mjs`" start `"$InstallDir\config.json`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 100 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "FitCRMBridge" -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "FitCRMBridge"
Write-Host "FitCRM Bridge installed and started. Health: http://127.0.0.1:8787/health"
