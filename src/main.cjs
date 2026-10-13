const { app, BrowserWindow, ipcMain, dialog, clipboard, globalShortcut, screen, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const { discover, invocation } = require('./catalog.cjs');
let win, settings, catalog = [], target = null, busy = false, timer;
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
function resize(expanded){const height=expanded?650:76; const work=screen.getDisplayMatching(win.getBounds()).workArea; win.setSize(430,Math.min(height,work.height-24));const b=win.getBounds();win.setPosition(Math.max(work.x,Math.min(b.x,work.x+work.width-b.width)),Math.max(work.y,Math.min(b.y,work.y+work.height-b.height)));}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(event.sender!==win.webContents)throw new Error('Invalid sender');return fn(...args);});}
app.whenReady().then(async()=>{
  try{settings=JSON.parse(await fs.readFile(storePath(),'utf8'));}catch{settings={sources:defaultSources(),theme:'graphite',favorites:[],agent:'codex'};}
  win=new BrowserWindow({width:430,height:650,frame:false,transparent:true,alwaysOnTop:true,resizable:false,show:false,title:'Skill Desktop Picker',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  handle('load',async()=>{const result=await discover(settings.sources);catalog=result.items;return{settings,items:catalog,errors:result.errors,target};});
  handle('settings',async patch=>{if(patch.theme&&['graphite','paper','blue','amber'].includes(patch.theme))settings.theme=patch.theme;if(patch.agent&&['codex','claude','hermes','openclaw','other'].includes(patch.agent))settings.agent=patch.agent;if(Array.isArray(patch.favorites))settings.favorites=patch.favorites.filter(v=>typeof v==='string');await save();return settings;});
  handle('add-source',async agent=>{if(!['codex','claude','hermes','openclaw','library'].includes(agent))throw new Error('未知来源类型');const result=await dialog.showOpenDialog(win,{properties:['openDirectory'],title:'选择包含技能的目录'});if(!result.canceled){const p=result.filePaths[0];if(!settings.sources.some(s=>s.path===p&&s.agent===agent))settings.sources.push({path:p,agent});await save();}return settings;});
  handle('remove-source',async index=>{if(Number.isInteger(index)&&index>=0&&index<settings.sources.length){settings.sources.splice(index,1);await save();}return settings;});
  handle('draft',async(ids,agent,insert)=>{if(!Array.isArray(ids)||ids.length>50)throw new Error('请选择 1–50 个技能');const items=ids.map(id=>catalog.find(s=>s.id===id));if(items.some(s=>!s))throw new Error('技能已变化，请刷新');const text=invocation(items,agent);if(insert){if(!target)throw new Error('先在目标输入框放置光标，再按 Ctrl+Alt+K 呼出浮窗');const t={...target};if(/powershell|command prompt|命令提示符/i.test(t.title)&&!/(codex|claude|hermes|openclaw)/i.test(t.title))throw new Error('目标似乎是普通终端，请使用复制并确认 Agent 输入框');clipboard.writeText(text);await bridge('paste',t.handle);}else clipboard.writeText(text);return text;});
  handle('expand',expanded=>resize(!!expanded));
  handle('pin',value=>win.setAlwaysOnTop(!!value));
  handle('minimize',()=>win.minimize());handle('quit',()=>app.quit());
  handle('open-skill',id=>{const s=catalog.find(s=>s.id===id);if(s)shell.showItemInFolder(s.file);});
  win.webContents.on('render-process-gone',(_,details)=>console.error('renderer stopped:',details.reason));
  await win.loadFile(path.join(__dirname,'index.html'));
  if(process.argv.includes('--smoke-test')){const result=await discover(settings.sources);console.log(JSON.stringify({windowLoaded:true,skills:result.items.length,metadataErrors:result.errors.length}));app.quit();return;}
  win.show();
  globalShortcut.register('Control+Alt+K',async()=>{await capture();win.show();win.focus();});
  timer=setInterval(()=>{if(!win.isFocused())capture();},2000);timer.unref();
});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{clearInterval(timer);globalShortcut.unregisterAll();});
