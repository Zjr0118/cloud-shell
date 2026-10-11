const express = require('express');
const path = require('path');

const OWNER = 'Zjr0118';
const REPO = 'cloud-shell';
// 从环境变量读取 GitHub PAT（不要把 token 写进代码/仓库）
const PAT = process.env.GH_PAT;
const API = 'https://api.github.com';

if (!PAT) {
  console.error('❌ 缺少 GH_PAT 环境变量。启动前请先 export GH_PAT=你的token');
  process.exit(1);
}

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const auth = { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github.v3+json' };

// 触发云端 runner 执行命令
app.post('/trigger', async (req, res) => {
  const cmd = (req.body && req.body.cmd || '').trim();
  if (!cmd) return res.json({ ok: false, err: '命令不能为空' });
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}/dispatches`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'cloud-shell', client_payload: { cmd } })
    });
    if (!r.ok) {
      const e = await r.text();
      return res.json({ ok: false, err: `dispatch 失败 HTTP ${r.status}: ${e}` });
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, err: e.message });
  }
});

// 查询最近一次 cloud-shell 运行的进度
app.get('/status', async (req, res) => {
  try {
    const r = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/runs?event=repository_dispatch&per_page=1`, { headers: auth });
    const d = await r.json();
    if (!d.workflow_runs || d.workflow_runs.length === 0) return res.json({ found: false });
    const run = d.workflow_runs[0];
    res.json({ found: true, id: run.id, status: run.status, conclusion: run.conclusion || null });
  } catch (e) {
    res.json({ found: false, err: e.message });
  }
});

// 下载最近一次运行的 artifact，返回执行结果
app.get('/result', async (req, res) => {
  try {
    const runs = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/runs?event=repository_dispatch&per_page=1`, { headers: auth });
    const rd = await runs.json();
    if (!rd.workflow_runs || rd.workflow_runs.length === 0) return res.json({ found: false });
    const run = rd.workflow_runs[0];

    const ar = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts`, { headers: auth });
    const ad = await ar.json();
    const art = (ad.artifacts || []).find(a => a.name === 'cmd-result' && !a.expired);
    if (!art) return res.json({ found: false, status: run.status, msg: '结果尚未生成（runner 还在运行或未产出 artifact）' });

    // 下载 zip
    const zr = await fetch(`${API}/repos/${OWNER}/${REPO}/actions/artifacts/${art.id}/zip`, { headers: auth });
    const buf = Buffer.from(await zr.arrayBuffer());
    // 解压 result.txt
    const { execFileSync } = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    const zip = path.join(dir, 'a.zip');
    fs.writeFileSync(zip, buf);
    execFileSync('unzip', ['-o', zip, '-d', dir]);
    const txt = path.join(dir, 'result.txt');
    const content = fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : '(未找到 result.txt)';
    res.json({ found: true, status: run.status, conclusion: run.conclusion, content });
  } catch (e) {
    res.json({ found: false, err: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 云端 Shell 控制面板: http://127.0.0.1:${PORT}`);
  console.log(`   仓库: ${OWNER}/${REPO}  (macos-14 runner)`);
  console.log('   ⚠️ 仅本地使用；命令在 GitHub 云端执行，请勿向公网暴露此面板');
});
