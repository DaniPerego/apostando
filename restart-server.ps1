# Reiniciar servidor limpiamente

Write-Host "Buscando procesos de Node.js..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Procesos encontrados. Deteniendo..." -ForegroundColor Cyan
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "Procesos detenidos" -ForegroundColor Green
}
else {
    Write-Host "No hay procesos de Node.js corriendo" -ForegroundColor Green
}

Write-Host ""
Write-Host "Iniciando servidor..." -ForegroundColor Yellow
Write-Host "Servidor disponible en: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""

node server.js
