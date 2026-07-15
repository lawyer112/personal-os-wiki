[CmdletBinding()]
param(
  [string]$Version,
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepoRoot

if (-not $Version) {
  $VersionPath = Join-Path $RepoRoot "VERSION"
  if (-not (Test-Path -LiteralPath $VersionPath)) {
    throw "VERSION file is missing. Pass -Version or create VERSION."
  }
  $Version = (Get-Content -LiteralPath $VersionPath -Raw).Trim()
}

if ($Version -notmatch '^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$') {
  throw "Version '$Version' is not semver-like. Expected 0.1.0 or 0.1.0-rc.1."
}

$PackageName = "personal-os-wiki-v$Version"
$OutputRoot = Join-Path $RepoRoot $OutputDir
$Stage = Join-Path $OutputRoot $PackageName

$RepoFull = [System.IO.Path]::GetFullPath($RepoRoot)
$OutputFull = [System.IO.Path]::GetFullPath($OutputRoot)
$StageFull = [System.IO.Path]::GetFullPath($Stage)

if (-not $OutputFull.StartsWith($RepoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must stay inside the repository."
}

if (-not $StageFull.StartsWith($OutputFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Stage directory must stay inside the output directory."
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

if (Test-Path -LiteralPath $Stage) {
  Remove-Item -LiteralPath $Stage -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$BlockedDirectoryNames = @(
  ".git",
  ".next",
  "coverage",
  "data",
  "dist",
  "logs",
  "node_modules",
  "raw",
  "run",
  "state",
  "private",
  "personal",
  "vault",
  "vaults",
  "wiki-vault",
  "obsidian-vault",
  "exports",
  "backups",
  ".local",
  ".local-ui",
  "ui-private",
  "private-assets",
  "uploads",
  "attachments",
  "screenshots"
)

function Test-BlockedPackagePath {
  param(
    [string]$RelativePath,
    [string]$Name,
    [bool]$IsDirectory
  )

  $Parts = $RelativePath -split '[\\/]'
  foreach ($Part in $Parts) {
    if ($BlockedDirectoryNames -contains $Part) {
      return $true
    }
  }

  if (-not $IsDirectory) {
    return (
      $Name -eq ".env" -or
      $Name -like "*.log" -or
      $Name -like "*.pid" -or
      $Name -like "*.zip" -or
      $Name -like "*.tgz" -or
      $Name -like "*.tar.gz" -or
      $Name -like "*.bak" -or
      $Name -like "*.dump" -or
      $Name -like "*.sqlite" -or
      $Name -like "*.sqlite3" -or
      $Name -like "*.db" -or
      $Name -like "*.db-shm" -or
      $Name -like "*.db-wal" -or
      $Name -like "*.local"
    )
  }

  return $false
}

function Copy-PackageItem {
  param(
    [string]$SourcePath,
    [string]$DestinationRoot,
    [string]$ItemName
  )

  $SourceFull = [System.IO.Path]::GetFullPath($SourcePath)
  $DestinationBase = Join-Path $DestinationRoot $ItemName

  $SourceItem = Get-Item -LiteralPath $SourcePath -Force
  if (-not $SourceItem.PSIsContainer) {
    if (-not (Test-BlockedPackagePath -RelativePath $ItemName -Name $SourceItem.Name -IsDirectory $false)) {
      Copy-Item -LiteralPath $SourcePath -Destination $DestinationRoot -Force
    }
    return
  }

  New-Item -ItemType Directory -Force -Path $DestinationBase | Out-Null

  Get-ChildItem -LiteralPath $SourcePath -Recurse -Force | ForEach-Object {
    $Relative = $_.FullName.Substring($SourceFull.Length).TrimStart("\", "/")
    $PackageRelative = Join-Path $ItemName $Relative

    if (-not (Test-BlockedPackagePath -RelativePath $PackageRelative -Name $_.Name -IsDirectory $_.PSIsContainer)) {
      $Target = Join-Path $DestinationBase $Relative
      if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
      } else {
        $Parent = Split-Path -Parent $Target
        New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $Target -Force
      }
    }
  }
}

$IncludeItems = @(
  ".github",
  "docs",
  "personal-os-app",
  "personal-wiki",
  "scripts",
  ".gitattributes",
  ".gitignore",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "docker-compose.yml",
  "LICENSE",
  "OPEN_SOURCE_RELEASE.md",
  "README.md",
  "README.zh-CN.md",
  "SECURITY.md",
  "VERSION"
)

foreach ($Item in $IncludeItems) {
  $Source = Join-Path $RepoRoot $Item
  if (Test-Path -LiteralPath $Source) {
    Copy-PackageItem -SourcePath $Source -DestinationRoot $Stage -ItemName $Item
  }
}

Get-ChildItem -LiteralPath $Stage -Recurse -Force |
  Where-Object {
    ($_.PSIsContainer -and $BlockedDirectoryNames -contains $_.Name) -or
    (-not $_.PSIsContainer -and ($_.Name -eq ".env" -or $_.Name -like "*.log" -or $_.Name -like "*.pid"))
  } |
  Sort-Object FullName -Descending |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }

$BlockedAfterCopy = Get-ChildItem -LiteralPath $Stage -Recurse -Force |
  Where-Object {
    $Relative = $_.FullName.Substring($StageFull.Length).TrimStart("\", "/")
    $RelativeParts = $Relative -split '[\\/]'
    ($RelativeParts | Where-Object { $BlockedDirectoryNames -contains $_ }) -or
    $_.Name -eq ".env" -or
    $_.Name -like "*.log" -or
    $_.Name -like "*.pid"
  }

if ($BlockedAfterCopy) {
  $Names = ($BlockedAfterCopy | Select-Object -First 20 -ExpandProperty FullName) -join "`n"
  throw "Blocked generated/private files were copied into the package:`n$Names"
}

$ZipPath = Join-Path $OutputRoot "$PackageName.zip"
$TarPath = Join-Path $OutputRoot "$PackageName.tar.gz"
$ShaPath = Join-Path $OutputRoot "SHA256SUMS.txt"

foreach ($Artifact in @($ZipPath, $TarPath, $ShaPath)) {
  if (Test-Path -LiteralPath $Artifact) {
    Remove-Item -LiteralPath $Artifact -Force
  }
}

Compress-Archive -LiteralPath $Stage -DestinationPath $ZipPath -Force

if (Get-Command tar -ErrorAction SilentlyContinue) {
  Push-Location -LiteralPath $OutputRoot
  try {
    tar -czf "$PackageName.tar.gz" "$PackageName"
  } finally {
    Pop-Location
  }
}

$Artifacts = Get-ChildItem -LiteralPath $OutputRoot -File |
  Where-Object { $_.Name -eq "$PackageName.zip" -or $_.Name -eq "$PackageName.tar.gz" }

if (-not $Artifacts) {
  throw "No release archives were created."
}

$HashLines = foreach ($Artifact in $Artifacts | Sort-Object Name) {
  $Hash = Get-FileHash -LiteralPath $Artifact.FullName -Algorithm SHA256
  "$($Hash.Hash.ToLowerInvariant())  $($Artifact.Name)"
}

$HashLines | Set-Content -LiteralPath $ShaPath -Encoding UTF8

Write-Host "Created release package:"
foreach ($Artifact in $Artifacts | Sort-Object Name) {
  Write-Host "  $($Artifact.FullName)"
}
Write-Host "  $ShaPath"
