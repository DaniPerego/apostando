# Iniciar MariaDB
$mariadb = "C:\Program Files\MariaDB 12.3\bin\mariadbd.exe"
$proc = Get-Process -Name "mariadbd" -ErrorAction SilentlyContinue
if (-not $proc) {
    Start-Process -FilePath $mariadb -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# Iniciar servidor Node
$nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "server.js" }
if (-not $nodeProc) {
    $appDir = $PSScriptRoot
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $appDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Abrir navegador
Start-Process "http://localhost:3000"