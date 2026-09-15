#!/usr/bin/env python3
"""Create an allowlisted, standalone Next.js build; never copies local secrets."""
import json
import shutil
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def stage(target):
    target = Path(target).resolve()
    if target == ROOT or target in ROOT.parents:
        raise ValueError('Use a separate staging directory.')
    target.mkdir(parents=True, exist_ok=True)
    for entry in ('app', 'components', 'hooks', 'lib', 'public', 'vendor'):
        shutil.copytree(ROOT / entry, target / entry, dirs_exist_ok=True)
    shutil.copy2(ROOT / 'postcss.config.mjs', target / 'postcss.config.mjs')
    for name in ('package.json', 'package-lock.json', 'Dockerfile', '.dockerignore'):
        shutil.copy2(ROOT / 'deploy/firebase' / name, target / name)
    shutil.copytree(ROOT / 'deploy/firebase/overrides', target, dirs_exist_ok=True)
    config = json.loads((ROOT / 'tsconfig.json').read_text())
    config['compilerOptions']['types'] = ['node']
    config['exclude'] = ['node_modules']
    (target / 'tsconfig.json').write_text(json.dumps(config, indent=2))
    path = target / 'app/api/workspace/route.ts'
    text = path.read_text()
    old = 'origin !== new URL(request.url).origin'
    if old not in text:
        raise ValueError('Workspace origin guard changed. Review the Firebase adapter.')
    path.write_text(text.replace(old, 'origin !== process.env.APP_ORIGIN'))
    (target / 'next.config.mjs').write_text('''import { fileURLToPath } from 'node:url';
export default {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  output: 'standalone', poweredByHeader: false,
  async headers() { return [{source: '/:path*', headers: [
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'same-origin'},
    {key:'X-Frame-Options',value:'DENY'}
  ]}]; }
};
''')
    return target

if __name__ == '__main__':
    print(stage(sys.argv[1] if len(sys.argv)>1 else ROOT / '.firebase-build/app'))
