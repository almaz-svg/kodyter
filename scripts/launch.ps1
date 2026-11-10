# Local development with backend/.env as the configuration source.
[CmdletBinding()]
param(
    [string]$PythonExecutable = '',
    [string]$NodeExecutable = '',
    [string]$PostgresBin = 'C:/Program Files/PostgreSQL/18/bin',
    [ValidateRange(1024, 65535)][int]$BackendPort = 8000,
    [ValidateRange(1024, 65535)][int]$FrontendPort = 5173,
    [switch]$UseSqlite,
    [switch]$SeedDemo
)
. "$PSScriptRoot/common.ps1"
if ($BackendPort -eq $FrontendPort) { throw 'BackendPort and FrontendPort must be different.' }
$projectRoot = $script:ProjectRoot
$hashAlgorithm = [Security.Cryptography.SHA256]::Create()
try { $projectHash = [BitConverter]::ToString($hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '') } finally { $hashAlgorithm.Dispose() }
$launchMutex = [Threading.Mutex]::new($false, "Local\AnasymLaunch_$projectHash")
$ownsLaunchMutex = $false
try {
    try { $ownsLaunchMutex = $launchMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsLaunchMutex = $true }
    if (-not $ownsLaunchMutex) { throw 'Another Anasym startup is in progress for this project. Wait for it to finish.' }
$recordPath = Join-Path $projectRoot '.secrets/local-processes.json'
if (Test-Path -LiteralPath $recordPath) {
    $previousLaunch = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    $previousProcesses = if ($previousLaunch.PSObject.Properties.Name -contains 'processes') { @($previousLaunch.processes) } else { @($previousLaunch) }
    foreach ($recordedProcess in $previousProcesses) {
        $runningProcess = Get-Process -Id $recordedProcess.id -ErrorAction SilentlyContinue
        if ($runningProcess) {
            $recordedStart = if ($recordedProcess.started -is [datetime]) { $recordedProcess.started.ToUniversalTime() } else { [DateTimeOffset]::Parse([string]$recordedProcess.started, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).UtcDateTime }
            if ($runningProcess.Path -eq $recordedProcess.executable -and [Math]::Abs(($runningProcess.StartTime.ToUniversalTime() - $recordedStart).TotalSeconds) -lt 1) {
                throw 'Anasym is already running. Use scripts/stop.ps1 before starting it on other ports.'
            }
        }
    }
}
$backendEnv = Join-Path $projectRoot 'backend/.env'
if (-not (Test-Path -LiteralPath $backendEnv)) { throw 'Configure backend/.env with DJANGO_SECRET_KEY and DATABASE_URL first; see README.md.' }
$backendConfig = @{}
foreach ($line in Get-Content -LiteralPath $backendEnv) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $backendConfig[$Matches[1]] = $Matches[2].Trim() }
}
if (-not $PythonExecutable) { $PythonExecutable = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe' }
if (-not $NodeExecutable) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Node.js is required; pass -NodeExecutable with its full path.' }
    $NodeExecutable = $nodeCommand.Source
}
$PythonExecutable = (Resolve-Path -LiteralPath $PythonExecutable).Path
$NodeExecutable = (Resolve-Path -LiteralPath $NodeExecutable).Path
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'))) { throw 'Install frontend dependencies using the npm CLI command in README.md first.' }
foreach ($port in @($BackendPort, $FrontendPort)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Select unused -BackendPort and -FrontendPort values or stop the corresponding Anasym launch." }
}
$logDirectory = Join-Path $projectRoot '.secrets/logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$clusterPath = Join-Path $projectRoot '.secrets/postgres-data'
$pgCtlPath = Join-Path $PostgresBin 'pg_ctl.exe'
$started = @()
$postgresRecord = $null
$oldDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$oldUseSqlite = [Environment]::GetEnvironmentVariable('USE_SQLITE', 'Process')
$oldApiTarget = [Environment]::GetEnvironmentVariable('ANASYM_API_TARGET', 'Process')
$oldDemoMode = [Environment]::GetEnvironmentVariable('DEMO_MODE', 'Process')
$oldFrontendUrl = [Environment]::GetEnvironmentVariable('FRONTEND_URL', 'Process')
$oldSessionCookie = [Environment]::GetEnvironmentVariable('SESSION_COOKIE_NAME', 'Process')
$oldCsrfCookie = [Environment]::GetEnvironmentVariable('CSRF_COOKIE_NAME', 'Process')
$apiUrl = "http://127.0.0.1:$BackendPort"
$siteUrl = "http://127.0.0.1:$FrontendPort"
try {
    $env:ANASYM_API_TARGET = $apiUrl
    $env:FRONTEND_URL = $siteUrl
    # Cookies are shared between ports on one host. Isolate this local site.
    $env:SESSION_COOKIE_NAME = "anasym_session_$FrontendPort"
    $env:CSRF_COOKIE_NAME = "anasym_csrf_$FrontendPort"
    if ($UseSqlite) {
        $env:DATABASE_URL = ''
        $env:USE_SQLITE = 'true'
    } else {
        # Do not import the root Docker .env or overwrite the backend database URL.
        $databaseUrl = if ($oldDatabaseUrl) { $oldDatabaseUrl } else { $backendConfig['DATABASE_URL'] }
        if (-not $databaseUrl) { throw 'DATABASE_URL is required. SQLite is available only with -UseSqlite.' }
        $databaseUri = $null
        if (-not [Uri]::TryCreate($databaseUrl, [UriKind]::Absolute, [ref]$databaseUri)) { throw 'DATABASE_URL is not a valid PostgreSQL URL.' }
        if ($databaseUri.Scheme -notin @('postgres', 'postgresql')) { throw 'The local launcher requires PostgreSQL unless -UseSqlite is explicit.' }
        $env:USE_SQLITE = 'false'
        if ($databaseUri.Host -in @('127.0.0.1','localhost') -and $databaseUri.Port -eq 55432 -and (Test-Path -LiteralPath $clusterPath)) {
            $pgReadyPath = Join-Path $PostgresBin 'pg_isready.exe'
            if (-not (Test-Path -LiteralPath $pgReadyPath)) { throw 'PostgreSQL tools missing; pass -PostgresBin.' }
            & $pgReadyPath -h 127.0.0.1 -p 55432 -q
            if ($LASTEXITCODE -ne 0) {
                $pgArguments = @('start', '-D', ('"' + $clusterPath + '"'), '-l', ('"' + (Join-Path $projectRoot '.secrets/postgres.log') + '"'), '-w', '-t', '30')
                $pgControl = Start-Process -FilePath $pgCtlPath -ArgumentList $pgArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'postgres-start.log') -RedirectStandardError (Join-Path $logDirectory 'postgres-start-error.log')
                if (-not $pgControl.WaitForExit(35000)) { throw 'PostgreSQL startup timed out; inspect .secrets/logs/postgres-start-error.log.' }
                if ($pgControl.ExitCode -ne 0) { throw 'PostgreSQL failed to start; inspect its log.' }
                $pidLines = @(Get-Content -LiteralPath (Join-Path $clusterPath 'postmaster.pid'))
                $postgresRecord = @{ managed = $true; pg_ctl = $pgCtlPath; data_directory = $clusterPath; postmaster_pid = $pidLines[0]; postmaster_started = $pidLines[2] }
            }
        }
    }
    # seed_demo refuses to run unless DEMO_MODE=true. Set it for this launch only, so backend/.env keeps its value.
    if ($SeedDemo) { $env:DEMO_MODE = 'true' }
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & $PythonExecutable manage.py migrate --noinput
        if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
        if ($SeedDemo) {
            & $PythonExecutable manage.py seed_demo
            if ($LASTEXITCODE -ne 0) { throw 'Demo seed failed.' }
        }
    } finally { Pop-Location }
    $backend = Start-Process -FilePath $PythonExecutable -ArgumentList @('manage.py', 'runserver', "127.0.0.1:$BackendPort", '--noreload') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'backend.log') -RedirectStandardError (Join-Path $logDirectory 'backend-error.log')
    $started += $backend
    $frontend = Start-Process -FilePath $NodeExecutable -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'frontend.log') -RedirectStandardError (Join-Path $logDirectory 'frontend-error.log')
    $started += $frontend
    $records = @($started | ForEach-Object { @{ id = $_.Id; started = $_.StartTime.ToUniversalTime().ToString('o'); executable = $_.Path } })
    @{ processes = $records; postgres = $postgresRecord; frontend_url = $siteUrl; backend_url = $apiUrl } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $recordPath -Encoding UTF8
    $deadline = [DateTime]::UtcNow.AddSeconds(40)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($backend.HasExited -or $frontend.HasExited) { throw 'A development server exited; inspect .secrets/logs.' }
        try {
            $api = Invoke-WebRequest -UseBasicParsing -Uri "$siteUrl/api/health/" -TimeoutSec 2
            $page = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl -TimeoutSec 2
            if ($api.StatusCode -eq 200 -and ($api.Content | ConvertFrom-Json).status -eq 'ok' -and $page.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'Startup timeout; inspect .secrets/logs.' }
    $databaseLabel = if ($UseSqlite) { 'SQLite fallback' } else { 'PostgreSQL' }
    Write-Host "Local development running at $siteUrl ($databaseLabel)."
    Write-Host 'Credentials: .secrets/demo-accounts.txt. Logs: .secrets/logs. Stop: scripts/stop.ps1.'
} catch {
    foreach ($process in $started) {
        if (-not $process.HasExited) { & taskkill /PID $process.Id /T /F 2>$null | Out-Null }
    }
    if ($postgresRecord) {
        $stopArguments = @('stop', '-D', ('"' + $clusterPath + '"'), '-m', 'fast', '-w', '-t', '30')
        $pgStop = Start-Process -FilePath $pgCtlPath -ArgumentList $stopArguments -WindowStyle Hidden -PassThru
        $pgStop.WaitForExit(35000) | Out-Null
    }
    if (Test-Path -LiteralPath $recordPath) { Remove-Item -LiteralPath $recordPath }
    throw
} finally {
    [Environment]::SetEnvironmentVariable('DATABASE_URL', $oldDatabaseUrl, 'Process')
    [Environment]::SetEnvironmentVariable('USE_SQLITE', $oldUseSqlite, 'Process')
    [Environment]::SetEnvironmentVariable('ANASYM_API_TARGET', $oldApiTarget, 'Process')
    [Environment]::SetEnvironmentVariable('FRONTEND_URL', $oldFrontendUrl, 'Process')
    [Environment]::SetEnvironmentVariable('SESSION_COOKIE_NAME', $oldSessionCookie, 'Process')
    [Environment]::SetEnvironmentVariable('CSRF_COOKIE_NAME', $oldCsrfCookie, 'Process')
    [Environment]::SetEnvironmentVariable('DEMO_MODE', $oldDemoMode, 'Process')
}
} finally {
    if ($ownsLaunchMutex) { $launchMutex.ReleaseMutex() }
    $launchMutex.Dispose()
}
