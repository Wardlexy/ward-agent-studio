# Orbit Lab Real Mode

`?sim` is only a demo. Real mode uses the same office UI, but agents are driven by local events sent to the server.

## Start

```powershell
$env:Path='C:\Users\lexdw\Tools\node-v24.15.0-win-x64;' + $env:Path
npm run server
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:3333
```

Do not use `?sim` for real mode.

## Send A Real Agent Event

Spawn Builder:

```powershell
$id = .\scripts\orbit-agent.ps1 spawn -Role builder-agent -Task "Editing the Orbit Lab UI"
```

The script reads the local event auth token from:

```text
%USERPROFILE%\.agent-office\auth-token
```

Update status:

```powershell
.\scripts\orbit-agent.ps1 work -Id $id -Status "running npm build"
```

Complete:

```powershell
.\scripts\orbit-agent.ps1 done -Id $id -Result "Build passed"
```

One-shot task:

```powershell
.\scripts\orbit-agent.ps1 task -Role qa-agent -Task "Testing the UI" -Status "checking screenshot" -Result "Looks good"
```

Post a chat reply as an agent:

```powershell
.\scripts\orbit-agent.ps1 reply -Role assistant -Text "I am watching the real work now."
```

## Roles

- `idea-agent` = Inventor
- `builder-agent` = Builder
- `designer-agent` = Designer
- `researcher-agent` = Researcher
- `tutor-agent` = Tutor
- `qa-agent` = Tester
- `archivist-agent` = Archivist
- `launcher-agent` = Launcher
- `assistant` = Codex
- `boss` = Ward

## How We Use It

When Codex is doing real work, call `orbit-agent.ps1` before and after the actual work. The office becomes a live dashboard for the task instead of a fake simulation.
