const {contextBridge}=require('electron');
const sample={id:'sample',name:'example-skill',description:'A sample skill for checking the install flow.',category:'开发',agents:['codex'],sources:['C:/Example/skills'],display:{title:'示例技能',description:'用于检查技能列表、独立管理页面和安装结果。'},compatibility:{}};
let installed=false,cancelled=false;
contextBridge.exposeInMainWorld('picker',{
  load:async()=>({settings:{theme:'graphite',agent:'codex',favorites:[],sources:[{agent:'codex',path:'C:/Example/skills'},{agent:'claude',path:'C:/Example/claude/skills'}]},items:[{...sample,installation:installed?{agent:'codex',files:2}:undefined}],errors:[],sourceReports:[{exists:true,count:1},{exists:false,count:0}]}),
  ready:async()=>{},settings:async patch=>({theme:'graphite',agent:'codex',favorites:[],...patch}),
  importTarget:async agent=>({directory:agent==='other'?null:'C:/Example/'+agent+'/skills',custom:false}),
  importPreview:async()=>{cancelled=false;await new Promise(resolve=>setTimeout(resolve,200));if(cancelled)throw new Error('已取消下载');return{token:'preview',skills:[{path:'SKILL.md',label:'example-skill'}]};},
  importCancel:async()=>{cancelled=true;},onImportProgress:()=>{},
  importInspect:async()=>({name:sample.name,description:sample.description,files:[{path:'SKILL.md'},{path:'scripts/run.js'}]}),
  importInstall:async()=>{installed=true;return{name:sample.name,files:2,directory:'C:/Example/codex/skills/example-skill',notice:'安装文件已校验。请重新打开目标 Agent 会话后调用。'};},
  importDestination:async()=>{},importLocal:async()=>null,expand:async()=>{},pin:async()=>{},minimize:async()=>{},quit:async()=>{},draft:async()=>({usage:{}}),
});
