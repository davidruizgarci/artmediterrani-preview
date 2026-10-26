import { mkdir, readdir, cp, writeFile, appendFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Source is public. No source workflow, package, or script is executed.
const source = 'artmediterrani/artmediterrani.github.io';
const base = 'https://davidruizgarci.github.io/artmediterrani-preview-pr-2/';
const headers = { 'User-Agent': 'ArtMediterrani-Review-Previews', Accept: 'application/vnd.github+json' };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
const branches = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.github.com/repos/${source}/branches?per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`Cannot list public source branches: ${response.status}`);
  const batch = await response.json();
  branches.push(...batch);
  if (batch.length < 100) break;
}
const entries = branches.map(branch => {
  const slug = branch.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 65);
  const suffix = createHash('sha256').update(branch.name).digest('hex').slice(0, 8);
  return { branch: branch.name, sha: branch.commit.sha, path: `previews/${slug}-${suffix}/` };
}).sort((a, b) => a.branch.localeCompare(b.branch));
const manifest = { source, branches: entries };
let unchanged = false;
if (process.env.FORCE_PREVIEW !== 'true') {
  const previous = await fetch(`${base}previews.json`, { cache: 'no-store' });
  if (previous.ok) unchanged = JSON.stringify(await previous.json()) === JSON.stringify(manifest);
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${!unchanged}\n`);
if (unchanged) { console.log('Published previews already match all source commits.'); process.exit(0); }

async function copyStatic(from, to) {
  await mkdir(to, { recursive: true });
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (item.isFile() && /\.(html|css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?|pdf)$/i.test(item.name)) {
      await cp(join(from, item.name), join(to, item.name));
    } else if (item.isDirectory() && ['assets', 'es', 'en', 'fr'].includes(item.name)) {
      await copyStatic(join(from, item.name), join(to, item.name));
    }
  }
}

await rm('dist', { recursive: true, force: true });
// Keep the original PR #2 preview URL working at the site root.
await copyStatic('.', 'dist');
await writeFile('dist/.nojekyll', '');
const temporary = await mkdtemp(join(tmpdir(), 'artmediterrani-review-'));
try {
  for (const entry of entries) {
    if (!/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error('Unexpected source commit');
    const checkout = join(temporary, entry.sha);
    await mkdir(checkout, { recursive: true });
    const git = args => execFileSync('git', args, { cwd: checkout, stdio: 'pipe' });
    git(['init', '-q']);
    git(['fetch', '--depth=1', `https://github.com/${source}.git`, entry.sha]);
    git(['checkout', '--detach', '-q', 'FETCH_HEAD']);
    const destination = join('dist', entry.path);
    await copyStatic(checkout, destination);
    await writeFile(join(destination, 'preview.json'), JSON.stringify({ source, ...entry }, null, 2));
    console.log(`${entry.branch}: ${base}${entry.path} (${entry.sha})`);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
await mkdir('dist/previews', { recursive: true });
await writeFile('dist/previews/index.html', `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Vistas previas · Art Mediterrani</title><style>body{font:18px system-ui;max-width:900px;margin:60px auto;padding:24px;background:#f7f3e9;color:#082d50}li{margin:24px 0}a{color:#082d50}small{display:block;margin-top:8px;overflow-wrap:anywhere}</style><h1>Art Mediterrani · Vistas previas</h1><p>Copias para revisar. La web oficial solo cambia al fusionar un PR aprobado por David.</p><p>Las actualizaciones se comprueban cada diez minutos; GitHub puede retrasar las ejecuciones. Verifica siempre el commit antes de revisar.</p><ul>${entries.map(entry => `<li><a href="../${entry.path}es/">${escapeHtml(entry.branch)}</a> · <a href="../${entry.path}es/la-carte.html">Menú y talleres</a><small>Commit: ${entry.sha} · <a href="../${entry.path}preview.json">Comprobar versión</a></small></li>`).join('')}</ul></html>`);
await writeFile('dist/previews.json', JSON.stringify(manifest));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Vistas previas\n\n[Índice de revisión](${base}previews/)\n\n${entries.map(entry => `- [${entry.branch}](${base}${entry.path}es/): \`${entry.sha}\``).join('\n')}\n`);
