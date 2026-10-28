# Binary dumps use docker cp, avoiding PowerShell stdout encoding corruption.
[CmdletBinding()]
param([string]$Destination = '')
. "$PSScriptRoot/common.ps1"
$config = Get-AnasymConfig
$database = if ($config['POSTGRES_DB']) { $config['POSTGRES_DB'] } else { 'anasym' }
$dbUser = if ($config['POSTGRES_USER']) { $config['POSTGRES_USER'] } else { 'anasym' }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
if (-not $Destination) { $Destination = Join-Path $script:ProjectRoot "backups/$stamp" }
$backupDirectory = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $backupDirectory) { throw 'Backup destination already exists; choose an empty new directory.' }
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
Push-Location $script:ProjectRoot
try {
    Invoke-AnasymDocker -DockerArguments @('compose','exec','-T','db','pg_dump','-U',$dbUser,'-d',$database,'-Fc','--no-owner','--no-acl','-f',"/tmp/$stamp.dump")
    Invoke-AnasymDocker -DockerArguments @('compose','cp',"db:/tmp/$stamp.dump",(Join-Path $backupDirectory 'database.dump'))
    Invoke-AnasymDocker -DockerArguments @('compose','exec','-T','frontend','tar','-czf',"/tmp/$stamp-media.tar.gz",'-C','/usr/share/nginx/html/media','.')
    Invoke-AnasymDocker -DockerArguments @('compose','cp',"frontend:/tmp/$stamp-media.tar.gz",(Join-Path $backupDirectory 'media.tar.gz'))
    $manifest = @{
        created_utc = [DateTime]::UtcNow.ToString('o')
        database = $database
        database_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $backupDirectory 'database.dump')).Hash
        media_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $backupDirectory 'media.tar.gz')).Hash
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDirectory 'backup.json') -Encoding UTF8
    Write-Host "Backup saved: $backupDirectory"
} finally {
    & docker compose exec -T db rm -f "/tmp/$stamp.dump" 2>$null
    & docker compose exec -T frontend rm -f "/tmp/$stamp-media.tar.gz" 2>$null
    Pop-Location
}
