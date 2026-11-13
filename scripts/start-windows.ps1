# Build the image and start Prelegal at http://localhost:8000.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (docker ps -aq --filter "name=^prelegal$") { docker rm -f prelegal | Out-Null }
docker run -d --name prelegal -p 8000:8000 prelegal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Prelegal running at http://localhost:8000"
