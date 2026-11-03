# Read-only by default. Explicit -Install writes only to a separate sandbox npm prefix.
[CmdletBinding()]
param(
    [switch]$Install,
    [string]$SandboxRoot = (Join-Path $HOME 'MuSSE-MCP-Local\bridge-repro-sandbox')
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') {
    throw 'This draft installer supports Windows only.'
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$nodeVersion = (& $node -p 'process.versions.node').Trim()
if ([version]$nodeVersion -lt [version]'22.18.0') {
    throw 'Node.js >= 22.18 is required.'
}

$production = [IO.Path]::GetFullPath((Join-Path $HOME 'MuSSE-MCP-Local\musse-bridge')).TrimEnd('\')
$target = [IO.Path]::GetFullPath($SandboxRoot).TrimEnd('\')
if ($target.Equals($production, [StringComparison]::OrdinalIgnoreCase) -or
    $target.StartsWith(($production + '\'), [StringComparison]::OrdinalIgnoreCase) -or
    $production.StartsWith(($target + '\'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to install within or over the existing production bridge directory.'
}

$prefix = Join-Path $target 'npm-prefix'
Write-Output 'Pinned package: xiaozhi-client@2.3.0'
Write-Output ('Node.js requirement: PASS (' + $nodeVersion + ')')
Write-Output 'Target is a separate sandbox; production installation will not be modified.'
if (-not $Install) {
    Write-Output 'DRY RUN ONLY. To install an isolated, UNPATCHED copy, explicitly pass -Install.'
    exit 0
}

if (Test-Path -LiteralPath $prefix) {
    throw 'Sandbox prefix already exists. Refusing to overwrite or update it.'
}
New-Item -Path $prefix -ItemType Directory -Force | Out-Null
& $npm install --global --prefix $prefix 'xiaozhi-client@2.3.0' --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw 'npm installation failed. Sandbox may contain partial files; production is unchanged.'
}

Write-Output 'Isolated npm installation finished. DO NOT start it with real tokens.'
Write-Output 'Next: inspect and apply a reviewed patch in the sandbox, then test with fake tokens.'
Write-Output 'Package path: <sandbox>/npm-prefix/node_modules/xiaozhi-client'
