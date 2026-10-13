const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseSkill, discover, invocation } = require('../src/catalog.cjs');
test('parses multiline YAML and BOM without executing content', () => {
  assert.equal(parseSkill('\uFEFF---\nname: demo\ndescription: >\n  first\n  second\n---\nbody').description, 'first second');
  assert.throws(() => parseSkill('no metadata'));
});
test('deduplicates sources but preserves agent associations and rejects malformed metadata', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-picker-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, 'good')); await fs.mkdir(path.join(dir, 'bad'));
  await fs.writeFile(path.join(dir, 'good', 'SKILL.md'), '---\nname: demo\ndescription: useful\n---\nhello');
  await fs.writeFile(path.join(dir, 'bad', 'SKILL.md'), 'bad');
  const result = await discover([{path:dir,agent:'codex'},{path:dir,agent:'claude'}]);
  assert.equal(result.items.length, 1); assert.deepEqual(result.items[0].agents, ['codex','claude']); assert.equal(result.errors.length, 2);
});
test('generates agent-specific drafts without inventing combined slash commands', () => {
  assert.equal(invocation([{name:'demo'}], 'claude'), '/demo ');
  assert.match(invocation([{name:'demo'},{name:'other'}], 'claude'), /^请使用/);
  assert.match(invocation([{name:'demo'}], 'codex'), /\$demo/);
  assert.throws(() => invocation([], 'codex'));
});
