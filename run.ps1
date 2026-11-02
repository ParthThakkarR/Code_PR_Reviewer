# ============================================================
#  CodeReview — One-Click Startup Script for Windows (PowerShell)
#  Usage: .\run.ps1
# ============================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       CodeReview — Starting Up Services      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Function to kill process by port ──────────────────────────
function Stop-PortProcess([int]$Port) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
                Write-Host "  Stopping existing process on port $Port (PID $($conn.OwningProcess))..." -ForegroundColor Yellow
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {}
}

Write-Host "► Checking and clearing ports 5001, 8000, 5173..." -ForegroundColor Yellow
Stop-PortProcess 5001
Stop-PortProcess 8000
Stop-PortProcess 5173
Start-Sleep -Seconds 1

# ── 1. Backend (Express) ──────────────────────────────────────
Write-Host "► Starting Backend (Express) on http://localhost:5001..." -ForegroundColor Green
$BackendCmd = "cd '$Root\backend_express'; node index.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== Backend Express ===' -ForegroundColor Green; $BackendCmd"

Start-Sleep -Seconds 2

# ── 2. Python Analyzer ────────────────────────────────────────
Write-Host "► Starting Python Analyzer on http://localhost:8000..." -ForegroundColor Green
$PythonCmd = "cd '$Root\analyzer_python'; if (Test-Path '.\venv\Scripts\python.exe') { .\venv\Scripts\python.exe main.py } else { python main.py }"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== Python Analyzer ===' -ForegroundColor Yellow; $PythonCmd"

Start-Sleep -Seconds 2

# ── 3. Frontend (Vite) ────────────────────────────────────────
Write-Host "► Starting Frontend (Vite) on http://localhost:5173..." -ForegroundColor Green
$FrontendCmd = "cd '$Root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== Frontend Vite ===' -ForegroundColor Cyan; $FrontendCmd"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅  All services started successfully in windows!       ║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║  🌐  Frontend (UI):       http://localhost:5173          ║" -ForegroundColor Cyan
Write-Host "║  🔌  Backend API:         http://localhost:5001          ║" -ForegroundColor Cyan
Write-Host "║  🐍  Python Analyzer:     http://localhost:8000          ║" -ForegroundColor Cyan
Write-Host "║  🛡️   PR & SBOM Gate:      http://localhost:5173/sbom-pr  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 1
Start-Process "http://localhost:5173" -ErrorAction SilentlyContinue
