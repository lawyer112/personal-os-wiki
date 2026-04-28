$ErrorActionPreference = "Stop"

$AgentEnvPath = $env:PERSONAL_OS_AGENT_ENV
if (-not $AgentEnvPath) {
  $AgentEnvPath = Join-Path $HOME ".config/personal-os/agent.env"
}

if (Test-Path $AgentEnvPath) {
  Get-Content -LiteralPath $AgentEnvPath | ForEach-Object {
    $Line = $_.Trim()
    if (-not $Line -or $Line.StartsWith("#") -or -not $Line.Contains("=")) { return }
    $Line = $Line -replace "^export\s+", ""
    $Parts = $Line.Split("=", 2)
    $Name = $Parts[0].Trim()
    $Value = $Parts[1].Trim().Trim("'").Trim('"')
    if (-not [Environment]::GetEnvironmentVariable($Name, "Process")) {
      [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    }
  }
}

$BaseUrl = $env:PERSONAL_OS_BASE_URL
if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }

if (-not $env:PERSONAL_OS_API_TOKEN -or $env:PERSONAL_OS_API_TOKEN -eq "change-me") {
  throw "Set PERSONAL_OS_API_TOKEN to a real test token before running smoke."
}

$Headers = @{
  Authorization = "Bearer $env:PERSONAL_OS_API_TOKEN"
}

function Invoke-PersonalOsJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body
  )

  $Json = $null
  if ($null -ne $Body) {
    $Json = $Body | ConvertTo-Json -Depth 30
  }

  Invoke-RestMethod `
    -Method $Method `
    -Uri "$BaseUrl$Path" `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $Json
}

$Health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/today"
if (-not $Health.ok) {
  throw "Today API did not return ok=true."
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$Result = Invoke-PersonalOsJson -Method "Post" -Path "/api/intake" -Body @{
  source = @{
    sourceType = "telegram"
    sourcePlatform = "telegram"
    sourceMessageId = "smoke-$Stamp"
    rawText = "Smoke: turn this Personal OS bot integration input into one task, one idea, and one linked knowledge note."
    attachments = @()
    createdBy = "user"
  }
  agent = @{
    model = "example-agent-model"
    classification = @{ kind = "mixed"; confidence = 0.95 }
    reasoningSummary = "Smoke test input should create one review task, one captured idea, and one linked Wiki note."
  }
  project = @{
    name = "Smoke Personal OS $Stamp"
    goal = "Verify the single intake flow."
    priority = "P1"
    currentFocus = "API smoke flow"
  }
  wikiNotes = @(
    @{
      title = "Smoke: Hermes input loop $Stamp"
      content = "# Smoke: Hermes input loop`n`nThis note verifies Inbox -> AgentRun -> Wiki -> Task -> Notification."
      source_type = "manual"
      tags = @("smoke", "hermes", "personal-os")
      metadata = @{ smoke = $true }
    }
  )
  tasks = @(
    @{
      title = "Smoke: verify Hermes to Personal OS loop $Stamp"
      status = "review"
      priority = "P1"
      nextAction = "Open the created task and confirm it has a linked Wiki note."
      definitionOfDone = "Inbox, AgentRun, Wiki note, Task, and Notification are all returned by /api/intake."
    }
  )
  ideas = @(
    @{
      title = "Smoke: keep an idea buffer $Stamp"
      body = "This verifies that Hermes can capture a thought without forcing it into today's tasks."
      status = "captured"
      priority = "P2"
      tags = @("smoke", "idea")
      nextAction = "Open the idea pool and process the captured idea."
    }
  )
  notification = @{
    recipient = "smoke-user"
  }
}

if (-not $Result.ok) { throw "Intake response did not return ok=true." }
if (-not $Result.inbox.id) { throw "Missing inbox id." }
if (-not $Result.agentRunId) { throw "Missing agent run id." }
if ($Result.tasks.Count -lt 1) { throw "No task created." }
if ($Result.ideas.Count -lt 1) { throw "No idea created." }
if ($Result.wiki.Count -lt 1) { throw "No wiki result returned." }
if (-not $Result.notification.payload.text) { throw "Missing notification payload." }

[PSCustomObject]@{
  status = "PASS"
  inbox_id = $Result.inbox.id
  agent_run_id = $Result.agentRunId
  task_id = $Result.tasks[0].id
  idea_id = $Result.ideas[0].id
  wiki_status = $Result.wiki[0].status
  notification_text = $Result.notification.payload.text
  buttons = $Result.notification.payload.buttons
} | ConvertTo-Json -Depth 20
