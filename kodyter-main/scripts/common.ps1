Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Get-AnasymConfig {
    $values = @{}
    $envPath = Join-Path $script:ProjectRoot '.env'
    if (-not (Test-Path -LiteralPath $envPath)) { throw 'Run scripts/setup-env.ps1 first.' }
    foreach ($line in Get-Content -LiteralPath $envPath) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim()
        }
    }
    return $values
}

function Invoke-AnasymDocker {
    param([Parameter(Mandatory)][string[]]$DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
}
