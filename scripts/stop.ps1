[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$recordPath = Join-Path $projectRoot '.secrets/local-processes.json'
if (-not (Test-Path -LiteralPath $recordPath)) { Write-Host 'No recorded local launch.'; exit 0 }
$record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
$records = if ($record.PSObject.Properties.Name -contains 'processes') { @($record.processes) } else { @($record) }
foreach ($item in $records) {
    $process = Get-Process -Id $item.id -ErrorAction SilentlyContinue
    if ($process) {
        $expected = if ($item.started -is [datetime]) {
            $item.started.ToUniversalTime()
        } else {
            [DateTimeOffset]::Parse([string]$item.started, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).UtcDateTime
        }
        $sameStart = [Math]::Abs(($process.StartTime.ToUniversalTime() - $expected).TotalSeconds) -lt 1
        if ($sameStart -and $process.Path -eq $item.executable) {
            & taskkill /PID $process.Id /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not stop process tree $($process.Id)." }
        } else { Write-Warning "PID $($item.id) belongs to a different process; left running." }
    }
}
if ($record.PSObject.Properties.Name -contains 'postgres' -and $record.postgres) {
    $postgres = $record.postgres
    $expectedCluster = [IO.Path]::GetFullPath((Join-Path $projectRoot '.secrets/postgres-data'))
    if ([IO.Path]::GetFullPath($postgres.data_directory) -ne $expectedCluster) { throw 'Unexpected database directory in launch record.' }
    $pidFile = Join-Path $expectedCluster 'postmaster.pid'
    if (Test-Path -LiteralPath $pidFile) {
        $pidLines = @(Get-Content -LiteralPath $pidFile)
        if ($pidLines[0] -eq $postgres.postmaster_pid -and $pidLines[2] -eq $postgres.postmaster_started) {
            $arguments = @('stop','-D',('"' + $expectedCluster + '"'),'-m','fast','-w','-t','30')
            $pgControl = Start-Process -FilePath $postgres.pg_ctl -ArgumentList $arguments -WindowStyle Hidden -PassThru
            if (-not $pgControl.WaitForExit(35000) -or $pgControl.ExitCode -ne 0) { throw 'PostgreSQL stop failed; launch record retained.' }
        } else { Write-Warning 'PostgreSQL was restarted outside this launch; left running.' }
    }
}
Remove-Item -LiteralPath $recordPath
Write-Host 'Recorded application processes stopped; only launcher-owned PostgreSQL was stopped.'
