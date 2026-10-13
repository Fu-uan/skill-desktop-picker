const { app, BrowserWindow, ipcMain, dialog, clipboard, globalShortcut, screen, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const { discover, invocation } = require('./catalog.cjs');
const { displayFor, fingerprint } = require('./display.cjs');
const { setLockedWindowSize } = require('./window-size.cjs');
const { AGENTS, compatibilityFor, markCompatibility } = require('./compatibility.cjs');
let win, settings, catalog = [], target = null, busy = false, panelExpanded = true;
const home = os.homedir();
const defaultSources = () => [
  ['codex', path.join(home,'.codex','skills')], ['codex',path.join(home,'.agents','skills')],
  ['claude',path.join(home,'.claude','skills')], ['hermes',path.join(process.env.HERMES_HOME || path.join(home,'.hermes'),'skills')],
  ['openclaw',path.join(home,'.openclaw','skills')], ['openclaw',path.join(home,'.openclaw','workspace','skills')]
].map(([agent,p])=>({agent,path:p}));
const storePath = () => path.join(app.getPath('userData'),'settings.json');
async function save(){await fs.writeFile(storePath(),JSON.stringify(settings,null,2));}
async function bridge(action,handle=0){
  if(process.platform!=='win32') throw new Error('直接插入目前仅支持 Windows，请使用复制');
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'window-bridge.ps1'),'-Action',action,'-Handle',String(handle)],{windowsHide:true,timeout:10000,maxBuffer:100000});
  return action==='foreground'?JSON.parse(stdout.trim()):true;
}
async function capture(){if(busy)return;busy=true;try{const t=await bridge('foreground');if(t.pid!==process.pid&&t.title&&!t.title.includes('Skill Desktop Picker')){target=t;win?.webContents.send('target',target);}}catch{}finally{busy=false;}}
function resize(expanded){panelExpanded=expanded;const scale=(settings.zoom||100)/100;const height=expanded?740:76; const work=screen.getDisplayMatching(win.getBounds()).workArea; setLockedWindowSize(win,Math.min(Math.round(470*scale),work.width-24),Math.min(Math.round(height*scale),work.height-24));const b=win.getBounds();win.setPosition(Math.max(work.x,Math.min(b.x,work.x+work.width-b.width)),Math.max(work.y,Math.min(b.y,work.y+work.height-b.height)));}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(event.sender!==win.webContents)throw new Error('Invalid sender');return fn(...args);});}
app.whenReady().then(async()=>{
  try{settings=JSON.parse(await fs.readFile(storePath(),'utf8'));}catch{settings={sources:defaultSources(),theme:'graphite',favorites:[],agent:'codex'};}
  win=new BrowserWindow({width:430,height:650,frame:false,transparent:true,alwaysOnTop:true,resizable:false,show:false,title:'Skill Desktop Picker',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  settings.fontSize ||= 13;settings.zoom ||= 100;settings.displayOverrides ||= {};settings.favorites ||= [];
  handle('load',async()=>{const result=await discover(settings.sources);catalog=result.items;return{settings,items:catalog.map(s=>({...s,display:displayFor(s,settings.displayOverrides),compatibility:compatibilityFor(s,settings.compatibility)})),errors:result.errors,target};});
  handle('compatibility',async(id,agent,state,note)=>{const skill=catalog.find(s=>s.id===id);if(!skill)throw new Error('技能不存在');settings.compatibility ||= {};settings.compatibility[id] ||= {};settings.compatibility[id][agent]=markCompatibility(skill,agent,state,note);await save();return compatibilityFor(skill,settings.compatibility);});
  handle('display',async(id,value)=>{const s=catalog.find(s=>s.id===id);if(!s)throw new Error('技能不存在');if(value===null)delete settings.displayOverrides[id];else{if(!value||typeof value.title!=='string'||typeof value.description!=='string'||value.title.length>120||value.description.length>3000)throw new Error('中文名称或简介超出长度限制');settings.displayOverrides[id]={title:value.title.trim()||s.name,description:value.description.trim(),tags:Array.isArray(value.tags)?value.tags.filter(t=>typeof t==='string').slice(0,20).map(t=>t.slice(0,40)):[],sourceHash:fingerprint(s)};}await save();return displayFor(s,settings.displayOverrides);});
  handle('appearance',async(fontSize,zoom)=>{if(![12,13,15,17].includes(fontSize)||![90,100,110,125,150].includes(zoom))throw new Error('无效缩放设置');settings.fontSize=fontSize;settings.zoom=zoom;win.webContents.setZoomFactor(zoom/100);resize(panelExpanded);await save();return settings;});
  handle('settings',async patch=>{if(patch.theme&&['graphite','paper','blue','amber'].includes(patch.theme))settings.theme=patch.theme;if(patch.agent&&Object.hasOwn(AGENTS,patch.agent))settings.agent=patch.agent;if(Array.isArray(patch.favorites))settings.favorites=patch.favorites.filter(v=>typeof v==='string');await save();return settings;});
  handle('add-source',async agent=>{if(!Object.hasOwn(AGENTS,agent)&&agent!=='library')throw new Error('未知来源类型');const result=await dialog.showOpenDialog(win,{properties:['openDirectory'],title:'选择包含技能的目录'});if(!result.canceled){const p=result.filePaths[0];if(!settings.sources.some(s=>s.path===p&&s.agent===agent))settings.sources.push({path:p,agent});await save();}return settings;});
  handle('remove-source',async index=>{if(Number.isInteger(index)&&index>=0&&index<settings.sources.length){settings.sources.splice(index,1);await save();}return settings;});
  handle('draft',async(ids,agent,insert)=>{if(!Array.isArray(ids)||ids.length>50)throw new Error('请选择 1–50 个技能');const items=[...new Set(ids)].map(id=>catalog.find(s=>s.id===id));if(items.some(s=>!s))throw new Error('技能已变化，请刷新');const text=invocation(items,agent);if(insert){if(!target)throw new Error('先在目标输入框放置光标，再按 Ctrl+Alt+K 呼出浮窗');const t={...target};if(/powershell|command prompt|命令提示符/i.test(t.title)&&!/(codex|claude|hermes|openclaw)/i.test(t.title))throw new Error('目标似乎是普通终端，请使用复制并确认 Agent 输入框');clipboard.writeText(text);await bridge('paste',t.handle);}else clipboard.writeText(text);settings.usage ||= {};for(const item of items){const entry=settings.usage[item.id] ||= {count:0,agents:{}};entry.count++;entry.agents[agent]=(entry.agents[agent]||0)+1;entry.lastUsed=new Date().toISOString();}await save();return {text,usage:settings.usage};});
  handle('expand',expanded=>resize(!!expanded));
  handle('pin',value=>win.setAlwaysOnTop(!!value));
  handle('minimize',()=>win.minimize());handle('quit',()=>app.quit());
  handle('open-skill',id=>{const s=catalog.find(s=>s.id===id);if(s)shell.showItemInFolder(s.file);});
  handle('ready',()=>{if(process.argv.includes('--smoke-test')){console.log(JSON.stringify({windowLoaded:true,rendererReady:true,skills:catalog.length}));app.quit();}});
  win.webContents.on('render-process-gone',(_,details)=>console.error('renderer stopped:',details.reason));
  await win.loadFile(path.join(__dirname,'index.html'));
  win.webContents.setZoomFactor(settings.zoom/100);resize(true);
  if(process.argv.includes('--smoke-test')){setTimeout(()=>{console.error('Renderer readiness timeout');app.exit(1);},15000).unref();return;}
  win.show();
  globalShortcut.register('Control+Alt+K',async()=>{await capture();win.show();win.focus();});
});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>globalShortcut.unregisterAll());
