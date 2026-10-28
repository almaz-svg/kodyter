# Restores only into the configured Compose PostgreSQL database.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$BackupDirectory,
    [switch]$ConfirmRestore
)
. "$PSScriptRoot/common.ps1"
if (-not $ConfirmRestore) { throw 'Restore replaces database contents. Re-run with -ConfirmRestore after taking a fresh backup.' }
$config = Get-AnasymConfig
$database = if ($config['POSTGRES_DB']) { $config['POSTGRES_DB'] } else { 'anasym' }
$dbUser = if ($config['POSTGRES_USER']) { $config['POSTGRES_USER'] } else { 'anasym' }
$directory = (Resolve-Path -LiteralPath $BackupDirectory).Path
$dump = Join-Path $directory 'database.dump'
$media = Join-Path $directory 'media.tar.gz'
$manifest = Get-Content -LiteralPath (Join-Path $directory 'backup.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $dump).Hash -ne $manifest.database_sha256) { throw 'Database backup checksum mismatch.' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $media).Hash -ne $manifest.media_sha256) { throw 'Media backup checksum mismatch.' }
$restoreId = [Guid]::NewGuid().ToString('N')
Push-Location $script:ProjectRoot
$backendStopped = $false
try {
    Invoke-AnasymDocker -DockerArguments @('compose','cp',$dump,"db:/tmp/$restoreId.dump")
    Invoke-AnasymDocker -DockerArguments @('compose','exec','-T','db','pg_restore','--list',"/tmp/$restoreId.dump") | Out-Null
    Invoke-AnasymDocker -DockerArguments @('compose','cp',$media,"frontend:/tmp/$restoreId-media.tar.gz")
    $entries = @(& docker compose exec -T frontend tar -tzf "/tmp/$restoreId-media.tar.gz")
    if ($LASTEXITCODE -ne 0) { throw 'Media archive cannot be read.' }
    foreach ($entry in $entries) {
        if ($entry -match '^[/\\]' -or $entry -match '(^|[/\\])\.\.([/\\]|$)') { throw 'Unsafe media archive path.' }
    }
    Invoke-AnasymDocker -DockerArguments @('compose','stop','backend')
    $backendStopped = $true
    Invoke-AnasymDocker -DockerArguments @('compose','exec','-T','db','pg_restore','-U',$dbUser,'-d',$database,'--clean','--if-exists','--no-owner','--no-acl','--exit-on-error','--single-transaction',"/tmp/$restoreId.dump")
    # Frontend mounts media read-only; use the backend service's writable media volume.
    $extractCode = "import tarfile; tarfile.open('/restore/media.tar.gz', 'r:gz').extractall('/app/media', filter='data')"
    Invoke-AnasymDocker -DockerArguments @('compose','run','--rm','--no-deps','-v',"${directory}:/restore:ro",'backend','python','-c',$extractCode)
    Invoke-AnasymDocker -DockerArguments @('compose','start','backend')
    $backendStopped = $false
    Write-Host 'Database and media restored. Check /api/health/ and role workflows.'
} finally {
    & docker compose exec -T db rm -f "/tmp/$restoreId.dump" 2>$null
    & docker compose exec -T frontend rm -f "/tmp/$restoreId-media.tar.gz" 2>$null
    if ($backendStopped) { Write-Warning 'Backend remains stopped after the failed restore. Investigate before docker compose start backend.' }
    Pop-Location
}
