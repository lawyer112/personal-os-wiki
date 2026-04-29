[CmdletBinding()]
param(
  [string]$Repository = "lawyer112/personal-os-wiki",
  [string]$OutputDir = "metrics/github-traffic"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepoRoot

$Date = Get-Date -Format "yyyy-MM-dd"
$Target = Join-Path $RepoRoot (Join-Path $OutputDir $Date)
New-Item -ItemType Directory -Force -Path $Target | Out-Null

$Endpoints = @{
  "views.json" = "repos/$Repository/traffic/views"
  "clones.json" = "repos/$Repository/traffic/clones"
  "popular-paths.json" = "repos/$Repository/traffic/popular/paths"
  "popular-referrers.json" = "repos/$Repository/traffic/popular/referrers"
}

foreach ($Name in $Endpoints.Keys) {
  $Path = Join-Path $Target $Name
  gh api $Endpoints[$Name] | Set-Content -LiteralPath $Path -Encoding UTF8
}

Write-Host "Saved GitHub Traffic snapshot to $Target"
