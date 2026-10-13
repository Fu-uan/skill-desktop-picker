const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseSkill, discover } = require('./catalog.cjs');
const { safeRelative } = require('./github-import.cjs');

function destinationFor(agent, settings, home, library, env = process.env) {
  const defaults = {
    codex: path.join(home, '.codex', 'skills'),
    claude: path.join(home, '.claude', 'skills'),
    hermes: path.join(env.HERMES_HOME || path.join(home, '.hermes'), 'skills'),
    openclaw: path.join(home, '.openclaw', 'skills'),
    library,
    deepseekharness: null,
    other: null,
  };
  if (!Object.hasOwn(defaults, agent)) throw new Error('未知目标 Agent');
  const custom = settings.installDirectories?.[agent];
  return { agent, directory: custom || defaults[agent], custom: !!custom };
}

async function verifyInstalled(directory, name) {
  const metadata = parseSkill(await fs.readFile(path.join(directory, 'SKILL.md'), 'utf8'));
  if (metadata.name !== name) throw new Error('安装后的技能名称不一致');
  const scan = await discover([{ path: directory, agent: 'library' }]);
  if (scan.errors.length || !scan.items.some(item => item.name === name)) throw new Error('安装目录无法重新扫描，请检查 SKILL.md');
  return { metadata: true, indexed: true, runtime: 'unverified' };
}

function createLocalImporter() {
  let plan;
  async function preview(directory) {
    plan = null;
    const root = await fs.realpath(directory);
    let metadata;
    try { metadata = parseSkill(await fs.readFile(path.join(root, 'SKILL.md'), 'utf8')); }
    catch (error) { throw new Error('请选择直接包含有效 SKILL.md 的技能文件夹：' + error.message); }
    safeRelative(metadata.name);
    if (metadata.name.includes('/')) throw new Error('技能名称不能包含路径');
    const files = [], seen = new Set();
    let total = 0;
    async function walk(relative = '') {
      for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
        const file = relative ? relative + '/' + entry.name : entry.name;
        safeRelative(file);
        if (entry.isSymbolicLink()) throw new Error('本地技能包含链接，请选择不含链接的技能文件夹');
        if (['.git', '.env', 'node_modules'].includes(entry.name.toLowerCase())) throw new Error('技能包含 .git、.env 或 node_modules，请选择独立技能文件夹');
        if (entry.isDirectory()) { await walk(file); continue; }
        if (!entry.isFile()) throw new Error('不支持的技能文件类型');
        if (seen.has(file.toLowerCase())) throw new Error('文件名存在大小写冲突');
        seen.add(file.toLowerCase());
        const stat = await fs.stat(path.join(root, file));
        if (stat.size > 3 * 1024 * 1024 || files.length >= 200) throw new Error('技能超过文件限制（200 个文件，每个 3 MB）');
        total += stat.size;
        if (total > 20 * 1024 * 1024) throw new Error('技能包超过 20 MB');
        files.push({ path: file, bytes: await fs.readFile(path.join(root, file)) });
      }
    }
    await walk();
    const token = crypto.randomUUID();
    plan = { token, metadata, files, created: Date.now() };
    return { token, name: metadata.name, description: metadata.description, files: files.map(f => ({ path: f.path, size: f.bytes.length })), bytes: total };
  }
  async function install(token, parent) {
    if (!plan || plan.token !== token || Date.now() - plan.created > 30 * 60 * 1000) throw new Error('本地预览已过期，请重新选择文件夹');
    const selected = plan;
    const base = await fs.realpath(parent), directory = path.join(base, selected.metadata.name);
    try { await fs.mkdir(directory); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('同名目录已存在，未覆盖。可返回技能列表查找已安装的技能。'); throw error; }
    try {
      for (const file of selected.files) {
        const destination = path.join(directory, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.bytes, { flag: 'wx' });
        if (!(await fs.readFile(destination)).equals(file.bytes)) throw new Error('写入后文件校验失败');
      }
      const verification = await verifyInstalled(directory, selected.metadata.name);
      plan = null;
      return { directory, name: selected.metadata.name, files: selected.files.length, verification };
    } catch (error) {
      throw new Error('安装未完成，请检查新建目录 ' + directory + '：' + error.message);
    }
  }
  return { preview, install };
}

module.exports = { destinationFor, verifyInstalled, createLocalImporter };
