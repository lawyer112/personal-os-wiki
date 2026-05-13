$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RunDir = Join-Path $Root "personal-wiki\run"
$PidFile = Join-Path $RunDir "personal-wiki.pid"

if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "No desktop wiki pid file found."
    exit 0
}

$pidValue = (Get-Content -LiteralPath $PidFile -TotalCount 1).Trim()
if (-not $pidValue) {
    Remove-Item -LiteralPath $PidFile -Force
    Write-Host "Removed empty pid file."
    exit 0
}

$proc = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
if ($proc) {
    Stop-Process -Id $proc.Id -Force
    Write-Host "Stopped Personal Wiki process $($proc.Id)."
} else {
    Write-Host "Personal Wiki process $pidValue was not running."
}

Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
