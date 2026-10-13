const crypto = require('node:crypto');
const AGENTS = {codex:'Codex',claude:'Claude Code',hermes:'Hermes',openclaw:'OpenClaw',deepseekharness:'DeepSeek Harness',other:'其他 AI'};
const fingerprint = s => crypto.createHash('sha256').update(JSON.stringify([s.name,s.description,s.body])).digest('hex');
function compatibilityFor(skill,records={}) {
 const saved=records[skill.id]||{};
 return Object.fromEntries(Object.keys(AGENTS).map(agent=>{
  const record=saved[agent];
  if(!record)return[agent,{state:'unknown',basis:'尚未评估兼容性'}];
  if(record.hash!==fingerprint(skill))return[agent,{state:'unknown',basis:'技能内容已更新，原标记需复核',previous:record.state}];
  return[agent,{state:record.state,basis:'手动标记',note:record.note,date:record.date}];
 }));
}
function markCompatibility(skill,agent,state,note='') {
 if(!Object.hasOwn(AGENTS,agent)||!['supported','unsupported','unknown'].includes(state))throw new Error('无效的兼容性标记');
 if(typeof note!=='string'||note.length>500)throw new Error('说明不得超过 500 字');
 return{state,note:note.trim(),hash:fingerprint(skill),date:new Date().toISOString()};
}
module.exports={AGENTS,compatibilityFor,markCompatibility};
