$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WikiDir = Join-Path $Root "personal-wiki"
$EnvFile = Join-Path $WikiDir ".env.local"
$RunDir = Join-Path $WikiDir "run"
$PidFile = Join-Path $RunDir "personal-wiki.pid"

$port = "3422"
if (Test-Path -LiteralPath $EnvFile) {
    Get-Content -LiteralPath $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^WIKI_PORT=(.+)$') {
            $port = $Matches[1].Trim().Trim('"')
        }
    }
}

$baseUrl = "http://127.0.0.1:${port}"

if (Test-Path -LiteralPath $PidFile) {
    $pidValue = (Get-Content -LiteralPath $PidFile -TotalCount 1).Trim()
    $proc = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Process: running pid=$pidValue"
    } else {
        Write-Host "Process: pid file exists, process is not running"
    }
} else {
    Write-Host "Process: no pid file"
}

try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 5
    Write-Host "Health:  $($health.status)"
    Write-Host "Home:    $baseUrl/auth/read"
} catch {
    Write-Host "Health:  unavailable"
    Write-Host "Error:   $($_.Exception.Message)"
}
