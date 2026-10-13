const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('picker',{
 importPreview:link=>ipcRenderer.invoke('import-preview',link),importInspect:(token,p)=>ipcRenderer.invoke('import-inspect',token,p),importTarget:agent=>ipcRenderer.invoke('import-target',agent),importDestination:agent=>ipcRenderer.invoke('import-destination',agent),importLocal:()=>ipcRenderer.invoke('import-local'),importInstall:(token,agent,local)=>ipcRenderer.invoke('import-install',token,agent,local),
 compatibility:(id,agent,state,note)=>ipcRenderer.invoke('compatibility',id,agent,state,note),
 ready:()=>ipcRenderer.invoke('ready'),
 display:(id,value)=>ipcRenderer.invoke('display',id,value),appearance:(font,zoom)=>ipcRenderer.invoke('appearance',font,zoom),
 load:()=>ipcRenderer.invoke('load'), settings:p=>ipcRenderer.invoke('settings',p),
 addSource:a=>ipcRenderer.invoke('add-source',a),removeSource:i=>ipcRenderer.invoke('remove-source',i),
 draft:(ids,a)=>ipcRenderer.invoke('draft',ids,a),expand:v=>ipcRenderer.invoke('expand',v),
 pin:v=>ipcRenderer.invoke('pin',v),minimize:()=>ipcRenderer.invoke('minimize'),quit:()=>ipcRenderer.invoke('quit'),
 openSkill:id=>ipcRenderer.invoke('open-skill',id)
});
