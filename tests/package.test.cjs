const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'../extension');
test('package stays limited to claude.ai, local storage and bundled code',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);
 assert.deepEqual(manifest.host_permissions,['https://claude.ai/*']);
 assert.deepEqual(manifest.content_scripts[0].matches,['https://claude.ai/*']);
 assert.ok(!manifest.externally_connectable);assert.ok(!manifest.web_accessible_resources);assert.ok(!manifest.update_url);
 assert.match(manifest.content_security_policy.extension_pages,/connect-src 'none'/);
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const text=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(text,/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|\beval\s*\(/,file);}
});
