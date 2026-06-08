# scripts/stamp-release.ps1
#
# Windows equivalent of stamp-release.sh.
# Injects the current git commit SHA into every HTML file containing
# <meta name="gb-release-sha" content="..."> before a deploy.
#
# Usage:
#   .\scripts\stamp-release.ps1
#   .\scripts\stamp-release.ps1 -Sha abc1234   # force a specific SHA
#
# Pipe into your deploy command:
#   .\scripts\stamp-release.ps1; firebase deploy --only hosting

param(
    [string]$Sha = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve SHA ─────────────────────────────────────────────────────────────
if (-not $Sha) {
    try {
        $Sha = (git rev-parse --short=8 HEAD 2>$null).Trim()
    } catch { $Sha = "dev" }
    if (-not $Sha) { $Sha = "dev" }
}

Write-Host "Stamping release SHA: $Sha" -ForegroundColor Cyan

# ── Files to stamp ───────────────────────────────────────────────────────────
$HtmlFiles = @(
    "index.html",
    "public\academy\index.html",
    "public\academy\certificate.html"
)

$Pattern     = '<meta name="gb-release-sha" content="[^"]*"/>'
$Replacement = "<meta name=`"gb-release-sha`" content=`"$Sha`"/>"

foreach ($File in $HtmlFiles) {
    if (Test-Path $File) {
        $Content = Get-Content $File -Raw -Encoding UTF8
        $Stamped = [regex]::Replace($Content, $Pattern, $Replacement)
        Set-Content $File -Value $Stamped -Encoding UTF8 -NoNewline
        Write-Host "  OK  $File" -ForegroundColor Green
    } else {
        Write-Host "  --  $File (not found, skipped)" -ForegroundColor DarkGray
    }
}

Write-Host "Done. All HTML stamped with SHA $Sha." -ForegroundColor Cyan
