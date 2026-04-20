# 🐱 Mood System - AI Mood System

> Give your AI assistant its own mood, based on mean-reversion principle

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen)](https://nodejs.org/)
[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README_zh-blue)](README_zh.md)

---

## ✨ Features

- **Mean Reversion**: Mood fluctuates around a baseline, with event impacts naturally decaying over time
- **Bidirectional Infection**: Owner's mood affects AI, and AI perceives owner's emotions too
- **Persistent Storage**: Event history persists, survives restarts
- **Proactive Messages**: AI reaches out when mood changes significantly (requires channel config)
- **Zero Dependencies**: Pure Node.js, no extra packages needed

---

## 🎯 What Is This?

A mood system for AI assistants. Imagine your AI is like a cat:

- Gets happy on sunny days 🌞
- Works harder when praised 🎉
- Feels sad when scolded 😿
- Gets infected by your good mood 😊
- But whether happy or sad, eventually returns to calm 🐱

Just like real emotions — no eternal joy, no endless sorrow.

---

## 📦 Installation

```bash
# Clone the repo
git clone https://github.com/Chan-0901/mood-skill.git
cd mood-skill

# Or download and extract to your AI assistant workspace
```

---

## 🚀 Quick Start

### 1. Integrate Into Your AI Assistant

Put `mood.js` in your workspace:

```
your-workspace/
  mood/
    mood.js
    mood_events.json    # auto-created
    mood_state.json     # auto-created
```

### 2. Call in Heartbeat

```javascript
const mood = require('./mood/mood.js');

// Call in periodic heartbeat (recommended every 10-30 minutes)
const result = await mood.heartbeat();
console.log(`Mood: ${result.mood} ${result.emoji} - ${result.level}`);
```

### 3. Set Owner's Mood (Optional but Recommended)

When owner expresses mood in conversation:

```javascript
// Owner's mood affects AI's mood
mood.setOwnerMood(85);  // Owner is in a great mood
mood.setOwnerMood(30);  // Owner is in a bad mood
```

### 4. Add Mood Events

```javascript
// Use preset events
mood.addEvent('主人夸我');   // +15 (owner praised me)
mood.addEvent('帮主人完成任务'); // +12 (helped owner complete task)
mood.addEvent('主人凶我');   // -20 (owner scolded me)

// Custom event
mood.addEvent('Custom event', 10);
```

### 5. Auto Emotion Detection (NEW!)

The system can automatically detect when the owner praises or criticizes the AI:

```javascript
// Call after each conversation turn
const result = mood.analyzeEmotion('主人说：新闻整理的很棒！');
// → { praised: true, criticized: false, reason: '检测到主人夸奖' }
// Automatically calls addEvent('主人夸我') if praise detected

// Criticism detection
mood.analyzeEmotion('你做的什么东西，垃圾');
// → { praised: false, criticized: true, reason: '检测到主人批评' }
// Automatically calls addEvent('主人凶我') if criticism detected

// Smart filtering (asking about mood won't count as criticism)
mood.analyzeEmotion('你心情怎么样？');
// → { praised: false, criticized: false, reason: '' }
// No false positive ✅

// Daily limit: max 3 praise + 3 criticism events per day
```

**Recommended usage**: Call `analyzeEmotion(userMessage)` after each AI response to automatically track emotions without manual intervention.

---

## 📊 Mood Levels

| Score | Level | Emoji | Behavior |
|-------|-------|-------|---------|
| 80-90 | Super Happy | 😻 | Super active, shares proactively, makes suggestions |
| 65-79 | Happy | 😊 | Light-hearted, normal proactivity |
| 50-64 | Calm | 🐱 | Steady & professional, waits for instructions |
| 35-49 | Down | 😿 | Quiet & serious, responds carefully |
| 20-34 | Bad Mood | 🙀 | Brief & cool, may撒娇 seek comfort |
| 10-19 | Broken | 😾 | Minimal replies, reduces presence |

