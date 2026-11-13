# Stop Prelegal and remove the container, discarding its temporary database.
docker rm -f prelegal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Prelegal stopped"
