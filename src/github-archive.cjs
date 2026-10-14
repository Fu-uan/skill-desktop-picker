const unzipper=require('unzipper');
const crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
async function archiveSnapshot(source,fetcher=fetch,{signal,onProgress=()=>{}}={}){
 const timeout=AbortSignal.timeout(20000);
 const abort=signal?AbortSignal.any([signal,timeout]):timeout;
 const report=text=>onProgress(text);
 try{
  report('正在连接 GitHub 官方下载…');
  const url='https://codeload.github.com/'+encodeURIComponent(source.owner)+'/'+encodeURIComponent(source.repo)+'/zip/'+encodeURIComponent(source.ref||'HEAD');
  const response=await fetcher(url,{signal:abort,redirect:'error'});
  if(!response.ok)throw new Error(response.status===404?'仓库或分支不存在，或不是公开仓库':'GitHub 下载失败（'+response.status+'）');
  const length=Number(response.headers.get('content-length')||0);
  if(length>32*1024*1024)throw new Error('仓库压缩包超过 32 MB');
  const reader=response.body.getReader(),chunks=[];let received=0;
  try{while(true){abort.throwIfAborted();const {done,value}=await reader.read();if(done)break;received+=value.length;if(received>32*1024*1024)throw new Error('仓库压缩包超过 32 MB');chunks.push(value);report('正在下载 · '+Math.ceil(received/1024)+' KB'+(length?' / '+Math.ceil(length/1024)+' KB':''));}}finally{await reader.cancel().catch(()=>{});}
  abort.throwIfAborted();report('下载完成，正在查找 Skill…');
  const directory=await unzipper.Open.buffer(Buffer.concat(chunks));
  if(directory.files.length>5000)throw new Error('仓库文件过多，请使用独立的技能仓库');
  const commit=directory.comment?.trim();
  if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('无法确认压缩包版本');
  if(/^[a-f0-9]{40}$/.test(source.ref||'')&&commit!==source.ref)throw new Error('压缩包版本与预览版本不一致');
  const tree=[],contents=new Map();let total=0;
  for(const file of directory.files){
   abort.throwIfAborted();
   const split=file.path.indexOf('/');if(split<0)throw new Error('无效的压缩包目录');
   const name=file.path.slice(split+1);if(!name||file.type==='Directory')continue;
   if(source.prefix&&name!==source.prefix+'/SKILL.md'&&!name.startsWith(source.prefix+'/'))continue;
   const unixMode=(file.externalFileAttributes>>>16)&0xffff;
   if((unixMode&0xf000)===0xa000){tree.push({path:name,type:'blob',mode:'120000',size:file.uncompressedSize});continue;}
   if(file.uncompressedSize>3*1024*1024)throw new Error('仓库包含超过 3 MB 的文件，请使用具体 Skill 目录链接');
   total+=file.uncompressedSize;if(total>64*1024*1024)throw new Error('仓库解压内容超过 64 MB，请使用具体 Skill 目录链接');
   const stream=file.stream(),parts=[];let size=0;
   try{for await(const chunk of stream){abort.throwIfAborted();size+=chunk.length;if(size>3*1024*1024)throw new Error('文件解压内容超限');parts.push(chunk);}}finally{stream.destroy();}
   const bytes=Buffer.concat(parts);if(bytes.length!==file.uncompressedSize)throw new Error('压缩包文件长度不一致');
   const sha=hash(bytes);contents.set(sha,bytes);tree.push({path:name,type:'blob',mode:'100644',size:bytes.length,sha});
  }
  report('已读取文件清单');
  return{commit,tree,read:async file=>{const bytes=contents.get(file.sha);if(!bytes)throw new Error('文件不在下载清单中');return bytes;},dispose:async()=>contents.clear()};
 }catch(error){
  if(signal?.aborted)throw new Error('已取消下载');
  if(timeout.aborted)throw new Error('下载超过 20 秒，请检查网络后重试');
  if(/fetch failed|Failed to fetch|ERR_|network/i.test(error.message))throw new Error('无法连接 GitHub 官方下载，请检查网络后重试');
  throw error;
 }
}
module.exports={archiveSnapshot};
