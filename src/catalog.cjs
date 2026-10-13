const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');

function parseSkill(text) {
  const match = text.replace(/^\uFEFF/, '').match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('缺少 YAML frontmatter');
  const meta = YAML.parse(match[1]);
  if (!meta || typeof meta.name !== 'string' || typeof meta.description !== 'string' || !meta.name.trim() || !meta.description.trim()) throw new Error('缺少 name 或 description');
  return { name: meta.name.trim(), description: meta.description.trim(), body: text.slice(match[0].length).trim() };
}
function categoryFor(skill) {
  const n = skill.name.toLowerCase();
  if (/lark|calendar|mail|document|spreadsheet|slides|presentation/.test(n)) return '办公';
  if (/econ|nature|paper|citation|scipilot|research/.test(n)) return '学术';
  if (/search|browse/.test(n)) return '检索';
  if (/design|figma|image|pet|visual/.test(n)) return '设计';
  if (/debug|test|git|code|develop|plan|review|plugin/.test(n)) return '开发';
  return '其他';
}
async function discover(sources) {
  const items = new Map(), errors = [];
  for (const source of sources) {
    const seen = new Set();
    async function walk(dir, depth) {
      if (depth > 12 || seen.size > 10000) return;
      let real;
      try { real = await fs.realpath(dir); } catch { return; }
      if (seen.has(real)) return;
      seen.add(real);
      const file = path.join(real, 'SKILL.md');
      try {
        const stat = await fs.stat(file);
        if (stat.size > 1024 * 1024) throw new Error('SKILL.md 超过 1 MB');
        const parsed = parseSkill(await fs.readFile(file, 'utf8'));
        const id = crypto.createHash('sha256').update(real).digest('hex').slice(0, 20);
        if (!items.has(id)) items.set(id, { id, ...parsed, category: categoryFor(parsed), directory: real, file, agents: [], sources: [] });
        const item = items.get(id);
        if (source.agent && source.agent !== 'library' && !item.agents.includes(source.agent)) item.agents.push(source.agent);
        if (!item.sources.includes(source.path)) item.sources.push(source.path);
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') { errors.push({ path: file, message: error.message }); return; }
      }
      let children;
      try { children = await fs.readdir(real, { withFileTypes: true }); } catch { return; }
      for (const entry of children) {
        if (['node_modules', '.git', 'dist', 'scripts', 'assets', 'references'].includes(entry.name)) continue;
        if (entry.isDirectory() || entry.isSymbolicLink()) await walk(path.join(real, entry.name), depth + 1);
      }
    }
    await walk(source.path, 0);
  }
  return { items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name)), errors };
}
function invocation(items, agent) {
  if (!items.length) throw new Error('请先选择技能');
  const names = items.map(s => s.name);
  if (agent === 'codex') return `请使用 ${names.map(n => '$' + n).join('、')} 完成本次任务。如果技能不可用，请先说明。`;
  if (agent === 'claude' && names.length === 1 && /^[a-z0-9][a-z0-9:_-]*$/i.test(names[0])) return '/' + names[0] + ' ';
  return `请使用已安装的 ${names.join('、')} 技能完成本次任务；若技能或依赖不可用，请先说明。`;
}
module.exports = { parseSkill, categoryFor, discover, invocation };
