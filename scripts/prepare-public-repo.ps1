param(
  [string]$OutputPath = "../personal-os-wiki-public-clean",
  [string]$InitialCommitMessage = "Initial public release"
)

$ErrorActionPreference = "Stop"

function Resolve-AbsolutePath([string]$Path) {
  $parent = Split-Path -Parent $Path
  if ([string]::IsNullOrWhiteSpace($parent)) {
    $parent = "."
  }
  $leaf = Split-Path -Leaf $Path
  $resolvedParent = (Resolve-Path -LiteralPath $parent).Path
  Join-Path $resolvedParent $leaf
}

function Invoke-CheckedNative([scriptblock]$Command, [string]$Description) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "This script must run inside the release package Git repository."
}

Push-Location $repoRoot
try {
  $status = git status --short
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    throw "Refusing to create a public export from a dirty worktree. Commit or revert changes first."
  }

  $output = Resolve-AbsolutePath $OutputPath
  if (Test-Path -LiteralPath $output) {
    throw "Output path already exists: $output"
  }

  $tempArchive = Join-Path ([System.IO.Path]::GetTempPath()) ("personal-os-wiki-public-" + [guid]::NewGuid() + ".zip")
  Invoke-CheckedNative { git archive --format=zip --output=$tempArchive HEAD } "git archive"
  New-Item -ItemType Directory -Path $output | Out-Null
  Expand-Archive -LiteralPath $tempArchive -DestinationPath $output
  Remove-Item -LiteralPath $tempArchive -Force

  $sourceGitName = git config user.name
  $sourceGitEmail = git config user.email

  Push-Location $output
  try {
    $secretPattern = "(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{35}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY|postgresql://[^\s<>]*:[^\s<>]*@(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.)[^\s<>]*)"
    rg -n --hidden -g "!node_modules" -g "!.git" -g "!.next" -g "!package-lock.json" $secretPattern .
    if ($LASTEXITCODE -eq 0) {
      throw "Secret/private-data scan found blocking matches in the clean export."
    }
    if ($LASTEXITCODE -gt 1) {
      throw "Secret/private-data scan failed with exit code $LASTEXITCODE."
    }

    Invoke-CheckedNative { git init } "git init"
    if (-not [string]::IsNullOrWhiteSpace($sourceGitName)) {
      Invoke-CheckedNative { git config user.name $sourceGitName } "git config user.name"
    }
    if (-not [string]::IsNullOrWhiteSpace($sourceGitEmail)) {
      Invoke-CheckedNative { git config user.email $sourceGitEmail } "git config user.email"
    }
    Invoke-CheckedNative { git add . } "git add"
    Invoke-CheckedNative { git commit -m $InitialCommitMessage } "git commit"
  }
  finally {
    Pop-Location
  }

  Write-Host "Created clean public repository at: $output"
  Write-Host "Next: add a new public GitHub remote there and push its single initial commit."
}
finally {
  Pop-Location
}
