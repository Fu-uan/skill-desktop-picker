const {test}=require('node:test');
const assert=require('node:assert/strict');
const {archiveSnapshot}=require('../src/github-archive.cjs');
const {createImporter}=require('../src/github-import.cjs');
const commit='1234567890123456789012345678901234567890';
function zip(content){
 const name=Buffer.from('repo-HEAD/SKILL.md'),bytes=Buffer.from(content),comment=Buffer.from(commit);
 let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+bytes.length,16);end.writeUInt16LE(comment.length,20);
 return Buffer.concat([local,name,bytes,central,name,end,comment]);
}
test('direct archive preview reads pinned metadata without API or Git',async()=>{
 const bytes=zip('---\nname: archive-demo\ndescription: sample\n---\nBody');let downloads=0;const progress=[];
 const fetcher=async url=>{assert.match(url,/^https:\/\/codeload.github.com\//);downloads++;return new Response(bytes);};
 const importer=createImporter(()=>{throw Error('API must not be used');},s=>archiveSnapshot(s,fetcher,{onProgress:p=>progress.push(p)}),{archiveFirst:true});
 const preview=await importer.preview('https://github.com/a/b');assert.equal(preview.transport,'archive');assert.equal(preview.commit,commit);
 const selected=await importer.inspect(preview.token,preview.skills[0].path);assert.equal(selected.name,'archive-demo');
 await importer.preview('https://github.com/a/b');assert.equal(downloads,1);assert.ok(progress.some(p=>p.includes('下载')));await importer.dispose();
});
test('archive cancellation and size limits return actionable errors',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(archiveSnapshot({owner:'a',repo:'b'},async()=>new Response(zip('x')),{signal:controller.signal}),/已取消/);
 await assert.rejects(archiveSnapshot({owner:'a',repo:'b'},async()=>new Response('',{headers:{'content-length':String(33*1024*1024)}})),/32 MB/);
});
