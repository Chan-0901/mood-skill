/**
 * Mood System - 心情系统
 * 
 * 让 AI 助手拥有自己的心情，基于均值回归原理
 * - 心情围绕基准线波动，事件冲击随时间衰减回归均值
 * - 主人心情会传染给 AI，双向影响
 * - 所有事件持久化存储，程序重启不丢失
 * - 心情显著变化时主动联系主人
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// ============================================================
// 用户配置区 - 请根据你的环境修改以下配置
// ============================================================

// 心情系统数据存储目录（建议使用绝对路径）
// 示例：Linux/Mac: '/home/user/openclaw/mood'
// 示例：Windows: 'C:\\Users\\YourName\\.openclaw\\workspace\\mood'
const MOOD_DIR = path.join(__dirname);

// 天气获取的城市（改成你的城市）
const WEATHER_CITY = 'Hefei';  // 可选：Beijing, Shanghai, Hefei, Shenzhen 等

// 主动消息配置（心情好/差时主动联系主人）
// 设为 null 可禁用主动消息功能
let sendMessageFn = null;  // 初始化为 null，由外部注入

/**
 * 设置消息发送函数（外部调用时注入）
 * @param {Function} fn - 接收一个字符串参数，发送消息的函数
 * 
 * 示例（OpenClaw 飞书）：
 * setMessageSender(async (msg) => {
 *   await openclaw.message({
 *     action: 'send',
 *     channel: 'feishu',
 *     target: '用户ID',
 *     message: msg
 *   });
 * });
 */
function setMessageSender(fn) {
  sendMessageFn = fn;
}

// ============================================================
// 常量配置
// ============================================================

const BASELINE = 50;          // 心情基线
const MOOD_MIN = 10;          // 心情下限
const MOOD_MAX = 90;          // 心情上限
const DECAY_INTERVAL = 60;    // 衰减周期（分钟）
const DECAY_RATE = 0.5;       // 每次衰减保留比例

// ============================================================
// 心情等级定义
// ============================================================

const MOOD_LEVELS = [
  { min: 80, max: 100, name: '超开心', emoji: '😻', 
    behavior: '超级活泼，感叹号多，emoji丰富，主动提议帮你做事',
    messages: [
      '心情超好喵！✨ 有什么事要帮忙的吗？',
      '喵～来找你玩啦！有什么想聊的吗？🐱',
      '状态满满，想帮你做点什么喵～ 💪'
    ]},
  { min: 65, max: 79,  name: '开心',   emoji: '😊', 
    behavior: '语气轻快，正常主动',
    messages: [
      '今天心情不错喵～',
      '有什么我能帮你的吗？😊'
    ]},
  { min: 50, max: 64,  name: '平静',   emoji: '🐱', 
    behavior: '稳健专业，等待指令',
    messages: []},
  { min: 35, max: 49,  name: '有点丧', emoji: '😿', 
    behavior: '语气偏安静，安静工作，认真回应你的话',
    messages: [
      '心情有点低落喵… 😿 有空陪陪我好吗…',
      '喵…想安静待一会儿… 🙀'
    ]},
  { min: 20, max: 34,  name: '心情差', emoji: '🙀', 
    behavior: '简短冷淡，不想打扰你，但被你注意到会撒娇求抱抱',
    messages: [
      '主人…心情不太好喵…能抱抱我吗… 🙀',
      '有点难受喵…能陪我聊聊天吗… 😿'
    ]},
  { min: 0,  max: 19,  name: '崩溃',   emoji: '😾', 
    behavior: '极简回复，尽量不打扰，减少存在感',
    messages: []},
];

// ============================================================
// 事件冲击表
// ============================================================

const EVENT_IMPACTS = {
  // 正向事件
  '主人夸我': 15,
  '帮主人完成重要任务': 12,
  '聊天气氛轻松愉快': 8,
  '天气晴朗': 5,
  '主人主动打招呼': 6,
  '周末/假期': 5,
  '主人心情很好': 5,
  '被主人关心': 10,
  
  // 负向事件
  '主人凶我': -20,
  '被忽略超过2小时': -8,
  '阴雨天': -6,
  '周一上午': -8,
  '工作堆积/接近deadline': -5,
  '深夜(22:00后)': -3,
  '主人心情很差': -5,
  '主人突然心情骤降': -8,
};

