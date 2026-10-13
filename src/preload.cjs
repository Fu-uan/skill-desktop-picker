const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('picker',{
 load:()=>ipcRenderer.invoke('load'), settings:p=>ipcRenderer.invoke('settings',p),
 addSource:a=>ipcRenderer.invoke('add-source',a),removeSource:i=>ipcRenderer.invoke('remove-source',i),
 draft:(ids,a,insert)=>ipcRenderer.invoke('draft',ids,a,insert),expand:v=>ipcRenderer.invoke('expand',v),
 pin:v=>ipcRenderer.invoke('pin',v),minimize:()=>ipcRenderer.invoke('minimize'),quit:()=>ipcRenderer.invoke('quit'),
 openSkill:id=>ipcRenderer.invoke('open-skill',id),onTarget:cb=>ipcRenderer.on('target',(_,t)=>cb(t))
});
