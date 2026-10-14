const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createImporter,blobHash}=require('../src/github-import.cjs');
const {parseSkill}=require('../src/catalog.cjs');
async function fixture(t,names=['alpha','beta'],support=false){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'picker-collection-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const bytes=new Map(),tree=names.map((name,i)=>{const data=Buffer.from(`---\nname: ${name}\ndescription: Use for ${name} tasks\n---\nOriginal instructions`);const sha=blobHash(data);bytes.set(sha,data);return{path:`skills/item${i}/SKILL.md`,type:'blob',mode:'100644',size:data.length,sha};});
 let downloads=0,disposed=0;
 if(support){const data=Buffer.from('required support file'),sha=blobHash(data);bytes.set(sha,data);tree.push({path:'skills/item0/z-data.txt',type:'blob',mode:'100644',size:data.length,sha});}
 const importer=createImporter(null,async()=>{downloads++;return{commit:'a'.repeat(40),tree,read:async f=>bytes.get(f.sha),dispose:async()=>{disposed++;}};},{archiveFirst:true});
 const preview=await importer.preview('https://github.com/example/notes-skills');
 t.after(()=>importer.dispose());
 return{root,importer,preview,paths:tree.filter(f=>f.path.endsWith('/SKILL.md')).map(f=>f.path),counts:()=>[downloads,disposed]};
}
test('batch installs independent skills once and creates discoverable relative-path entry',async t=>{
 const f=await fixture(t);assert.equal(typeof f.importer.installBatch,'function');
 const result=await f.importer.installBatch(f.preview.token,f.root,f.paths,{createEntry:true});
 assert.deepEqual(result.items.map(i=>i.status),['installed','installed']);
 assert.deepEqual(f.counts(),[1,1]);
 assert.equal(result.entry.status,'installed');
 const content=await fs.readFile(path.join(result.entry.directory,'SKILL.md'),'utf8');
 const parsed=parseSkill(content);assert.equal(parsed.name,result.entry.name);
 assert.match(content,/本地生成/);assert.match(content,/\.\.\/alpha\/SKILL\.md/);assert.match(content,/\.\.\/beta\/SKILL\.md/);
 for(const name of ['alpha','beta'])assert.match(await fs.readFile(path.join(f.root,name,'SKILL.md'),'utf8'),/Original instructions/);
});
test('subset installs only selected skill and rejects empty or forged selections',async t=>{
 const f=await fixture(t);assert.equal(typeof f.importer.installBatch,'function');
 for(const paths of [[],['missing'],[f.paths[0],f.paths[0]]])await assert.rejects(f.importer.installBatch(f.preview.token,f.root,paths),/选择/);
 const r=await f.importer.installBatch(f.preview.token,f.root,[f.paths[1]]);
 assert.equal(r.items.length,1);assert.equal(r.entry,null);
 await assert.rejects(fs.stat(path.join(f.root,'alpha')),{code:'ENOENT'});
});
test('existing valid skill is retained and invalid existing skill yields partial result without entry',async t=>{
 const f=await fixture(t);assert.equal(typeof f.importer.installBatch,'function');
 await fs.mkdir(path.join(f.root,'alpha'));await fs.writeFile(path.join(f.root,'alpha','SKILL.md'),'---\nname: alpha\ndescription: local copy\n---\nKeep me');
 await fs.mkdir(path.join(f.root,'beta'));await fs.writeFile(path.join(f.root,'beta','SKILL.md'),'invalid');
 const r=await f.importer.installBatch(f.preview.token,f.root,f.paths,{createEntry:true});
 assert.deepEqual(r.items.map(i=>i.status),['existing','failed']);assert.equal(r.entry.status,'skipped');
 assert.match(await fs.readFile(path.join(f.root,'alpha','SKILL.md'),'utf8'),/Keep me/);
});
test('duplicate names are rejected before writes',async t=>{
 const f=await fixture(t,['same','same']);assert.equal(typeof f.importer.installBatch,'function');
 await assert.rejects(f.importer.installBatch(f.preview.token,f.root,f.paths),/同名/);
 assert.deepEqual(await fs.readdir(f.root),[]);
});
test('suite creation is repeatable and never overwrites a changed entry',async t=>{
 const f=await fixture(t);const first=await f.importer.installBatch(f.preview.token,f.root,f.paths,{createEntry:true});
 const p=await f.importer.preview('https://github.com/example/notes-skills');
 const second=await f.importer.installBatch(p.token,f.root,f.paths,{createEntry:true});
 assert.equal(second.entry.status,'existing');assert.ok(second.items.every(i=>i.status==='existing'));
 const file=path.join(first.entry.directory,'SKILL.md');await fs.appendFile(file,'\nUser customization');
 const p2=await f.importer.preview('https://github.com/example/notes-skills');
 const third=await f.importer.installBatch(p2.token,f.root,f.paths,{createEntry:true});
 assert.equal(third.entry.status,'failed');assert.match(await fs.readFile(file,'utf8'),/User customization/);
});
test('subset cannot create a misleading complete suite',async t=>{
 const f=await fixture(t);await assert.rejects(f.importer.installBatch(f.preview.token,f.root,[f.paths[0]],{createEntry:true}),/整个合集/);
 assert.deepEqual(await fs.readdir(f.root),[]);
});
test('a previously interrupted install cannot become an existing success or suite member',async t=>{
 const f=await fixture(t);const directory=path.join(f.root,'alpha');await fs.mkdir(directory);
 await fs.writeFile(path.join(directory,'SKILL.md'),'---\nname: alpha\ndescription: partial\n---\nIncomplete');
 await fs.writeFile(path.join(directory,'.skill-picker-incomplete.json'),'{}');
 const result=await f.importer.installBatch(f.preview.token,f.root,f.paths,{createEntry:true});
 assert.deepEqual(result.items.map(i=>i.status),['failed','installed']);assert.equal(result.entry.status,'skipped');
 assert.match(result.items[0].error,/未完成/);
});
test('actual interrupted move remains blocked on the next batch attempt',async t=>{
 const f=await fixture(t,['alpha','beta'],true),rename=fs.rename;
 let result;
 fs.rename=async(from,to)=>{if(to===path.join(f.root,'alpha','z-data.txt'))throw new Error('Simulated move failure');return rename(from,to);};
 try{result=await f.importer.installBatch(f.preview.token,f.root,f.paths,{createEntry:true});}finally{fs.rename=rename;}
 assert.equal(result.items[0].status,'failed');
 await fs.stat(path.join(f.root,'alpha','.skill-picker-incomplete.json'));
 const next=await f.importer.preview('https://github.com/example/notes-skills');
 const retried=await f.importer.installBatch(next.token,f.root,f.paths,{createEntry:true});
 assert.equal(retried.items[0].status,'failed');assert.equal(retried.entry.status,'skipped');
 await assert.rejects(fs.stat(path.join(f.root,'alpha','z-data.txt')),{code:'ENOENT'});
 await assert.rejects(fs.stat(path.join(f.root,'beta','.skill-picker-incomplete.json')),{code:'ENOENT'});
});
