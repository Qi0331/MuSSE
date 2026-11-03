# No start occurs unless the caller explicitly asserts a completed local fake-token test.
[CmdletBinding()]
param(
    [switch]$Start,
    [switch]$CanaryPassed,
    [string]$WorkDir = (Join-Path $HOME 'MuSSE-MCP-Local\musse-bridge')
)

$ErrorActionPreference = 'Stop'
if (-not $Start) {
    Write-Output 'PREVIEW ONLY: no process started and no configuration read.'
    Write-Output 'Real startup requires -Start -CanaryPassed after an independent fake-token log test.'
    Write-Output 'For the known working production setup, consult docs/IWIKI_LOCAL_MCP_RUNBOOK.md.'
    exit 0
}
if (-not $CanaryPassed) {
    throw 'Refusing to start: explicitly confirm an independent fake-token log test first.'
}
if ($env:OS -ne 'Windows_NT') {
    throw 'Windows-only startup script.'
}
if (-not (Test-Path -LiteralPath (Join-Path $WorkDir 'xiaozhi.config.json'))) {
    throw 'Private local config does not exist at the chosen working directory.'
}
& (Join-Path $PSScriptRoot 'Test-LocalBridge.ps1') -RequireFirewall
if ($LASTEXITCODE -ne 0) {
    throw 'Local static guard/fixed-version/firewall check failed; refusing startup.'
}
Get-Command xiaozhi -ErrorAction Stop | Out-Null

Write-Output 'Static checks passed. They do not replace the canary test you confirmed.'
Write-Output 'Starting the explicitly selected existing bridge; stop with Ctrl+C.'
Push-Location -LiteralPath $WorkDir
try {
    & xiaozhi start
} finally {
    Pop-Location
}
