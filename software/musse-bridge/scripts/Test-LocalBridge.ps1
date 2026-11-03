# Static checks only. This script never prints config contents or token-bearing log lines.
[CmdletBinding()]
param(
    [string]$PackageRoot = '',
    [switch]$RequireFirewall
)

$ErrorActionPreference = 'Stop'
$ok = $true
try {
    if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
        if ($env:OS -ne 'Windows_NT') {
            throw 'Automatic npm path lookup is Windows-only; provide -PackageRoot for offline review.'
        }
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        $globalRoot = (& $npm root -g | Select-Object -Last 1)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($globalRoot)) {
            throw 'Unable to resolve npm global root.'
        }
        $PackageRoot = Join-Path $globalRoot.Trim() 'xiaozhi-client'
    }

    $pkgJson = Join-Path $PackageRoot 'package.json'
    if (-not (Test-Path -LiteralPath $pkgJson)) {
        throw 'Package metadata not found.'
    }
    $pkg = Get-Content -LiteralPath $pkgJson -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($pkg.name -ne 'xiaozhi-client' -or $pkg.version -ne '2.3.0') {
        throw 'Package name/version does not match audited baseline xiaozhi-client@2.3.0.'
    }
    Write-Output 'PACKAGE: expected name and version.'

    $relativePaths = @(
        'dist\backend\WebServer.js',
        'dist\backend\WebServerLauncher.js'
    )
    foreach ($relative in $relativePaths) {
        $path = Join-Path $PackageRoot $relative
        if (-not (Test-Path -LiteralPath $path)) {
            Write-Output ('PATCH STATIC: MISSING ' + $relative)
            $ok = $false
            continue
        }

        $src = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        # This is an intentionally conservative check, not a comprehensive security audit.
        $knownUnredactedLog = $src.Contains('转换配置') -and $src.Contains('console.log')
        $hasRedactedMarker = $src.Contains('MCP config converted [details redacted]')
        if ($knownUnredactedLog) {
            Write-Output ('PATCH STATIC: KNOWN RISK ' + $relative)
            $ok = $false
        } elseif ($hasRedactedMarker) {
            Write-Output ('PATCH STATIC: EXPECTED REDACTION MARKER ' + $relative)
        } else {
            Write-Output ('PATCH STATIC: UNVERIFIED (marker absent) ' + $relative)
            $ok = $false
        }
    }

    if ($RequireFirewall) {
        if ($env:OS -ne 'Windows_NT') {
            Write-Output 'FIREWALL: cannot check Windows rule on this host.'
            $ok = $false
        } else {
            try {
                $rules = @(Get-NetFirewallRule -DisplayName 'MuSSE MCP - Block Inbound 9999' -ErrorAction Stop)
                $validRule = $false
                foreach ($rule in $rules) {
                    $filters = @($rule | Get-NetFirewallPortFilter -ErrorAction Stop)
                    foreach ($filter in $filters) {
                        if ($rule.Enabled.ToString() -eq 'True' -and
                            $rule.Direction.ToString() -eq 'Inbound' -and
                            $rule.Action.ToString() -eq 'Block' -and
                            $filter.Protocol.ToString() -eq 'TCP' -and
                            $filter.LocalPort.ToString() -eq '9999') {
                            $validRule = $true
                        }
                    }
                }
                if ($validRule) {
                    Write-Output 'FIREWALL: expected inbound TCP 9999 blocking rule found.'
                } else {
                    Write-Output 'FIREWALL: expected blocking rule/port combination NOT confirmed.'
                    $ok = $false
                }
            } catch {
                Write-Output 'FIREWALL: unable to verify the expected rule.'
                $ok = $false
            }
        }
    }
} catch {
    # Do not print exception details: an unexpected failure could contain local paths.
    Write-Output 'CHECK: unable to verify installation or version.'
    $ok = $false
}

if ($ok) {
    Write-Output 'STATIC CHECKS PASS (LIMITED). This does NOT prove that tokens are safe in actual logs.'
    Write-Output 'A separate fake-token dynamic test and tool-permission review remain mandatory.'
    exit 0
}
Write-Output 'STATIC CHECKS FAIL/UNVERIFIED. Do not start a new installation with real tokens.'
exit 1
