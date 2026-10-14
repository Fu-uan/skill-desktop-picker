const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseSkill} = require('./catalog.cjs');
const MAX_BYTES=20*1024*1024, MAX_FILES=200;
function parseLink(value){
 let url;try{url=new URL(value.trim());}catch{throw new Error('请输入完整的 GitHub HTTPS 链接');}
 if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password)throw new Error('目前仅支持 github.com 的公开 HTTPS 仓库链接');
 const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
 const [owner,repo,kind,ref,...rest]=parts;
 if(!owner||!repo||!/^[-\w.]+$/.test(owner)||!/^[-\w.]+$/.test(repo))throw new Error('无法识别仓库名称');
 if(kind&&!['tree','blob'].includes(kind))throw new Error('请使用仓库首页、技能目录或 SKILL.md 文件链接');
 if(kind&&!ref)throw new Error('链接缺少分支或提交号');
 let prefix=rest.join('/');
 if(kind==='blob'){if(rest.at(-1)!=='SKILL.md')throw new Error('文件链接必须指向 SKILL.md');prefix=rest.slice(0,-1).join('/');}
 return{owner,repo:repo.replace(/\.git$/,''),ref:ref||null,prefix};
}
function safeRelative(value){
 if(!value||value.length>240||value.includes('\\')||value.startsWith('/')||/[\x00-\x1f<>:"|?*]/.test(value))throw new Error('技能包含不安全或不受支持的文件路径');
 for(const part of value.split('/'))if(!part||part==='.'||part==='..'||/[ .]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))throw new Error('技能包含不安全或不受支持的文件路径');
 return value;
}
function blobHash(bytes){return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}
function createImporter(fetcher=fetch,fallback=require('./github-git.cjs').gitSnapshot,options={}){
 const plans=new Map(),cache=new Map();let limitedUntil=0;
 async function dispose(){for(const plan of plans.values())await plan.snapshot?.dispose();plans.clear();}
 async function request(route){
  const cached=cache.get(route);if(cached&&Date.now()-cached.time<600000)return cached.data;
  if(Date.now()<limitedUntil){const error=new Error('GitHub 接口限流');error.code='RATE_LIMIT';throw error;}
  const response=await fetcher('https://api.github.com'+route,{headers:{Accept:'application/vnd.github+json','User-Agent':'skill-desktop-picker'},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok){const body=await response.text();const limited=response.status===429||response.status===403&&(response.headers?.get('x-ratelimit-remaining')==='0'||/rate limit|secondary rate/i.test(body));const error=new Error(response.status===404?'仓库、分支或路径不存在，或该仓库为私有仓库':limited?'GitHub 接口限流':'GitHub 请求被拒绝（'+response.status+'）');if(limited){error.code='RATE_LIMIT';const reset=Number(response.headers?.get('x-ratelimit-reset'))*1000;limitedUntil=reset>Date.now()?reset:Date.now()+60000;}throw error;}
  const length=Number(response.headers?.get('content-length')||0);if(length>32*1024*1024)throw new Error('GitHub 响应过大');
  const text=await response.text();if(Buffer.byteLength(text)>32*1024*1024)throw new Error('GitHub 响应过大');const data=JSON.parse(text);if(!route.includes('/git/blobs/')){if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(route,{time:Date.now(),data});}return data;
 }
 async function bytesFor(plan,file){
  if(plan.bytes.has(file.sha))return plan.bytes.get(file.sha);
  let bytes;
  if(plan.snapshot)bytes=await plan.snapshot.read(file);
  else try{const blob=await request(`${plan.base}/git/blobs/${file.sha}`);if(blob.encoding!=='base64')throw new Error('不支持的 GitHub 文件编码');bytes=Buffer.from(blob.content,'base64');}catch(error){if(error.code!=='RATE_LIMIT')throw error;plan.snapshot=await fallback({...plan.source,ref:plan.commit});bytes=await plan.snapshot.read(file);}
  if(bytes.length!==file.size||blobHash(bytes)!==file.sha)throw new Error('文件内容与预览版本不一致');
  if(plan.byteCount+bytes.length<=MAX_BYTES){plan.bytes.set(file.sha,bytes);plan.byteCount+=bytes.length;}
  return bytes;
 }
 async function preview(link){
  const source=parseLink(link),base=`/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`;
  const key=JSON.stringify(source);for(const plan of plans.values())if(plan.key===key&&Date.now()-plan.created<600000)return plan.result;
  await dispose();let commit,tree,snapshot;
  if(options.archiveFirst){snapshot=await fallback(source);commit={sha:snapshot.commit};tree={tree:snapshot.tree,truncated:false};}
  else try{const ref=source.ref||(await request(base)).default_branch;commit=await request(`${base}/commits/${encodeURIComponent(ref)}`);tree=await request(`${base}/git/trees/${commit.commit.tree.sha}?recursive=1`);}catch(error){if(error.code!=='RATE_LIMIT')throw error;snapshot=await fallback(source);commit={sha:snapshot.commit};tree={tree:snapshot.tree,truncated:false};}
  if(tree.truncated)throw new Error('仓库过大，无法完整预览，请下载技能后使用本地目录导入');
  const skillFiles=tree.tree.filter(f=>f.type==='blob'&&(f.path==='SKILL.md'||f.path.endsWith('/SKILL.md'))&&(!source.prefix||f.path===source.prefix+'/SKILL.md'||f.path.startsWith(source.prefix+'/')));
  if(!skillFiles.length||skillFiles.length>300){await snapshot?.dispose();throw new Error(!skillFiles.length?'该路径下没有找到 SKILL.md':'技能数量过多，请使用具体技能目录链接');}
  const token=crypto.randomUUID();const result={token,repository:source.owner+'/'+source.repo,commit:commit.sha,transport:options.archiveFirst?'archive':snapshot?'git':'api',skills:skillFiles.map(f=>({path:f.path,label:f.path==='SKILL.md'?source.repo:f.path.slice(0,-9)}))};
  plans.set(token,{key,result,base,tree:tree.tree,skillFiles,commit:commit.sha,source,snapshot,bytes:new Map(),byteCount:0,created:Date.now()});return result;
 }
 function planFor(token){const plan=plans.get(token);if(!plan||Date.now()-plan.created>30*60*1000)throw new Error('预览已过期，请重新解析链接');return plan;}
 async function inspect(token,skillPath){
  const plan=planFor(token),entry=plan.skillFiles.find(f=>f.path===skillPath);if(!entry)throw new Error('无效的技能选择');
  const prefix=skillPath==='SKILL.md'?'':skillPath.slice(0,-8);
  const entries=plan.tree.filter(f=>f.type!=='tree'&&(!prefix||f.path.startsWith(prefix)));
  if(entries.length>MAX_FILES)throw new Error('单个技能超过 200 个文件，请改用本地目录导入');
  let total=0;const seen=new Set();
  const files=entries.map(f=>{if(f.type!=='blob'||!['100644','100755'].includes(f.mode))throw new Error('不导入符号链接或 Git 子模块');const relative=safeRelative(f.path.slice(prefix.length));if(relative.split('/').some(p=>['.git','.env','node_modules'].includes(p.toLowerCase())))throw new Error('技能目录包含不适合导入的隐藏配置或依赖目录');if(seen.has(relative.toLowerCase()))throw new Error('文件名在 Windows 上存在大小写冲突');seen.add(relative.toLowerCase());if(!Number.isSafeInteger(f.size)||f.size<0||f.size>3*1024*1024)throw new Error('单个文件超过 3 MB');total+=f.size;return{...f,relative};});
  if(total>MAX_BYTES)throw new Error('技能包超过 20 MB');
  if(files.some(f=>f.relative.toLowerCase()==='.skill-picker-incomplete.json'))throw new Error('技能包含安装器保留文件名');
  const metadata=parseSkill((await bytesFor(plan,entry)).toString('utf8'));safeRelative(metadata.name);if(metadata.name.includes('/'))throw new Error('技能名称不能包含路径');
  plan.selected={skillPath,files,metadata,total};
  return{name:metadata.name,description:metadata.description,files:files.map(f=>({path:f.relative,size:f.size})),bytes:total,commit:plan.commit};
 }
 async function install(token,directory,retain=false){
  const plan=planFor(token),selected=plan.selected;if(!selected)throw new Error('请先选择并预览技能');
  const base=await fs.realpath(directory),destination=path.join(base,selected.metadata.name);
  try{await fs.lstat(destination);const error=new Error('同名目录已存在');error.code='SKILL_EXISTS';error.directory=destination;error.skillName=selected.metadata.name;throw error;}catch(e){if(e.code!=='ENOENT')throw e;}
  const staging=await fs.mkdtemp(path.join(base,'.skill-import-'));
  try{
   for(const file of selected.files){const data=await bytesFor(plan,file);const target=path.join(staging,...file.relative.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data,{flag:'wx'});}
   // Claim the final name without replacing a pre-existing path, then move files inside it.
   await fs.mkdir(destination);
   const pending=path.join(destination,'.skill-picker-incomplete.json');
   await fs.writeFile(pending,JSON.stringify({commit:plan.commit,name:selected.metadata.name}),{flag:'wx'});
   try{for(const name of await fs.readdir(staging))await fs.rename(path.join(staging,name),path.join(destination,name));}catch(e){throw new Error('文件下载完成，但移动未完成。请检查新建目录：'+destination+'；'+e.message);}
   for(const file of selected.files){const written=await fs.readFile(path.join(destination,...file.relative.split('/')));if(blobHash(written)!==file.sha)throw new Error('安装后的文件校验失败：'+file.relative);}
   await fs.unlink(pending);
   if(!retain){await plan.snapshot?.dispose();plans.delete(token);}return{directory:destination,name:selected.metadata.name,files:selected.files.length,commit:plan.commit};
  }finally{await fs.rm(staging,{recursive:true,force:true});}
 }
 async function installBatch(token,directory,paths,{createEntry=false,onProgress=()=>{}}={}){
  const plan=planFor(token);
  if(!Array.isArray(paths)||!paths.length||paths.length>300||new Set(paths).size!==paths.length||paths.some(p=>typeof p!=='string'||!plan.skillFiles.some(f=>f.path===p)))throw new Error('无效的技能选择');
  if(createEntry&&paths.length!==plan.skillFiles.length)throw new Error('统一入口需要选择整个合集');
  const {verifyInstalled,installOrIndex}=require('./installation.cjs');
  const prepared=[],names=new Set();
  for(const p of paths){
   let metadata;try{metadata=await inspect(token,p);}catch(error){prepared.push({path:p,error:error.message});continue;}
   const key=metadata.name.toLowerCase();if(names.has(key))throw new Error('所选技能包含同名安装目录：'+metadata.name);
   names.add(key);prepared.push({path:p,...metadata});
  }
  const items=[];let entry=null;
  try{
   for(const [index,skill]of prepared.entries()){
    onProgress(`正在安装 ${index+1}/${prepared.length} · ${skill.name||skill.path}`);
    try{
     if(skill.error)throw new Error(skill.error);
     await inspect(token,skill.path);
     const result=await installOrIndex({install:(t,d)=>install(t,d,true)},token,directory);
     await verifyInstalled(result.directory,result.name);
     items.push({...result,path:skill.path,status:result.existing?'existing':'installed'});
    }catch(error){items.push({path:skill.path,name:skill.name||skill.path,status:'failed',error:error.message});}
   }
   if(createEntry){
    if(items.some(i=>i.status==='failed'))entry={status:'skipped',error:'部分成员安装失败，未创建不完整的统一入口。'};
    else try{entry=await require('./suite.cjs').createSuite(await fs.realpath(directory),plan.result.repository,plan.commit,prepared);await verifyInstalled(entry.directory,entry.name);}catch(error){entry={status:'failed',error:error.message};}
   }
   return{repository:plan.result.repository,items,entry};
  }finally{await plan.snapshot?.dispose();plans.delete(token);}
 }
 return{preview,inspect,install,installBatch,dispose};
}
module.exports={parseLink,safeRelative,blobHash,createImporter};