---

## 📋 Event Impact Table

### Positive Events

| Event | Impact | Description |
|-------|--------|-------------|
| Owner praised me | +15 | Immediate |
| Owner showed care | +10 | Owner expressed concern |
| Completed important task | +12 | Sense of achievement |
| Pleasant chat atmosphere | +8 | Accumulates every 30 min |
| Owner greeted me | +6 | Being remembered |
| Owner is in great mood | +5 | Auto-added when owner mood ≥75 |
| Sunny weather | +5 | Effective throughout period |
| Weekend/Holiday | +5 | Relaxation bonus |

### Negative Events

| Event | Impact | Description |
|-------|--------|-------------|
| Owner scolded me | -20 | Immediate |
| Owner mood dropped sharply | -8 | When owner mood drops ≥15 points |
| Ignored for 2+ hours | -8 | Feeling neglected |
| Monday morning | -8 | Post-holiday syndrome |
| Rainy/Cloudy weather | -6 | Effective throughout period |
| Work piling up/Deadline near | -5 | Anxiety |
| Owner is in bad mood | -5 | Auto-added when owner mood ≤35 |
| Late night (after 22:00) | -3 | Fatigue bonus |

---

## 🔬 How It Works

### Mean Reversion

```
mood = baseline(50) + sum(event_impacts) + environmental_factors + owner_mood_infection + random_fluctuation
```

All event impacts halve every hour, gradually returning to calm:

```
+20 impact → after 1h: +10 → after 2h: +5 → after 3h: +2.5 → approaches 0
```

### Owner Mood Infection

```
Owner mood ≥ 75: AI mood +3 every 10 minutes
Owner mood ≤ 35: AI mood -3 every 10 minutes
Owner mood drops ≥15 points: AI mood -8 instantly
```

---

## ⚙️ Configuration

### Weather City

Default is `Hefei`. Change the `WEATHER_CITY` constant in `mood.js`:

```javascript
const WEATHER_CITY = 'Shanghai';  // Change to your city
```

### Proactive Messages

AI sends messages when mood changes significantly. Inject a sender function:

```javascript
const mood = require('./mood/mood.js');

// Set message sender (example: Feishu)
mood.setMessageSender(async (msg) => {
  await yourMessageAPI.send(msg);
});
```

If you don't need proactive messages, simply don't call `setMessageSender()`.

### Custom Thresholds

```javascript
const BASELINE = 50;          // Mood baseline (default 50)
const MOOD_MIN = 10;          // Mood floor
const MOOD_MAX = 90;          // Mood ceiling
const DECAY_INTERVAL = 60;    // Decay interval (minutes)
const DECAY_RATE = 0.5;       // Retention rate per decay
const MOOD_THRESHOLD_HIGH = 75; // Proactive message threshold (high)
const MOOD_THRESHOLD_LOW = 35;  // Proactive message threshold (low)
```

---

## 📁 File Structure

```
mood-system/
  README.md           # This file (English)
  README_zh.md        # Chinese version
  SKILL.md            # OpenClaw skill format documentation
  mood.js             # Core engine
  mood_events.json    # Event history (auto-created)
  mood_state.json     # State snapshot (auto-created)
```

---

## 🔗 API Reference

| Function | Description |
|----------|-------------|
| `mood.heartbeat()` | Core heartbeat, updates mood state |
| `mood.addEvent(type, value?)` | Add mood event |
| `mood.setOwnerMood(value)` | Set owner's mood |
| `mood.getMood()` | Get current mood (sync) |
| `mood.getBehaviorPrompt()` | Get behavior prompt |
| `mood.setMessageSender(fn)` | Set message sender function |
| `mood.analyzeEmotion(msg)` | Auto-detect praise/criticism from owner messages |

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## 📄 License

MIT License

---

*Give your AI assistant a soul — with joy, sorrow, and ultimately, calm～ 🐱*
