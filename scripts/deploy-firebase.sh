#!/usr/bin/env bash
# Run locally in a checkout, or directly from GitHub in Google Cloud Shell.
set -euo pipefail
for tool in git gcloud python3; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. Run this command in Google Cloud Shell." >&2; exit 1; }
done
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$script_dir/../deploy/firebase/deploy.py" ]]; then
  repo_dir="$(cd "$script_dir/.." && pwd)"
else
  repo_dir="$(mktemp -d -t lotline-firebase.XXXXXX)"
  git clone --quiet --depth 1 https://github.com/shi1720/lotline-hack2heal.git "$repo_dir"
fi
exec python3 "$repo_dir/deploy/firebase/deploy.py" "$@"
