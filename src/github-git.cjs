const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);

// Public, read-only Git transport; no checkout, hooks, or credential prompts.
async function gitSnapshot(source){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'skill-picker-git-'));
 const repo=path.join(root,'repo.git');
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'};
 const run=async(args,limit=16*1024*1024)=>exec('git',['-c','credential.helper=','-c','core.hooksPath='+path.join(root,'no-hooks'),...args],{env,windowsHide:true,timeout:45000,maxBuffer:limit,encoding:'buffer'});
 try{
  await run(['init','--bare',repo]);
  const url='https://github.com/'+source.owner+'/'+source.repo+'.git';
  const fetchArgs=['-C',repo,'fetch','--depth=1','--no-tags','--no-recurse-submodules','--',url,source.ref||'HEAD'];
  try{await run(fetchArgs);}catch(error){if(!error.killed&&!/Failed to connect|Could not resolve|timed out|reset|RPC failed|early EOF/i.test(error.stderr?.toString()||''))throw error;await run(fetchArgs);}
  const commit=(await run(['-C',repo,'rev-parse','FETCH_HEAD'])).stdout.toString('utf8').trim();
  const listing=(await run(['-C',repo,'ls-tree','-r','-l','-z',commit])).stdout.toString('utf8');
  const tree=listing.split('\0').filter(Boolean).map(line=>{
   const match=line.match(/^(\d+) (\w+) ([a-f0-9]+)\s+(\d+|-)\t([\s\S]+)$/);
   if(!match)throw new Error('无法读取 Git 文件清单');
   return{mode:match[1],type:match[2],sha:match[3],size:match[4]==='-'?0:Number(match[4]),path:match[5]};
  });
  return{commit,tree,read:async file=>(await run(['-C',repo,'cat-file','blob',file.sha],3*1024*1024+1024)).stdout,dispose:()=>fs.rm(root,{recursive:true,force:true})};
 }catch(error){
  await fs.rm(root,{recursive:true,force:true});
  throw new Error(error.code==='ENOENT'?'GitHub 接口限流；备用下载需要安装 Git。也可下载技能后使用本地文件夹安装。':'GitHub 接口限流，备用 Git 下载也未成功。请稍后重试，或下载技能后使用本地文件夹安装。',{cause:error});
 }
}
module.exports={gitSnapshot};
