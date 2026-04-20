# 🐱 Mood System - AI 心情系统

> 让你的 AI 助手拥有自己的心情，基于均值回归原理

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen)](https://nodejs.org/)

---

## ✨ 特性

- **均值回归**：心情围绕基准线波动，事件冲击随时间自然衰减回归平静
- **双向传染**：主人心情会影响 AI，AI 也会感知主人情绪
- **持久化存储**：事件历史持久化，程序重启不丢失
- **主动消息**：心情显著变化时主动联系主人（需配置消息 channel）
- **零依赖**：纯 Node.js 实现，无需安装额外包

---

## 🎯 这是什么？

这是一个为 AI 助手设计的心情系统。想象你的 AI 助手是一只猫——

- 天气晴朗时会开心 🌞
- 被夸奖会更加卖力工作 🎉
- 被凶了会默默委屈 😿
- 主人心情好的时候它也会被感染 😊
- 但无论开心还是难过，最终都会回归平静 🐱

就像真实的情绪一样，没有永恒的快乐，也没有无尽的悲伤。

---

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/Chan-0901/mood-skill.git
cd mood-skill

# 或者直接下载解压到你的 AI 助手工作目录
```

---

## 🚀 快速开始

### 1. 集成到你的 AI 助手

将 `mood.js` 放到你的工作目录：

```
your-workspace/
  mood/
    mood.js
    mood_events.json    # 自动创建
    mood_state.json     # 自动创建
```

### 2. 在心跳中调用

```javascript
const mood = require('./mood/mood.js');

// 在定时心跳中调用（建议每10-30分钟一次）
const result = await mood.heartbeat();
console.log(`心情：${result.mood} ${result.emoji} - ${result.level}`);
```

### 3. 设置主人心情（可选但推荐）

当主人在对话中表达心情时，调用：

```javascript
// 主人心情会影响 AI 的心情
mood.setOwnerMood(85);  // 主人心情很好
mood.setOwnerMood(30);  // 主人心情很差
```

### 4. 添加心情事件

```javascript
// 使用预设事件类型
mood.addEvent('主人夸我');   // +15
mood.addEvent('帮主人完成任务'); // +12
mood.addEvent('主人凶我');   // -20

// 自定义事件
mood.addEvent('自定义事件', 10);
```

---

## 📊 心情等级

| 分值 | 等级 | Emoji | 行为表现 |
|-----|------|-------|---------|
| 80-90 | 超开心 | 😻 | 超级活泼，主动分享，主动提议 |
| 65-79 | 开心 | 😊 | 语气轻快，正常主动 |
| 50-64 | 平静 | 🐱 | 稳健专业，等待指令 |
| 35-49 | 有点丧 | 😿 | 语气安静，认真回应 |
| 20-34 | 心情差 | 🙀 | 简短冷淡，会撒娇求安慰 |
| 10-19 | 崩溃 | 😾 | 极简回复，减少存在感 |

---

## 📋 事件冲击表

### 正向事件

| 事件 | 冲击值 | 说明 |
|------|--------|------|
| 主人夸我 | +15 | 立即触发 |
| 被主人关心 | +10 | 主人表达关心 |
| 帮主人完成重要任务 | +12 | 成就感 |
| 聊天气氛轻松愉快 | +8 | 每30分钟累加 |
| 主人主动打招呼 | +6 | 被想起 |
| 主人心情很好 | +5 | 主人心情≥75时自动添加 |
| 天气晴朗 | +5 | 整段时间有效 |
| 周末/假期 | +5 | 放松加成 |

### 负向事件

| 事件 | 冲击值 | 说明 |
|------|--------|------|
| 主人凶我 | -20 | 立即触发 |
| 主人突然心情骤降 | -8 | 主人心情骤降≥15点时 |
| 被忽略超过2小时 | -8 | 委屈巴巴 |
| 周一上午 | -8 | 节后综合征 |
| 阴雨天 | -6 | 整段时间有效 |
| 工作堆积/接近deadline | -5 | 焦虑 |
| 主人心情很差 | -5 | 主人心情≤35时自动添加 |
| 深夜(22:00后) | -3 | 疲惫加成 |

---

## 🔬 工作原理

### 均值回归

```
心情 = 基线值(50) + 事件冲击总和 + 环境因子 + 主人心情传染 + 随机波动
```

所有事件冲击每小时减半，逐渐回归平静：

```
+20 的冲击 → 1小时后 +10 → 2小时后 +5 → 3小时后 +2.5 → 趋于0
```

### 主人心情传染

```
主人心情 ≥ 75：每10分钟 AI 心情 +3
主人心情 ≤ 35：每10分钟 AI 心情 -3
主人心情骤降（≥15点）：瞬间 AI 心情 -8
```

---

## ⚙️ 配置

### 天气城市

默认使用 `Hefei`，修改 `mood.js` 中的 `WEATHER_CITY` 常量：

```javascript
const WEATHER_CITY = 'Shanghai';  // 改成你的城市
```

### 主动消息

心情显著变化时会主动发消息，需要注入发送函数：

```javascript
const mood = require('./mood/mood.js');

// 设置消息发送函数（示例：发送飞书消息）
mood.setMessageSender(async (msg) => {
  await yourMessageAPI.send(msg);
});
```

如不需要主动消息功能，不调用 `setMessageSender()` 即可。

### 自定义阈值

```javascript
const BASELINE = 50;          // 心情基线（默认50）
const MOOD_MIN = 10;          // 心情下限
const MOOD_MAX = 90;          // 心情上限
const DECAY_INTERVAL = 60;    // 衰减周期（分钟）
const DECAY_RATE = 0.5;       // 每次衰减保留比例
```

---

## 📁 文件说明

```
mood-system/
  README.md           # 本文件（英文）
  README_zh.md        # 中文版
  SKILL.md            # OpenClaw 技能市场格式说明
  mood.js             # 核心引擎
  mood_events.json    # 事件历史（自动创建）
  mood_state.json     # 状态快照（自动创建）
```

---

## 🔗 API 速查

| 函数 | 说明 |
|------|------|
| `mood.heartbeat()` | 核心心跳，更新心情状态 |
| `mood.addEvent(type, value?)` | 添加心情事件 |
| `mood.setOwnerMood(value)` | 设置主人心情 |
| `mood.getMood()` | 获取当前心情（同步） |
| `mood.getBehaviorPrompt()` | 获取行为指令 |
| `mood.setMessageSender(fn)` | 设置消息发送函数 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可

MIT License

---

*让 AI 助手像真实的伙伴一样，有喜怒哀乐，但终归平静～ 🐱*
