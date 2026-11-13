#!/usr/bin/env bash
# Stop Prelegal and remove the container, discarding its temporary database.
set -euo pipefail
docker rm -f prelegal
echo "Prelegal stopped"
