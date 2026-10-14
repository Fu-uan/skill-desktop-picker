const {app,net}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {createImporter}=require('../src/github-import.cjs');
const {archiveSnapshot}=require('../src/github-archive.cjs');
const {discover,invocation}=require('../src/catalog.cjs');
app.whenReady().then(async()=>{
 let root;const download=(url,options)=>net.fetch(url,options);
 const importer=createImporter(download,source=>archiveSnapshot(source,download,{onProgress:console.log}),{archiveFirst:true});
 try{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'picker-live-suite-'));
  const preview=await importer.preview('https://github.com/kepano/obsidian-skills');
  const result=await importer.installBatch(preview.token,root,preview.skills.map(s=>s.path),{createEntry:true,onProgress:console.log});
  assert.ok(result.items.every(i=>i.status==='installed'));assert.equal(result.entry.status,'installed');
  const scan=await discover([{path:root,agent:'codex'}]);assert.equal(scan.errors.length,0);assert.equal(scan.items.length,preview.skills.length+1);
  const entry=scan.items.find(i=>i.name===result.entry.name);assert.ok(invocation([entry],'codex').includes('$'+entry.name));
  // Only this script's uniquely created temporary directory is removed below.
  console.log(JSON.stringify({passed:true,members:preview.skills.length,discovered:scan.items.length,entry:entry.name,copy:invocation([entry],'codex')}));
  app.exitCode=0;
 }catch(error){console.error(error);app.exitCode=1;}
 finally{await importer.dispose();if(root)await fs.rm(root,{recursive:true,force:true});app.exit(app.exitCode||0);}
});
