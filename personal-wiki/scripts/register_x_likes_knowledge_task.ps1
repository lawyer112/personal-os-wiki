param(
  [int]$EveryMinutes = 60,
  [string]$TaskName = "PersonalWiki X Likes Knowledge Pipeline",
  [string]$CollectorRoot = "C:\Users\admin\Documents\Codex\2026-04-28\x",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ObsidianInbox = "/Users/xingqiwu/.hermes/profiles/obsidianmanager1/icarus-fabric/Inbox/",
  [string]$WikiUrl = "http://192.168.6.28:3422"
)

$python = "python"
$collector = Join-Path $CollectorRoot "x_likes_collector.py"
$pipeline = Join-Path $RepoRoot "personal-wiki\scripts\x_likes_knowledge_pipeline.py"
$exportJsonl = Join-Path $CollectorRoot "exports\x_liked_posts_latest.jsonl"

if (-not (Test-Path $pipeline)) {
  throw "Pipeline script not found: $pipeline"
}

$collectorPart = ""
if (Test-Path $collector) {
  $collectorPart = "cd /d `"$CollectorRoot`" && $python `"$collector`" --limit 200 --export && "
}

$command = $collectorPart + "cd /d `"$RepoRoot`" && $python `"$pipeline`" --input `"$exportJsonl`" --obsidian-inbox `"$ObsidianInbox`" --wiki-url `"$WikiUrl`""

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $command"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "registered: $TaskName every $EveryMinutes minutes"
