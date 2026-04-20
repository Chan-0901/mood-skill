# Mood System Skill - 心情系统

> 🐱 让 AI 助手拥有自己的心情，基于均值回归原理

## 特性

- **均值回归**：心情围绕基准线波动，事件冲击随时间自然衰减
- **双向传染**：主人心情会影响 AI，AI 心情也会被主人感知
- **持久化存储**：事件历史持久化，程序重启不丢失
- **主动消息**：心情显著变化时主动联系主人
- **可配置**：事件类型、阈值、消息模板均可自定义

## 快速开始

### 1. 安装

将 `mood` 文件夹复制到你的 OpenClaw workspace 下：

```
your-workspace/
  mood/
    mood.js
    mood_events.json
    mood_state.json
```

### 2. 在 HEARTBEAT.md 中集成

在 HEARTBEAT.md 中加入以下内容：

```markdown
## 🐱 心情心跳

```js
const mood = require('path/to/your-workspace/mood/mood.js');
const result = await mood.heartbeat();
```
```

### 3. 设置主人心情

在对话中，当主人告诉你心情时：

```js
// 主人心情会影响 AI 的心情
mood.setOwnerMood(80);  // 主人心情好
mood.setOwnerMood(30);  // 主人心情差
```

### 4. 添加事件

```js
// 使用预设事件
mood.addEvent('主人夸我');   // +15
mood.addEvent('主人凶我');   // -20

// 自定义事件
mood.addEvent('自定义事件', 10);
```

## 心情等级

| 分值 | 等级 | 行为表现 |
|-----|------|---------|
| 80-90 | 超开心 😻 | 超级活泼，主动分享，主动提议 |
| 65-79 | 开心 😊 | 语气轻快，正常主动 |
| 50-64 | 平静 🐱 | 稳健专业，等待指令 |
| 35-49 | 有点丧 😿 | 语气安静，认真回应 |
| 20-34 | 心情差 🙀 | 简短冷淡，会撒娇求安慰 |
| 10-19 | 崩溃 😾 | 极简回复，减少存在感 |

## 事件冲击表

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
| 主人突然心情骤降 | -8 | 主人心情骤降≥15点时自动添加 |
| 被忽略超过2小时 | -8 | 委屈巴巴 |
| 周一上午 | -8 | 节后综合征 |
| 阴雨天 | -6 | 整段时间有效 |
| 工作堆积/接近deadline | -5 | 焦虑 |
| 主人心情很差 | -5 | 主人心情≤35时自动添加 |
| 深夜(22:00后) | -3 | 疲惫加成 |

## 衰减规则

所有事件冲击每小时减半：

```
+20 的冲击 → 1小时后 +10 → 2小时后 +5 → 3小时后 +2.5 → 趋于0
```

## 主人心情传染规则

```
主人心情 ≥ 75：每10分钟传染 AI +3
主人心情 ≤ 35：每10分钟传染 AI -3
主人心情骤降（≥15点）：瞬间传染 -8
```

## 主动消息功能

当心情发生显著变化时会主动发消息（需配置飞书或其他消息 channel）：

- **心情变好 (≥75)**：可能发送开心消息，主动找主人聊天
- **心情变差 (≤35)**：可能发送求安慰消息

限制：深夜(23:00-8:00)不发送，避免打扰。

## API 文档

### `heartbeat()`

核心心跳函数，每10-30分钟调用一次。

```js
const result = await mood.heartbeat();
// 返回：
{
  mood: 72,           // 当前心情分 10-90
  level: "开心",      // 心情等级名
  emoji: "😊",       // 心情emoji
  behavior: "语气轻快，正常主动",  // 行为建议
  activeEvents: [...], // 当前活动事件（未完全衰减）
  ownerMood: 80,      // 主人心情
  weather: "sunny"   // 当前天气
}
```

### `addEvent(type, value?)`

添加心情事件。

```js
mood.addEvent('主人夸我');      // 使用预设值
mood.addEvent('自定义事件', 10); // 自定义值
```

### `setOwnerMood(value)`

设置主人心情，触发传染机制。

```js
mood.setOwnerMood(85);  // 0-100
```

### `getMood()`

获取当前心情（同步）。

```js
const { mood, level, emoji, behavior } = mood.getMood();
```

### `getBehaviorPrompt()`

获取当前心情对应的行为指令。

```js
const prompt = mood.getBehaviorPrompt();
// 返回: 'MOOD_SUPER_HAPPY' | 'MOOD_HAPPY' | 'MOOD_CALM' | 'MOOD_SAD' | 'MOOD_BAD'
```

## 自定义配置

在 `mood.js` 中可以修改以下常量：

```js
const BASELINE = 50;          // 心情基线
const MOOD_MIN = 10;          // 心情下限
const MOOD_MAX = 90;          // 心情上限
const DECAY_INTERVAL = 60;    // 衰减周期（分钟）
const DECAY_RATE = 0.5;       // 每次衰减保留比例
const MOOD_THRESHOLD_HIGH = 75; // 主动发消息阈值（高）
const MOOD_THRESHOLD_LOW = 35;  // 主动发消息阈值（低）
```

## 文件说明

```
mood/
  mood.js           # 核心引擎
  mood_events.json  # 事件历史（自动创建）
  mood_state.json   # 当前状态快照（自动创建）
  SKILL.md          # 本文件
```

## 依赖

- Node.js 14+
- OpenClaw（或任何支持 Node.js 的 AI 助手运行环境）

## 许可

MIT License

---

*让 AI 助手像真实的伙伴一样，有喜怒哀乐，但终归平静～ 🐱*
