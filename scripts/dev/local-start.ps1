$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir '..\..')
$logs = Join-Path $root '.local\logs'
$backendJar = Join-Path $root 'backend\target\cloudcad-backend-0.1.0-SNAPSHOT.jar'

New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Test-BackendReady {
    try {
        $health = Invoke-RestMethod -TimeoutSec 3 http://127.0.0.1:8080/actuator/health
        return $health.status -eq 'UP'
    } catch {
        return $false
    }
}

function Test-FrontendReady {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://127.0.0.1:5173/
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Wait-ServiceReady {
    param(
        [string] $Name,
        [scriptblock] $Probe,
        [int] $TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (& $Probe) {
            Write-Host "$Name is ready."
            return $true
        }
        Start-Sleep -Seconds 2
    }

    Write-Warning "$Name did not become ready within $TimeoutSeconds seconds. Check logs if it still fails."
    return $false
}

Write-Host 'Starting PostgreSQL...'
& (Join-Path $scriptDir 'postgres-start.cmd')
& (Join-Path $scriptDir 'postgres-init-db.cmd')

if (-not (Test-Path $backendJar)) {
    Write-Host 'Backend jar not found, building backend first...'
    & (Join-Path $scriptDir 'backend-build.cmd')
}

if (Test-BackendReady) {
    Write-Host 'Backend is already running.'
} else {
    Write-Host 'Starting backend in background...'
    Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'scripts\dev\backend-run-jar.cmd > .local\logs\backend.log 2>&1' `
        -WorkingDirectory $root
}

if (Test-FrontendReady) {
    Write-Host 'Frontend is already running.'
} else {
    Write-Host 'Starting frontend in background...'
    Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'scripts\dev\frontend-dev.cmd > .local\logs\frontend.log 2>&1' `
        -WorkingDirectory $root
}

Wait-ServiceReady -Name 'Backend' -Probe ${function:Test-BackendReady} -TimeoutSeconds 60 | Out-Null
Wait-ServiceReady -Name 'Frontend' -Probe ${function:Test-FrontendReady} -TimeoutSeconds 30 | Out-Null
& (Join-Path $scriptDir 'local-status.cmd')

Write-Host ''
Write-Host 'Logs:'
Write-Host "  Backend:  $logs\backend.log"
Write-Host "  Frontend: $logs\frontend.log"
