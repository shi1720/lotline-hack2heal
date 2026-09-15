#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
python3 deploy/firebase/stage.py
npm ci --prefix .firebase-build/app
npm run build --prefix .firebase-build/app
npx --yes firebase-tools@15.30.0 emulators:exec --project demo-lotline --only auth,firestore --config deploy/firebase/emulators.json 'node tests/firebase-suite.mjs'
