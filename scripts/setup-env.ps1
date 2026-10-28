# Creates secrets once; existing files and passwords are never overwritten.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $destination) {
    Write-Host 'Existing .env preserved. Review its values before deployment.'
    exit 0
}
function New-RandomHex([int]$Length) {
    $bytes = New-Object byte[] $Length
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
$template = [IO.File]::ReadAllText((Join-Path $projectRoot '.env.example'))
$template = $template.Replace('DJANGO_SECRET_KEY=GENERATE_WITH_SETUP_SCRIPT', 'DJANGO_SECRET_KEY=' + (New-RandomHex 48))
$template = $template.Replace('POSTGRES_PASSWORD=GENERATE_WITH_SETUP_SCRIPT', 'POSTGRES_PASSWORD=' + (New-RandomHex 32))
[IO.File]::WriteAllText($destination, $template, (New-Object Text.UTF8Encoding $false))
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.secrets') | Out-Null
Write-Host '.env created with random secrets. Values were not printed.'
