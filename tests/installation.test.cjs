const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { destinationFor, createLocalImporter, verifyInstalled, installOrIndex } = require('../src/installation.cjs');

test('uses agent defaults, remembers custom destinations and leaves unknown agents unconfigured', () => {
  assert.equal(destinationFor('codex', {}, '/user', '/library', {}).directory, path.join('/user', '.codex', 'skills'));
  assert.equal(destinationFor('hermes', {}, '/user', '/library', { HERMES_HOME: '/custom' }).directory, path.join('/custom', 'skills'));
  assert.equal(destinationFor('claude', { installDirectories: { claude: '/chosen' } }, '/user', '/library').directory, '/chosen');
  assert.equal(destinationFor('deepseekharness', {}, '/user', '/library').directory, null);
  assert.throws(() => destinationFor('invalid', {}, '/user', '/library'));
});
test('local install copies support files, preserves source and verifies discovery without overwriting', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-install-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), dest = path.join(root, 'destination');
  await fs.mkdir(path.join(source, 'scripts'), { recursive: true });
  await fs.mkdir(dest);
  const skill = '---\nname: demo\ndescription: test\n---\nUse this skill.';
  await fs.writeFile(path.join(source, 'SKILL.md'), skill);
  await fs.writeFile(path.join(source, 'scripts', 'run.js'), 'throw new Error("never execute");');
  const installer = createLocalImporter(), preview = await installer.preview(source);
  const result = await installer.install(preview.token, dest);
  assert.equal(result.verification.indexed, true);
  assert.equal(result.verification.runtime, 'unverified');
  assert.equal(await fs.readFile(path.join(source, 'SKILL.md'), 'utf8'), skill);
  assert.equal(await fs.readFile(path.join(result.directory, 'scripts', 'run.js'), 'utf8'), 'throw new Error("never execute");');
  const second = await installer.preview(source);
  await assert.rejects(installer.install(second.token, dest), /同名目录/);
  const recovered = await installOrIndex(installer, second.token, dest);
  assert.equal(recovered.existing, true);
  assert.equal(recovered.verification.indexed, true);
  assert.equal(recovered.files, undefined);
  assert.equal(await fs.readFile(path.join(result.directory, 'SKILL.md'), 'utf8'), skill);
  await fs.writeFile(path.join(result.directory, 'SKILL.md'), 'bad');
  await assert.rejects(verifyInstalled(result.directory, 'demo'));
  await assert.rejects(installOrIndex(installer, second.token, dest), /同名目录存在，但技能检查未通过/);
});
test('rejects a parent folder without a directly contained SKILL.md', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-empty-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(createLocalImporter().preview(root), /直接包含有效 SKILL.md/);
});
