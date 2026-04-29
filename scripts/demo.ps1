[CmdletBinding()]
param(
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepoRoot

$args = @("compose", "up", "-d")
if (-not $NoBuild) {
  $args += "--build"
}

Write-Host "Starting Personal OS + Personal Wiki demo..."
docker @args

Write-Host ""
Write-Host "Demo is starting on localhost."
Write-Host "Personal OS:   http://localhost:3000/auth/read"
Write-Host "  Read token:  demo-read-token"
Write-Host "Personal Wiki: http://localhost:3422/auth/read"
Write-Host "  Read token:  demo-wiki-read-token"
Write-Host ""
Write-Host "Stop demo:"
Write-Host "  docker compose down"
Write-Host ""
Write-Host "Reset demo data:"
Write-Host "  docker compose down -v"
