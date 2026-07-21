const express = require('express');
const path = require('path');

const app = express();

// GitHub backup config (set in Vercel env vars)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'lulu0144/street-fighter-league';
const GITHUB_BACKUP_PATH = 'state-backup.json';

app.use(express.json({ limit: '10mb' }));
// Static files from ../public (since this file is in api/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Default data (only used when ALL sources fail) ----
function getDefaultData() {
  return {
    players: [
      { id:'p1', name:'策划大大', character:'春丽', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p2', name:'程序一哥', character:'隆', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p3', name:'美术大佬', character:'蛛俐', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p4', name:'运营小哥', character:'肯', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p5', name:'测试侠', character:'古烈', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p6', name:'UI小姐姐', character:'嘉米', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p7', name:'后台大佬', character:'桑吉尔夫', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
      { id:'p8', name:'数据分析师', character:'本田', avatar:'', wins:0, losses:0, points:0, joinDate:'2026-07-13' },
    ],
    matches: [],
    challenges: [],
    tournaments: [],
    playoffs: [],
    seasons: [
      { id:'s1', name:'2026夏季赛', startDate:'2026-07-01', endDate:'2026-09-30', status:'active' }
    ],
    currentSeasonId: 's1',
    bettors: [],
    bets: [],
  };
}

// ---- GitHub Backup ----

// Fetch state from GitHub raw (authenticated for private repos, bypasses rate limits)
async function fetchStateFromGitHub() {
  if (!GITHUB_TOKEN) return null;
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_BACKUP_PATH}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    console.error('GitHub fetch failed:', e.message);
    return null;
  }
}

// Push state to GitHub via API
async function pushStateToGitHub(data) {
  if (!GITHUB_TOKEN) return false;
  try {
    const json = JSON.stringify(data, null, 2);
    const content = Buffer.from(json).toString('base64');

    // Get current file SHA (needed for update)
    let sha = null;
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_BACKUP_PATH}`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'Vercel-Deploy' } }
      );
      if (getRes.ok) {
        const info = await getRes.json();
        sha = info.sha;
      }
    } catch (e) {
      // File doesn't exist yet, that's fine
    }

    const body = {
      message: `Auto-backup state (${new Date().toISOString().slice(0,19)})`,
      content,
      branch: 'main'
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_BACKUP_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Deploy'
        },
        body: JSON.stringify(body)
      }
    );
    if (putRes.ok) {
      console.log('✅ State backed up to GitHub');
      return true;
    }
    console.error('GitHub push failed:', putRes.status, await putRes.text().catch(() => ''));
    return false;
  } catch (e) {
    console.error('GitHub push error:', e.message);
    return false;
  }
}

// ---- API Routes ----

// GET state — fetch from GitHub every time (Vercel has no persistent filesystem)
app.get('/api/state', async (req, res) => {
  try {
    // Try GitHub backup first
    const ghData = await fetchStateFromGitHub();
    if (ghData && ghData.players) {
      return res.json(ghData);
    }
  } catch (e) {
    console.error('Load state error:', e.message);
  }
  // Fallback to defaults
  res.json(getDefaultData());
});

// POST state — push to GitHub directly (no local filesystem on Vercel)
app.post('/api/state', async (req, res) => {
  const newState = req.body;
  if (!newState || typeof newState !== 'object') {
    return res.status(400).json({ error: 'Invalid state data' });
  }
  // GUARD: require core fields to be valid before accepting
  if (!Array.isArray(newState.players)) {
    return res.status(400).json({ error: 'Refused: missing players array. Save aborted to protect data.' });
  }

  if (GITHUB_TOKEN) {
    const ok = await pushStateToGitHub(newState);
    if (!ok) {
      return res.status(500).json({ error: 'GitHub backup failed. Please try again.' });
    }
    return res.json({ ok: true, backedUp: true });
  }

  // No token — accept the save but warn
  res.json({ ok: true, backedUp: false, warning: 'No GitHub token configured. Data will be lost on next deploy.' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', backup: !!GITHUB_TOKEN, platform: 'vercel' });
});

app.get('/api/backup-url', (req, res) => {
  if (!GITHUB_TOKEN) return res.json({ url: null });
  res.json({ url: `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_BACKUP_PATH}` });
});

app.get('/ping', (req, res) => {
  res.json({ pong: true, time: new Date().toISOString(), platform: 'vercel' });
});

// Vercel serverless — export the Express app (no app.listen needed)
module.exports = app;
