const importPanel=document.createElement('section');
importPanel.id='import-panel';importPanel.className='workspace-view';importPanel.hidden=true;
$('panel').append(importPanel);
const importHeader=document.createElement('div');importHeader.className='view-heading';
const closeImport=button('← 返回技能',()=>showView('search-view'));
const importTitle=document.createElement('b');importTitle.textContent='添加 Skill';
importHeader.append(closeImport,importTitle);
const importIntro=document.createElement('p');importIntro.textContent='选好来源和目标，程序会自动安装并检查结果。';
const importInput=document.createElement('input');importInput.type='url';importInput.placeholder='粘贴 GitHub 仓库或 Skill 链接';importInput.setAttribute('aria-label','GitHub 技能链接');
const importStatus=document.createElement('p');importStatus.setAttribute('role','status');
const progressClock=document.createElement('span');
const cancelImport=button('取消下载',async()=>{cancelImport.disabled=true;importStatus.textContent='正在取消…';await api.importCancel();});
cancelImport.hidden=true;
const progressBar=document.createElement('div');progressBar.className='import-progress';progressBar.append(importStatus,progressClock,cancelImport);
let previewWaiting=false,previewTimer;
function beginPreview(){previewWaiting=true;cancelImport.hidden=false;cancelImport.disabled=false;const started=Date.now();progressClock.textContent='已用 0 秒';previewTimer=setInterval(()=>{progressClock.textContent='已用 '+Math.floor((Date.now()-started)/1000)+' 秒 · 下载最多等待 20 秒';},1000);}
function endPreview(){previewWaiting=false;clearInterval(previewTimer);progressClock.textContent='';cancelImport.hidden=true;}
function importError(error){return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
api.onImportProgress?.(text=>{if(previewWaiting||uiImportBusy)importStatus.textContent=text;});
const candidateList=document.createElement('div'),skillPreview=document.createElement('div');
candidateList.className='import-candidates';skillPreview.className='import-preview';
const importAgent=document.createElement('select');importAgent.setAttribute('aria-label','安装到哪个 Agent');
for(const [value,label]of [...Object.entries(agentNames),['library','共享技能库（仅收藏）']]){
  const option=document.createElement('option');option.value=value;option.textContent=label;importAgent.append(option);
}
const destinationNote=document.createElement('p');
const advanced=document.createElement('details');advanced.className='import-advanced';
const advancedTitle=document.createElement('summary');advancedTitle.textContent='高级设置 · 安装目录';
const destinationPath=document.createElement('p');advanced.append(advancedTitle,destinationPath);
const resultPanel=document.createElement('div');resultPanel.className='install-result';resultPanel.hidden=true;
let importToken=null,importSelected=false,uiImportBusy=false,importLocal=false,currentDestination=null;
let collection=null;
const selectedPaths=new Set();
const collectionTools=document.createElement('div');collectionTools.className='collection-tools';collectionTools.hidden=true;
const collectionHeading=document.createElement('p');
const suiteLabel=document.createElement('label');suiteLabel.className='suite-option';
const suiteCheckbox=document.createElement('input');suiteCheckbox.type='checkbox';suiteCheckbox.id='create-suite';suiteCheckbox.checked=true;
const suiteText=document.createElement('span');suiteText.textContent='创建统一调用入口 · 本地生成';
suiteLabel.append(suiteCheckbox,suiteText);
const suiteHelp=document.createElement('p');suiteHelp.className='suite-help';
function updateSelection(){
  if(!collection)return;
  importSelected=selectedPaths.size>0;
  suiteCheckbox.disabled=uiImportBusy||selectedPaths.size!==collection.skills.length;
  suiteHelp.textContent=selectedPaths.size===collection.skills.length?'安装后在列表选择入口，继续用「复制指令」调用。':'仅安装完整合集时创建统一入口，避免入口缺少成员。';
  collectionHeading.textContent=collection.repository+' · 技能合集 · 已选 '+selectedPaths.size+'/'+collection.skills.length;
  confirmImport.textContent='安装所选 '+selectedPaths.size+' 项到 '+(agentNames[importAgent.value]||'技能库');
}
const selectAll=button('全选',()=>{for(const s of collection.skills)selectedPaths.add(s.path);syncChoices();});
const selectNone=button('取消全选',()=>{selectedPaths.clear();syncChoices();});
function syncChoices(){for(const input of candidateList.querySelectorAll('input'))input.checked=selectedPaths.has(input.value);controlsBusy(false);}
collectionTools.append(collectionHeading,selectAll,selectNone,suiteLabel,suiteHelp);
function controlsBusy(value){
  uiImportBusy=value;
  for(const control of [parseImport,localImport,closeImport,importInput,importAgent,chooseImportFolder])control.disabled=value;
  for(const control of candidateList.querySelectorAll('button,input'))control.disabled=value;
  selectAll.disabled=value;selectNone.disabled=value;
  updateSelection();
  confirmImport.disabled=value||!importSelected||!currentDestination;
}
function clearPreview(){importSelected=false;importToken=null;collection=null;selectedPaths.clear();collectionTools.hidden=true;candidateList.replaceChildren();skillPreview.replaceChildren();resultPanel.hidden=true;sourceBlock.hidden=false;targetBlock.hidden=false;importStatus.textContent='';}
async function refreshDestination(){
  currentDestination=null;
  const target=await api.importTarget(importAgent.value);currentDestination=target.directory;
  destinationPath.textContent=target.directory||'此 Agent 尚未配置技能目录';
  destinationNote.textContent=target.directory?(target.custom?'将安装到你设置的目录。':'已自动选择安装位置，无需手动放置文件。'):'请在高级设置中指定此 Agent 的技能目录，之后会记住。';
  advanced.open=!target.directory;
  confirmImport.textContent=importAgent.value==='library'?'保存到技能库':'安装到 '+agentNames[importAgent.value];
  updateSelection();
}
function showPreview(skill){
  skillPreview.replaceChildren();
  const name=document.createElement('b');name.textContent=skill.name;
  const desc=document.createElement('p');desc.textContent=skill.description;
  const files=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('ul');
  title.textContent=skill.files.length+' 个文件 · 查看内容';
  for(const file of skill.files){const li=document.createElement('li');li.textContent=file.path;list.append(li);}
  files.append(title,list);skillPreview.append(name,desc,files);importSelected=true;
}
async function inspectSkill(skill,choice){
  importSelected=false;skillPreview.replaceChildren();importStatus.textContent='正在检查技能…';
  showPreview(await api.importInspect(importToken,skill.path));
  for(const b of candidateList.children)b.classList.toggle('active',b===choice);
  importStatus.textContent='已识别技能，可以安装。';
}
const parseImport=button('读取链接',async()=>{
  if(uiImportBusy)return;
  clearPreview();importLocal=false;controlsBusy(true);beginPreview();importStatus.textContent='正在连接 GitHub 官方下载…';
  try{
    const preview=await api.importPreview(importInput.value);importToken=preview.token;
    if(preview.skills.length===1){candidateList.hidden=true;await inspectSkill(preview.skills[0],null);}
    else{
      collection=preview;collectionTools.hidden=false;candidateList.hidden=false;suiteCheckbox.checked=true;
      for(const skill of preview.skills){
        selectedPaths.add(skill.path);
        const row=document.createElement('label');row.className='collection-choice';
        const input=document.createElement('input');input.type='checkbox';input.value=skill.path;input.checked=true;input.disabled=true;
        input.onchange=()=>{if(input.checked)selectedPaths.add(skill.path);else selectedPaths.delete(skill.path);controlsBusy(false);};
        const text=document.createElement('span'),name=document.createElement('b'),desc=document.createElement('small');
        name.textContent=skill.label;desc.textContent='正在读取说明…';text.append(name,desc);row.append(input,text);candidateList.append(row);
        try{const details=await api.importInspect(importToken,skill.path);name.textContent=details.display?.title||details.name;desc.textContent=(details.display?.kind==='内置中文导读'?details.display.description:details.description);row.title=details.name+' · '+skill.path;}catch(error){desc.textContent='检查未通过：'+importError(error);}
      }
      importStatus.textContent='已找到整个合集；默认全选，也可以按需勾选。';
    }
  }catch(e){importStatus.textContent=importError(e);}finally{endPreview();controlsBusy(false);}
});
const localImport=button('选择本地 Skill 文件夹',async()=>{
  if(uiImportBusy)return;
  controlsBusy(true);
  try{const preview=await api.importLocal();if(preview){clearPreview();importLocal=true;importToken=preview.token;showPreview(preview);importStatus.textContent='已检查本地技能，点击安装即可自动复制到目标目录。';}}
  catch(e){clearPreview();importStatus.textContent=importError(e);}finally{controlsBusy(false);}
});
const chooseImportFolder=button('更改安装目录',async()=>{
  controlsBusy(true);
  try{await api.importDestination(importAgent.value);await refreshDestination();}
  catch(e){importStatus.textContent=importError(e);}finally{controlsBusy(false);}
});
advanced.append(chooseImportFolder);
const confirmImport=button('安装',async()=>{
  if(uiImportBusy)return;
  const createEntry=!!collection&&suiteCheckbox.checked&&selectedPaths.size===collection.skills.length;
  controlsBusy(true);importStatus.textContent='正在安装并检查文件…';
  try{
    if(collection){
      const result=await api.importBatch(importToken,importAgent.value,[...selectedPaths],createEntry);
      showBatchResult(result);await load();resultPanel.scrollIntoView({block:'nearest'});return;
    }
    const result=await api.importInstall(importToken,importAgent.value,importLocal);
    importSelected=false;importStatus.textContent='';resultPanel.replaceChildren();resultPanel.hidden=false;sourceBlock.hidden=true;targetBlock.hidden=true;
    const title=document.createElement('b');title.textContent=result.name+(result.existing?' · 已加入列表':' · 安装完成');
    const checks=document.createElement('p');checks.textContent=(result.existing?'✓ 已识别本地已有 Skill':'✓ '+result.files+' 个文件校验通过')+'\n✓ SKILL.md 格式正确\n✓ 安装目录可重新扫描';
    const notice=document.createElement('p');notice.textContent=result.notice;
    const location=document.createElement('details'),label=document.createElement('summary'),value=document.createElement('p');
    label.textContent='查看安装位置';value.textContent=result.directory;location.append(label,value);
    const view=button('在技能列表中查看',()=>{category='全部';$('scope').value='all';$('query').value=result.name;render();showView('search-view');},'primary');
    const another=button('继续添加',()=>{clearPreview();controlsBusy(false);importInput.value='';importInput.focus();});
    resultPanel.append(title,checks,notice,location,view,another);
    await load();resultPanel.scrollIntoView({block:'nearest'});
  }catch(e){importStatus.textContent=importError(e);}finally{controlsBusy(false);}
},'primary');confirmImport.disabled=true;confirmImport.id='install-confirm';
function showBatchResult(result){
  importSelected=false;collection=null;selectedPaths.clear();collectionTools.hidden=true;importStatus.textContent='';
  resultPanel.replaceChildren();resultPanel.hidden=false;sourceBlock.hidden=true;targetBlock.hidden=true;
  const failed=result.items.filter(i=>i.status==='failed').length;
  const title=document.createElement('b');title.textContent=failed?'合集安装结束 · '+failed+' 项失败':'合集成员安装完成';
  const list=document.createElement('ul');list.className='batch-results';
  for(const item of result.items){const row=document.createElement('li');row.textContent=item.name+' · '+({installed:'已安装并校验',existing:'已存在，保留本地版本',failed:'失败：'+item.error}[item.status]);list.append(row);}
  const entry=document.createElement('p');entry.textContent=result.entry?('统一入口 · '+({installed:'已创建：'+result.entry.name,existing:'已存在：'+result.entry.name,failed:'创建失败：'+result.entry.error,skipped:result.entry.error}[result.entry.status])):'未创建统一入口。';
  const notice=document.createElement('p');notice.textContent=result.notice;
  const hasEntry=result.entry&&['installed','existing'].includes(result.entry.status);
  const view=button(hasEntry?'查看统一入口并复制指令':'返回技能列表',()=>{category='全部';$('scope').value='all';$('query').value=hasEntry?result.entry.name:'';render();showView('search-view');},'primary');
  const another=button('继续添加',()=>{clearPreview();controlsBusy(false);importInput.focus();});
  resultPanel.append(title,list,entry,notice,view,another);
}
importAgent.onchange=async()=>{controlsBusy(true);try{await refreshDestination();}catch(e){importStatus.textContent=importError(e);}finally{controlsBusy(false);}};
const sourceBlock=document.createElement('div');sourceBlock.className='install-block';
const sourceLabel=document.createElement('b');sourceLabel.textContent='1 · 选择来源';
const linkRow=document.createElement('div');linkRow.className='import-link-row';linkRow.append(importInput,parseImport);
const localAlternative=document.createElement('details');localAlternative.className='local-alternative';
const localTitle=document.createElement('summary');localTitle.textContent='或：从本地文件夹导入（无需填写链接）';localAlternative.append(localTitle,localImport);
sourceBlock.append(sourceLabel,linkRow,localAlternative,collectionTools,candidateList,skillPreview);
const targetBlock=document.createElement('div');targetBlock.className='install-block';
const installTargetLabel=document.createElement('label');installTargetLabel.textContent='2 · 安装到';installTargetLabel.append(importAgent);
targetBlock.append(installTargetLabel,destinationNote,advanced,confirmImport);
importPanel.append(importHeader,importIntro,progressBar,sourceBlock,targetBlock,resultPanel);
async function openInstaller(){
  showView('import-panel');
  if(!uiImportBusy){importAgent.value=settings.agent||'codex';controlsBusy(true);try{await refreshDestination();}catch(e){importStatus.textContent=importError(e);}finally{controlsBusy(false);}}
  importInput.focus();
}
const openImport=button('+ 添加 Skill',openInstaller,'add-skill');openImport.id='open-import';$('sourcesButton').before(openImport);
$('sourcesButton').textContent='管理来源';$('closeSources').textContent='← 返回技能';
$('sources').querySelector('b').textContent='管理扫描目录';
$('sources').querySelector('p').textContent='这里管理已安装 Skill 的扫描位置。添加新 Skill 请使用「添加 Skill」。取消扫描会保留原文件。';
$('addSource').textContent='添加扫描目录';
document.addEventListener('drop',async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(uiImportBusy)return;
  const raw=e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain');
  const link=raw.split(/\r?\n/).find(line=>line.trim()&&!line.startsWith('#'))?.trim();
  await openInstaller();
  if(link&&/^https:\/\/github\.com\//i.test(link)){importInput.value=link;parseImport.click();}
  else importStatus.textContent='请拖入 GitHub 链接，或点击「选择本地 Skill 文件夹」。';
},true);
