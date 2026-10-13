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
function controlsBusy(value){
  uiImportBusy=value;
  for(const control of [parseImport,localImport,closeImport,importInput,importAgent,chooseImportFolder])control.disabled=value;
  for(const control of candidateList.querySelectorAll('button'))control.disabled=value;
  confirmImport.disabled=value||!importSelected||!currentDestination;
}
function clearPreview(){importSelected=false;importToken=null;candidateList.replaceChildren();skillPreview.replaceChildren();resultPanel.hidden=true;sourceBlock.hidden=false;targetBlock.hidden=false;importStatus.textContent='';}
async function refreshDestination(){
  currentDestination=null;
  const target=await api.importTarget(importAgent.value);currentDestination=target.directory;
  destinationPath.textContent=target.directory||'此 Agent 尚未配置技能目录';
  destinationNote.textContent=target.directory?(target.custom?'将安装到你设置的目录。':'已自动选择安装位置，无需手动放置文件。'):'请在高级设置中指定此 Agent 的技能目录，之后会记住。';
  advanced.open=!target.directory;
  confirmImport.textContent=importAgent.value==='library'?'保存到技能库':'安装到 '+agentNames[importAgent.value];
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
  clearPreview();importLocal=false;controlsBusy(true);importStatus.textContent='正在查找 Skill…';
  try{
    const preview=await api.importPreview(importInput.value);importToken=preview.token;
    for(const skill of preview.skills){
      const choice=button(skill.label,async()=>{controlsBusy(true);try{await inspectSkill(skill,choice);}catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}});
      candidateList.append(choice);
    }
    if(preview.skills.length===1){candidateList.hidden=true;await inspectSkill(preview.skills[0],candidateList.firstElementChild);}
    else{candidateList.hidden=false;importStatus.textContent='找到 '+preview.skills.length+' 个 Skill，请选择要安装的一个。';}
  }catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}
});
const localImport=button('选择本地 Skill 文件夹',async()=>{
  if(uiImportBusy)return;
  controlsBusy(true);
  try{const preview=await api.importLocal();if(preview){clearPreview();importLocal=true;importToken=preview.token;showPreview(preview);importStatus.textContent='已检查本地技能，点击安装即可自动复制到目标目录。';}}
  catch(e){clearPreview();importStatus.textContent=e.message;}finally{controlsBusy(false);}
});
const chooseImportFolder=button('更改安装目录',async()=>{
  controlsBusy(true);
  try{await api.importDestination(importAgent.value);await refreshDestination();}
  catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}
});
advanced.append(chooseImportFolder);
const confirmImport=button('安装',async()=>{
  if(uiImportBusy)return;
  controlsBusy(true);importStatus.textContent='正在安装并检查文件…';
  try{
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
  }catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}
},'primary');confirmImport.disabled=true;
importAgent.onchange=async()=>{controlsBusy(true);try{await refreshDestination();}catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}};
const sourceBlock=document.createElement('div');sourceBlock.className='install-block';
const sourceLabel=document.createElement('b');sourceLabel.textContent='1 · 选择来源';
const linkRow=document.createElement('div');linkRow.className='import-link-row';linkRow.append(importInput,parseImport);
sourceBlock.append(sourceLabel,linkRow,localImport,candidateList,skillPreview);
const targetBlock=document.createElement('div');targetBlock.className='install-block';
const installTargetLabel=document.createElement('label');installTargetLabel.textContent='2 · 安装到';installTargetLabel.append(importAgent);
targetBlock.append(installTargetLabel,destinationNote,advanced,confirmImport);
importPanel.append(importHeader,importIntro,sourceBlock,targetBlock,importStatus,resultPanel);
async function openInstaller(){
  showView('import-panel');
  if(!uiImportBusy){importAgent.value=settings.agent||'codex';controlsBusy(true);try{await refreshDestination();}catch(e){importStatus.textContent=e.message;}finally{controlsBusy(false);}}
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
