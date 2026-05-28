param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet('spawn','work','done','reply','typing','task')]
  [string]$Command,

  [string]$Id,
  [string]$Role = 'builder-agent',
  [string]$Name,
  [string]$Task,
  [string]$Status,
  [string]$Result = 'done',
  [string]$Text,
  [string]$Server = 'http://127.0.0.1:3334',
  [int]$DelayMs = 900
)

$ErrorActionPreference = 'Stop'

$roleNames = @{
  'idea-agent'       = 'Inventor'
  'builder-agent'    = 'Builder'
  'designer-agent'   = 'Designer'
  'researcher-agent' = 'Researcher'
  'tutor-agent'      = 'Tutor'
  'qa-agent'         = 'Tester'
  'archivist-agent'  = 'Archivist'
  'launcher-agent'   = 'Launcher'
  'assistant'        = 'Codex'
  'boss'             = 'Ward'
}

function Get-AgentName {
  param([string]$Role, [string]$Name)
  if ($Name) { return $Name }
  if ($roleNames.ContainsKey($Role)) { return $roleNames[$Role] }
  return 'Agent'
}

function New-AgentId {
  param([string]$Role)
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return "orbit-$Role-$stamp"
}

function Send-Json {
  param([string]$Path, [hashtable]$Body)
  $json = $Body | ConvertTo-Json -Depth 8 -Compress
  $headers = @{}
  if ($Path -eq '/event') {
    $tokenPath = Join-Path $HOME '.agent-office\auth-token'
    if (Test-Path -LiteralPath $tokenPath) {
      $token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
      if ($token) {
        $headers['Authorization'] = "Bearer $token"
      }
    }
  }
  Invoke-RestMethod -Method Post -Uri "$Server$Path" -ContentType 'application/json' -Headers $headers -Body $json | Out-Null
}

function Send-Event {
  param([hashtable]$Body)
  Send-Json -Path '/event' -Body $Body
}

function Send-Reply {
  param([string]$Sender, [string]$Role, [string]$Text)
  Send-Json -Path '/chat/reply' -Body @{
    sender = $Sender
    role = $Role
    text = $Text
  }
}

try {
  Invoke-RestMethod -Uri "$Server/health" -Method Get -TimeoutSec 2 | Out-Null
} catch {
  throw "Orbit Lab server is not reachable at $Server. Start it with: npm run server"
}

$agentName = Get-AgentName -Role $Role -Name $Name
if (-not $Id) { $Id = New-AgentId -Role $Role }

switch ($Command) {
  'spawn' {
    if (-not $Task) { $Task = 'Working on a real task' }
    Send-Event @{
      type = 'agent_spawned'
      agent = @{
        id = $Id
        name = $agentName
        role = $Role
        task = $Task
      }
    }
    Write-Output $Id
  }

  'work' {
    if (-not $Status) { $Status = 'working' }
    Send-Event @{
      type = 'agent_working'
      agentId = $Id
      status = $Status
    }
    Write-Output $Id
  }

  'done' {
    Send-Event @{
      type = 'agent_completed'
      agentId = $Id
      result = $Result
    }
    Write-Output $Id
  }

  'reply' {
    if (-not $Text) { throw '-Text is required for reply' }
    Send-Reply -Sender $agentName -Role $Role -Text $Text
    Write-Output 'ok'
  }

  'typing' {
    Send-Json -Path '/chat/typing' -Body @{ sender = $agentName }
    Write-Output 'ok'
  }

  'task' {
    if (-not $Task) { $Task = 'Working on a real task' }
    Send-Event @{
      type = 'agent_spawned'
      agent = @{
        id = $Id
        name = $agentName
        role = $Role
        task = $Task
      }
    }
    Start-Sleep -Milliseconds $DelayMs
    if ($Status) {
      Send-Event @{
        type = 'agent_working'
        agentId = $Id
        status = $Status
      }
      Start-Sleep -Milliseconds $DelayMs
    }
    Send-Event @{
      type = 'agent_completed'
      agentId = $Id
      result = $Result
    }
    Write-Output $Id
  }
}
