# System inspection script: health, OPTIONS (CORS), and optional GET/PATCH with token.
# Usage:
#   .\scripts\verify-api.ps1
#   $env:BASE_URL = "http://localhost:8000/api"; .\scripts\verify-api.ps1
#   $env:TOKEN = "your_bearer_token"; $env:PROJECT_ID = "1"; .\scripts\verify-api.ps1
#
# Set BASE_URL, TOKEN, PROJECT_ID as needed. PROJECT_ID is used only for PATCH tests.

$ErrorActionPreference = "Continue"
$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "https://forms-api.saiid.org/api" }
$Origin = if ($env:ORIGIN) { $env:ORIGIN } else { "https://forms.saiid.org" }
$Pass = 0
$Fail = 0

function Check {
    param([string]$Name, [scriptblock]$Condition)
    try {
        if (& $Condition) {
            Write-Host "[PASS] $Name" -ForegroundColor Green
            $script:Pass++
            return $true
        }
    } catch {}
    Write-Host "[FAIL] $Name" -ForegroundColor Red
    $script:Fail++
    return $false
}

Write-Host "Base URL: $BaseUrl"
Write-Host "Origin:   $Origin"
Write-Host ""

# 1. GET health
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 10
    Check "GET /health returns 200" { $r.StatusCode -eq 200 }
    $body = $r.Content
    Check "GET /health body has status ok" { $body -match '"status"\s*:\s*"ok"' }
    Check "GET /health body has database" { $body -match '"database"' }
} catch {
    Write-Host "[FAIL] GET /health - $($_.Exception.Message)" -ForegroundColor Red
    $script:Fail++
}
Write-Host ""

# 2. OPTIONS login (POST)
try {
    $opt = Invoke-WebRequest -Uri "$BaseUrl/login" -Method Options -UseBasicParsing -TimeoutSec 10 `
        -Headers @{
            "Origin" = $Origin
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "Content-Type, Authorization"
        }
    Check "OPTIONS /login returns 204" { $opt.StatusCode -eq 204 }
    Check "OPTIONS /login has Allow-Origin" { $opt.Headers["Access-Control-Allow-Origin"] }
    Check "OPTIONS /login has Allow-Methods" { $opt.Headers["Access-Control-Allow-Methods"] }
} catch {
    Write-Host "[FAIL] OPTIONS /login - $($_.Exception.Message)" -ForegroundColor Red
    $script:Fail++
}
Write-Host ""

# 3. OPTIONS project-proposals/1 (PATCH)
try {
    $opt2 = Invoke-WebRequest -Uri "$BaseUrl/project-proposals/1" -Method Options -UseBasicParsing -TimeoutSec 10 `
        -Headers @{
            "Origin" = $Origin
            "Access-Control-Request-Method" = "PATCH"
            "Access-Control-Request-Headers" = "Content-Type, Authorization"
        }
    Check "OPTIONS /project-proposals/1 returns 204" { $opt2.StatusCode -eq 204 }
    $methods = $opt2.Headers["Access-Control-Allow-Methods"]
    Check "OPTIONS /project-proposals/1 has PATCH in Allow-Methods" { $methods -and $methods -match "PATCH" }
} catch {
    Write-Host "[FAIL] OPTIONS /project-proposals/1 - $($_.Exception.Message)" -ForegroundColor Red
    $script:Fail++
}
Write-Host ""

# 4. GET project-proposals without token -> 401
try {
    $r401 = Invoke-WebRequest -Uri "$BaseUrl/project-proposals" -UseBasicParsing -TimeoutSec 10
    $code401 = $r401.StatusCode
} catch {
    if ($_.Exception.Response) { $code401 = [int]$_.Exception.Response.StatusCode } else { $code401 = 0 }
}
Check "GET /project-proposals without token returns 401" { $code401 -eq 401 }
Write-Host ""

# 5. Optional: with TOKEN, GET project-proposals
if ($env:TOKEN) {
    try {
        $rAuth = Invoke-WebRequest -Uri "$BaseUrl/project-proposals" -UseBasicParsing -TimeoutSec 10 `
            -Headers @{ "Authorization" = "Bearer $($env:TOKEN)" }
        $codeAuth = $rAuth.StatusCode
    } catch {
        if ($_.Exception.Response) { $codeAuth = [int]$_.Exception.Response.StatusCode } else { $codeAuth = 0 }
    }
    Check "GET /project-proposals with token returns 200 or 403" { $codeAuth -eq 200 -or $codeAuth -eq 403 }
    Write-Host ""

    # 6. Optional: PATCH project-proposals/{id}
    if ($env:PROJECT_ID) {
        try {
            $patch = Invoke-WebRequest -Uri "$BaseUrl/project-proposals/$($env:PROJECT_ID)" -Method Patch -UseBasicParsing -TimeoutSec 10 `
                -ContentType "application/json" `
                -Headers @{
                    "Authorization" = "Bearer $($env:TOKEN)"
                    "Origin" = $Origin
                } `
                -Body "{}"
            $patchCode = $patch.StatusCode
        } catch {
            if ($_.Exception.Response) { $patchCode = [int]$_.Exception.Response.StatusCode } else { $patchCode = 0 }
        }
        Check "PATCH /project-proposals/$($env:PROJECT_ID) returns 200/422/403 (not 405)" {
            $patchCode -eq 200 -or $patchCode -eq 422 -or $patchCode -eq 403 -or $patchCode -eq 401
        }
    }
} else {
    Write-Host "Set TOKEN (and optionally PROJECT_ID) to run authenticated and PATCH checks."
}

Write-Host ""
Write-Host "--- Summary: $Pass passed, $Fail failed ---"
if ($Fail -gt 0) { exit 1 }
