#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'extension/manifest.json').read_text())['version']
out=root/'dist';out.mkdir(exist_ok=True)
archive=out/f'claude-browser-accountant-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted((root/'extension').rglob('*')):
        if file.is_file() and file.suffix in {'.js','.json','.html','.css','.png','.svg'}:
            z.write(file,file.relative_to(root))
    for file in sorted((root/'docs').rglob('*')):
        if file.is_file() and file.suffix in {'.md','.json','.svg','.png'}:z.write(file,file.relative_to(root))
    for name in ['README.md','LICENSE']:
        if (root/name).exists():z.write(root/name,name)
(out/'SHA256SUMS.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(archive)
