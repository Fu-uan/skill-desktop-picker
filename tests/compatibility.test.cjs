const {test}=require('node:test');const assert=require('node:assert/strict');
const {compatibilityFor,markCompatibility}=require('../src/compatibility.cjs');
const skill={id:'one',name:'demo',description:'test',body:'instructions',agents:['codex']};
test('installation never establishes agent compatibility',()=>assert.equal(compatibilityFor(skill).codex.state,'unknown'));
test('manual support remains scoped to chosen agent and records its basis',()=>{const records={one:{claude:markCompatibility(skill,'claude','supported','本人使用过')}};const result=compatibilityFor(skill,records);assert.equal(result.claude.state,'supported');assert.equal(result.claude.basis,'手动标记');assert.equal(result.codex.state,'unknown');});
test('changed skill instructions invalidate support labels',()=>{const records={one:{codex:markCompatibility(skill,'codex','supported')}};assert.equal(compatibilityFor({...skill,body:'changed'},records).codex.state,'unknown');});
test('unknown agents and fabricated evidence are rejected',()=>{assert.throws(()=>markCompatibility(skill,'fake','supported'));assert.throws(()=>markCompatibility(skill,'codex','tested'));assert.equal(markCompatibility(skill,'deepseekharness','unknown').state,'unknown');});
