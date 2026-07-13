const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// GitHub backup config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'lulu0144/street-fighter-league';
const GITHUB_BACKUP_PATH = 'state-backup.json'; // file in repo root, NOT gitignored

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
  };
}

// ---- GitHub Backup ----

// Fetch state backup from GitHub (raw file)
async function fetchStateFromGitHub() {
  if (!GITHUB_TOKEN) return null;
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${GITHUB_BACKUP_PATH}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    if (!res.ok) return null;
    return await res.json();
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
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'Render-Deploy' } }
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
          'User-Agent': 'Render-Deploy'
        },
        body: JSON.stringify(body)
      }
    );
    if (putRes.ok) {
      console.log('✅ State backed up to GitHub');
      return true;
    }
    console.error('GitHub push failed:', putRes.status, await putRes.text());
    return false;
  } catch (e) {
    console.error('GitHub push error:', e.message);
    return false;
  }
}

// ---- Data loading (try GitHub first, then local file, then defaults) ----
async function loadData() {
  // 1. Try GitHub backup first (most up-to-date, survives deploys)
  const ghData = await fetchStateFromGitHub();
  if (ghData && ghData.players) {
    console.log('📦 Loaded state from GitHub backup');
    return ghData;
  }

  // 2. Try local data.json (ephemeral — only works within same deploy)
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const local = JSON.parse(raw);
      if (local.players && local.players.length > 0) {
        console.log('💾 Loaded state from local data.json');
        return local;
      }
    }
  } catch (e) {
    console.error('Failed to load local data.json:', e.message);
  }

  // 3. Fallback to defaults (only on very first run)
  console.log('🆕 Using default data (no backup found)');
  return getDefaultData();
}

// ---- Save data ----
function saveLocal(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save data.json:', e.message);
    return false;
  }
}

// Initialize
let STATE = getDefaultData();

(async function init() {
  STATE = await loadData();
  saveLocal(STATE);
  // Also push to GitHub on startup to ensure backup exists
  if (GITHUB_TOKEN) {
    pushStateToGitHub(STATE).catch(() => {});
  }
})();

// ---- API Routes ----

app.get('/api/state', (req, res) => {
  res.json(STATE);
});

app.post('/api/state', async (req, res) => {
  const newState = req.body;
  if (!newState || typeof newState !== 'object') {
    return res.status(400).json({ error: 'Invalid state data' });
  }
  STATE = newState;
  saveLocal(STATE);

  // Async backup to GitHub (fire & forget, don't block response)
  if (GITHUB_TOKEN) {
    pushStateToGitHub(STATE).catch(err => console.error('Backup error:', err));
  }

  res.json({ ok: true, backedUp: !!GITHUB_TOKEN });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', players: STATE.players.length, matches: STATE.matches.length, backup: !!GITHUB_TOKEN });
});

app.get('/ping', (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\u{1F94A} \u706B\u4E4B\u5927\u9B54\u738B \u5DF2\u542F\u52A8 \u2192 http://localhost:${PORT}`);
  console.log(`   GitHub\u5907\u4EFD: ${GITHUB_TOKEN ? '\u2705 \u5DF2\u542F\u7528' : '\u26A0\uFE0F \u672A\u914D\u7F6E'}`);
  console.log(`   \u9009\u624B: ${STATE.players.length} | \u6BD4\u8D5B: ${STATE.matches.length}`);
});