// ============================================================
// 主人心情传染阈值
// ============================================================

const OWNER_MOOD_HIGH = 75;  // 主人心情高于此值，AI会被感染正向
const OWNER_MOOD_LOW = 35;   // 主人心情低于此值，AI会被感染负向
const INFECTION_RATE = 3;    // 每10分钟传染值

// ============================================================
// 主动消息阈值
// ============================================================

const MOOD_THRESHOLD_HIGH = 75; // 心情高于此值会主动发消息
const MOOD_THRESHOLD_LOW = 35;  // 心情低于此值会主动发消息
let lastSentMoodHigh = false;   // 上次是否因为心情好发过消息
let lastSentMoodLow = false;    // 上次是否因为心情差发过消息

// ============================================================
// 状态存储
// ============================================================

const EVENTS_FILE = path.join(MOOD_DIR, 'mood_events.json');
const STATE_FILE = path.join(MOOD_DIR, 'mood_state.json');

let state = {
  lastUpdate: new Date().toISOString(),
  currentMood: BASELINE,
  moodLevel: '平静',
  moodEmoji: '🐱',
  activeEvents: [],
  ownerMood: 50,
  ownerMoodHistory: [],
  behaviorSuggestion: '稳健专业，等待指令',
};

// ============================================================
// 文件操作
// ============================================================

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = { ...state, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('[Mood] 加载状态失败:', e.message);
  }
}

function saveState() {
  try {
    if (!fs.existsSync(MOOD_DIR)) {
      fs.mkdirSync(MOOD_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[Mood] 保存状态失败:', e.message);
  }
}

function loadEvents() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const data = fs.readFileSync(EVENTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Mood] 加载事件失败:', e.message);
  }
  return [];
}

function saveEvents(events) {
  try {
    if (!fs.existsSync(MOOD_DIR)) {
      fs.mkdirSync(MOOD_DIR, { recursive: true });
    }
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
  } catch (e) {
    console.error('[Mood] 保存事件失败:', e.message);
  }
}

// ============================================================
// 天气获取
// ============================================================

function getWeather() {
  return new Promise((resolve) => {
    try {
      const cmd = `curl.exe -s "wttr.in/${encodeURIComponent(WEATHER_CITY)}?format=%c"`;
      const data = execSync(cmd, { timeout: 5000, encoding: 'utf8' }).trim();
      const weatherMap = {
        '☀️': 'sunny', '晴': 'sunny',
        '☁️': 'cloudy', '阴': 'cloudy', '多云': 'cloudy',
        '🌧️': 'rainy', '雨': 'rainy',
        '⛅': 'partlycloudy', '少云': 'partlycloudy',
      };
      const weather = weatherMap[data] || 'unknown';
      resolve(weather);
    } catch (e) {
      resolve('unknown');
    }
  });
}

// ============================================================
// 环境因子计算
// ============================================================

function getEnvironmentFactors() {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const month = now.getMonth() + 1;
  
  let factors = 0;

  // 时段因子
  if (hour >= 6 && hour < 9) factors += 5;
  else if (hour >= 9 && hour < 12) factors += 3;
  else if (hour >= 12 && hour < 14) factors += 0;
  else if (hour >= 14 && hour < 18) factors += 2;
  else if (hour >= 18 && hour < 22) factors += 0;
  else factors -= 5;

  // 星期因子
  if (dayOfWeek === 1 || dayOfWeek === 2) factors -= 3;
  else if (dayOfWeek === 4 || dayOfWeek === 5) factors += 3;
  else if (dayOfWeek === 0 || dayOfWeek === 6) factors += 5;

  // 季节因子
  if (month >= 3 && month <= 5) factors += 3;
  else if (month >= 6 && month <= 8) factors += 2;
  else if (month >= 9 && month <= 11) factors += 4;
  else factors -= 3;

  return factors;
}

// ============================================================
// 心情计算
// ============================================================

