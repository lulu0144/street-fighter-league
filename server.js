const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Parse JSON body
app.use(express.json({ limit: '10mb' }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// ---- Default data ----
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
    seasons: [
      { id:'s1', name:'2026夏季赛', startDate:'2026-07-01', endDate:'2026-09-30', status:'active' }
    ],
    currentSeasonId: 's1',
  };
}

// ---- Load data ----
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load data.json, using defaults:', e.message);
  }
  return getDefaultData();
}

// ---- Save data ----
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save data.json:', e.message);
    return false;
  }
}

// Initialize with existing or default data
let STATE = loadData();
saveData(STATE);

// ---- API Routes ----

// Get full state
app.get('/api/state', (req, res) => {
  res.json(STATE);
});

// Save full state (overwrite)
app.post('/api/state', (req, res) => {
  const newState = req.body;
  if (!newState || typeof newState !== 'object') {
    return res.status(400).json({ error: 'Invalid state data' });
  }
  STATE = newState;
  if (saveData(STATE)) {
    res.json({ ok: true });
  } else {
    res.status(500).json({ error: 'Failed to persist data' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', players: STATE.players.length, matches: STATE.matches.length });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🥊 街霸争霸赛平台已启动 → http://localhost:${PORT}`);
  console.log(`   数据文件: ${DATA_FILE}`);
  console.log(`   选手: ${STATE.players.length} | 比赛记录: ${STATE.matches.length}`);
});
