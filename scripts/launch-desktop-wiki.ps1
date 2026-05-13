$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WikiDir = Join-Path $Root "personal-wiki"
$DataDir = Join-Path $WikiDir "data"
$LogDir = Join-Path $WikiDir "logs"
$RunDir = Join-Path $WikiDir "run"
$PidFile = Join-Path $RunDir "personal-wiki.pid"
$Server = Join-Path $WikiDir "api\server.py"

New-Item -ItemType Directory -Force -Path $DataDir, $LogDir, $RunDir | Out-Null

$env:WIKI_HOST = "127.0.0.1"
$env:WIKI_PORT = "3422"
$env:WIKI_DATA_DIR = $DataDir
$env:WIKI_REQUIRE_API_READ_AUTH = "0"
$env:WIKI_REQUIRE_PAGE_READ_AUTH = "0"
$env:WIKI_ALLOW_UNAUTHENTICATED_WRITE = "0"
$env:WIKI_SITE_TITLE = "Personal Wiki Desktop"

$port = [int]$env:WIKI_PORT
$baseUrl = "http://127.0.0.1:$port"
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $existing) {
    $outLog = Join-Path $LogDir "personal-wiki.out.log"
    $errLog = Join-Path $LogDir "personal-wiki.err.log"
    $proc = Start-Process -FilePath "python" -ArgumentList @($Server) -WorkingDirectory $WikiDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    Set-Content -LiteralPath $PidFile -Value $proc.Id -Encoding ASCII
    Start-Sleep -Seconds 2
}

$health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 5
Write-Host "Personal Wiki is running: $baseUrl"
Write-Host "Health: $($health.status)"
Write-Host "Data: $DataDir"
Start-Process "$baseUrl"