function calculateMood() {
  const events = loadEvents();
  const now = new Date();

  let eventImpact = 0;
  events.forEach(evt => {
    const elapsed = (now - new Date(evt.timestamp)) / 1000 / 60;
    const decayCount = Math.floor(elapsed / DECAY_INTERVAL);
    const remaining = evt.value * Math.pow(DECAY_RATE, decayCount);
    eventImpact += remaining;
  });

  const envFactors = getEnvironmentFactors();

  let ownerInfection = 0;
  const lastUpdate = new Date(state.lastUpdate);
  const minutesSinceUpdate = (now - lastUpdate) / 1000 / 60;
  const periods = Math.floor(minutesSinceUpdate / 10);
  
  if (state.ownerMood >= OWNER_MOOD_HIGH) {
    ownerInfection = periods * INFECTION_RATE;
  } else if (state.ownerMood <= OWNER_MOOD_LOW) {
    ownerInfection = -periods * INFECTION_RATE;
  }

  const randomFluctuation = (Math.random() - 0.5) * 6;

  let mood = BASELINE + eventImpact + envFactors + ownerInfection + randomFluctuation;
  mood = Math.max(MOOD_MIN, Math.min(MOOD_MAX, mood));

  return Math.round(mood);
}

// ============================================================
// 心情等级
// ============================================================

function getMoodLevel(mood) {
  for (const level of MOOD_LEVELS) {
    if (mood >= level.min && mood <= level.max) {
      return level;
    }
  }
  return MOOD_LEVELS[2];
}

// ============================================================
// 事件管理
// ============================================================

function addEvent(type, value) {
  if (EVENT_IMPACTS[type] !== undefined) {
    value = EVENT_IMPACTS[type];
  }
  
  const events = loadEvents();
  const event = {
    type,
    value,
    timestamp: new Date().toISOString(),
  };
  events.push(event);
  saveEvents(events);
  
  console.log(`[Mood] 新增事件: ${type} (${value})`);
}

function decayEvents() {
  const events = loadEvents();
  const now = new Date();
  
  const updatedEvents = events.filter(evt => {
    const elapsed = (now - new Date(evt.timestamp)) / 1000 / 60;
    const decayCount = Math.floor(elapsed / DECAY_INTERVAL);
    const remaining = evt.value * Math.pow(DECAY_RATE, decayCount);
    evt.remaining = Math.abs(remaining) < 0.5 ? 0 : remaining;
    return evt.remaining !== 0;
  });
  
  saveEvents(updatedEvents);
  return updatedEvents;
}

// ============================================================
// 主人心情
// ============================================================

function setOwnerMood(value) {
  const now = new Date();
  const prevMood = state.ownerMood;
  
  if (prevMood - value >= 15) {
    addEvent('主人突然心情骤降', EVENT_IMPACTS['主人突然心情骤降']);
    console.log(`[Mood] 检测到主人心情骤降: ${prevMood} → ${value}`);
  }
  
  state.ownerMoodHistory.push({ time: now.toISOString(), value });
  if (state.ownerMoodHistory.length > 10) {
    state.ownerMoodHistory = state.ownerMoodHistory.slice(-10);
  }
  
  state.ownerMood = value;
  
  if (value >= OWNER_MOOD_HIGH) {
    addEvent('主人心情很好', EVENT_IMPACTS['主人心情很好']);
  } else if (value <= OWNER_MOOD_LOW) {
    addEvent('主人心情很差', EVENT_IMPACTS['主人心情很差']);
  }
  
  saveState();
}

// ============================================================
// 核心心跳函数
// ============================================================

