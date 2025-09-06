# Codex-Flow Bootstrap Script (PowerShell)
Write-Host "[BOOTSTRAP] Starting bootstrap process..." -ForegroundColor Blue

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[SUCCESS] Created .env from .env.example" -ForegroundColor Green
    }
    else {
        Write-Host "[WARNING] No .env.example found to copy" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[INFO] .env file already exists" -ForegroundColor Green
}

# Run config verify
Write-Host "[VERIFY] Checking configuration..." -ForegroundColor Blue
try {
    & codex-flow config verify
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Configuration verified successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Configuration verification completed with warnings" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Configuration verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "[COMPLETE] Bootstrap process finished!" -ForegroundColor Green
Write-Host "[NEXT] Add API keys to .env file and run 'codex-flow config verify'" -ForegroundColor Cyan