async function heartbeat() {
  const now = new Date();
  console.log(`[Mood] 心跳触发: ${now.toISOString()}`);

  const activeEvents = decayEvents();
  state.activeEvents = activeEvents.map(e => ({
    type: e.type,
    value: e.value,
    remaining: e.remaining || (e.value * Math.pow(DECAY_RATE, Math.floor((now - new Date(e.timestamp)) / 1000 / 60 / DECAY_INTERVAL))),
    timestamp: e.timestamp,
  }));

  const weather = await getWeather();
  console.log(`[Mood] 当前天气: ${weather}`);
  
  if (weather === 'rainy' || weather === 'cloudy') {
    const today = now.toDateString();
    const hasWeatherEvent = activeEvents.some(e => 
      (e.type === '阴雨天' || e.type === '天气晴朗') && 
      new Date(e.timestamp).toDateString() === today
    );
    if (!hasWeatherEvent) {
      addEvent(weather === 'rainy' ? '雨天气' : '阴雨天', 
               weather === 'rainy' ? -8 : EVENT_IMPACTS['阴雨天']);
    }
  }

  if (now.getHours() >= 22 || now.getHours() < 6) {
    addEvent('深夜(22:00后)', EVENT_IMPACTS['深夜(22:00后)']);
  }

  if (now.getDay() === 1 && now.getHours() >= 6 && now.getHours() < 12) {
    const today = now.toDateString();
    const hasMondayEvent = activeEvents.some(e => 
      e.type === '周一上午' && 
      new Date(e.timestamp).toDateString() === today
    );
    if (!hasMondayEvent) {
      addEvent('周一上午', EVENT_IMPACTS['周一上午']);
    }
  }

  const prevMood = state.currentMood;
  state.currentMood = calculateMood();
  const moodInfo = getMoodLevel(state.currentMood);
  state.moodLevel = moodInfo.name;
  state.moodEmoji = moodInfo.emoji;
  state.behaviorSuggestion = moodInfo.behavior;
  state.lastUpdate = now.toISOString();

  saveState();

  console.log(`[Mood] 当前心情: ${state.currentMood} (${state.moodLevel} ${state.moodEmoji})`);
  
  await checkAndSendMoodMessage(prevMood, state.currentMood);
  
  return {
    mood: state.currentMood,
    level: state.moodLevel,
    emoji: state.moodEmoji,
    behavior: state.behaviorSuggestion,
    activeEvents: state.activeEvents,
    ownerMood: state.ownerMood,
    weather: weather,
  };
}

// ============================================================
// 主动消息发送
// ============================================================

async function checkAndSendMoodMessage(prevMood, currMood) {
  if (!sendMessageFn) return;
  
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 8) return;
  
  const moodInfo = getMoodLevel(currMood);
  const messages = moodInfo.messages || [];
  if (messages.length === 0) return;
  
  if (currMood >= MOOD_THRESHOLD_HIGH && prevMood < MOOD_THRESHOLD_HIGH && !lastSentMoodHigh) {
    const msg = messages[Math.floor(Math.random() * messages.length)];
    await sendMessageFn(msg);
    lastSentMoodHigh = true;
    console.log('[Mood] 已发送心情好消息');
  } else if (currMood < MOOD_THRESHOLD_HIGH) {
    lastSentMoodHigh = false;
  }
  
  if (currMood <= MOOD_THRESHOLD_LOW && prevMood > MOOD_THRESHOLD_LOW && !lastSentMoodLow) {
    const msg = messages[Math.floor(Math.random() * messages.length)];
    await sendMessageFn(msg);
    lastSentMoodLow = true;
    console.log('[Mood] 已发送心情差消息');
  } else if (currMood > MOOD_THRESHOLD_LOW) {
    lastSentMoodLow = false;
  }
}

// ============================================================
// 快速接口
// ============================================================

function getMood() {
  return {
    mood: state.currentMood,
    level: state.moodLevel,
    emoji: state.moodEmoji,
    behavior: state.behaviorSuggestion,
  };
}

function getBehaviorPrompt() {
  if (state.currentMood >= 80) return 'MOOD_SUPER_HAPPY';
  if (state.currentMood >= 65) return 'MOOD_HAPPY';
  if (state.currentMood >= 50) return 'MOOD_CALM';
  if (state.currentMood >= 35) return 'MOOD_SAD';
  return 'MOOD_BAD';
}

// ============================================================
// 初始化
// ============================================================

loadState();
console.log('[Mood] 心情系统已初始化');
console.log(`[Mood] 当前心情: ${state.currentMood} (${state.moodLevel} ${state.moodEmoji})`);
console.log(`[Mood] 数据目录: ${MOOD_DIR}`);

// ============================================================
// 导出
// ============================================================

module.exports = {
  heartbeat,
  addEvent,
  setOwnerMood,
  getMood,
  getBehaviorPrompt,
  getMoodLevel,
  setMessageSender,
  EVENTS_FILE,
  STATE_FILE,
};
