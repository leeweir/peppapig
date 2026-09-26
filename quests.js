export const QUESTS = [
  {
    id: 'holiday-plan',
    title: '假期计划',
    description: '走到家门前，和猪妈妈商量今天的假期安排。',
    character: '猪妈妈',
    dialogue: ['今天的假期，由你带着大家一起出发！', '先来和我聊聊，再回家找好出门要用的东西。'],
    objectives: [
      { key: 'talk:mom', label: '走近猪妈妈，交谈 1 次', total: 1, targets: ['mom'] },
    ],
  },
  {
    id: 'packing',
    title: '出发前的准备',
    description: '从黄色入户门进家，一楼拿雨靴，再沿楼梯去阁楼的佩奇房间拿相机。',
    character: '猪妈妈',
    dialogue: ['雨靴让小脚放心玩，相机把开心留下来。', '雨靴在一楼门厅，相机在阁楼。靠近楼梯按 E 或点互动，就能上下楼啦！'],
    objectives: [
      { key: 'collect:boots', label: '在一楼门厅拿起 1 双雨靴', total: 1, targets: ['boots'] },
      { key: 'collect:camera', label: '去阁楼的佩奇房间拿相机', total: 1, targets: ['camera'] },
    ],
  },
  {
    id: 'dinosaur',
    title: '乔治的小恐龙',
    description: '去花园附近找到小恐龙，再亲手交还给乔治。',
    character: '乔治',
    dialogue: ['恐龙！我的小恐龙躲到哪里去了？', '找到它以后，带回来给我看看，好吗？'],
    objectives: [
      { key: 'collect:dinosaur', label: '在花园附近找回 1 只小恐龙', total: 1, targets: ['dinosaur'] },
      { key: 'return:dinosaur', label: '走回乔治身边，交还小恐龙 1 次', total: 1, targets: ['george'] },
    ],
  },
  {
    id: 'garden',
    title: '花园醒来啦',
    description: '走进爷爷的花园，分别给三丛小花浇水。',
    character: '猪爷爷',
    dialogue: ['小花也想喝一口清凉的水。', '每一丛都照顾到，花园就会笑起来！'],
    objectives: [
      { key: 'water:flower', label: '走近 3 丛小花，分别浇水', total: 3, targets: ['flower-1', 'flower-2', 'flower-3'] },
    ],
  },
  {
    id: 'carrots',
    title: '爷爷的菜篮子',
    description: '拔出菜地里的三根胡萝卜，和爷爷聊聊今天的收获。',
    character: '猪爷爷',
    dialogue: ['看看这些绿叶子，下面藏着脆甜的胡萝卜。', '帮我收好三根，再来告诉我你的大发现。'],
    objectives: [
      { key: 'collect:carrot', label: '走进菜地，拔出 3 根胡萝卜', total: 3, targets: ['carrot-1', 'carrot-2', 'carrot-3'] },
      { key: 'talk:grandpa', label: '走近猪爷爷，交谈 1 次', total: 1, targets: ['grandpa'] },
    ],
  },
  {
    id: 'puddles',
    title: '最喜欢的泥坑',
    description: '穿好雨靴，在泥坑里起跳，让三次落地溅起水花。',
    character: '佩奇',
    dialogue: ['这么好的泥坑，可不能只站在旁边看。', '跳起来，再落进去！一、二、三，水花也来度假！'],
    objectives: [
      { key: 'jump:puddle', label: '跳起并落进泥坑 3 次', total: 3, targets: ['puddle'] },
    ],
  },
  {
    id: 'playground',
    title: '游乐场的一天',
    description: '先跟着节奏荡秋千，再从滑梯顶端滑下来。',
    character: '佩奇',
    dialogue: ['坐稳啦！等秋千的提示亮起，再按 Space 推一把。', '成功推动三次以后，去滑梯上感受一次呼呼的风！'],
    objectives: [
      { key: 'ride:swing', label: '荡秋千 1 次：跟随提示按 Space 推动 3 次', total: 1, targets: ['swing'] },
      { key: 'ride:slide', label: '从滑梯顶端滑到底部 1 次', total: 1, targets: ['slide'] },
    ],
  },
  {
    id: 'kite',
    title: '风筝飞起来',
    description: '拿起草地上的风筝，带着飞起来的风筝实际跑过 35 米。',
    character: '猪爸爸',
    dialogue: ['风筝喜欢风，也喜欢跑起来的小脚。', '拿好线轴向前跑，让飞着的风筝陪你跑满三十五米！'],
    objectives: [
      { key: 'collect:kite', label: '走到草地上，拿起 1 只风筝', total: 1, targets: ['kite'] },
      { key: 'fly:kite', label: '带着飞起的风筝实际奔跑 35 米', total: 35, targets: ['kite'] },
    ],
  },
  {
    id: 'road-trip',
    title: '坐上红色小汽车',
    description: '和猪爸爸说好目的地，坐进红色小汽车，亲自开到海边。',
    character: '猪爸爸',
    dialogue: ['下一站是大海！先过来，我们一起看看路线。', '坐进红色小汽车，沿着路开到海边的到达点吧。'],
    objectives: [
      { key: 'talk:dad', label: '走近猪爸爸，交谈 1 次', total: 1, targets: ['dad'] },
      { key: 'drive:beach', label: '上车驾驶，抵达海边到达点 1 次', total: 1, targets: ['car', 'beach-arrival'] },
    ],
  },
  {
    id: 'shells',
    title: '海边的小收藏',
    description: '沿着沙滩散步，把散落在海边的五枚贝壳收进小收藏。',
    character: '乔治',
    dialogue: ['这里有一枚，那边还有一枚！', '我们一起沿着沙滩找，五枚贝壳就像五个小宝贝。'],
    objectives: [
      { key: 'collect:shell', label: '沿沙滩寻找并捡起 5 枚贝壳', total: 5, targets: ['shell-1', 'shell-2', 'shell-3', 'shell-4', 'shell-5'] },
    ],
  },
  {
    id: 'sandcastle',
    title: '我们的沙堡',
    description: '装好三桶沙，送到沙堡旁；每倒入一桶，就修好一部分。',
    character: '猪爸爸',
    dialogue: ['一桶沙做城墙，一桶沙做塔楼，还有一桶做大门。', '把三桶沙送来，一次倒一桶，我们的小城堡就能站起来！'],
    objectives: [
      { key: 'collect:sand', label: '走近沙桶，收集 3 桶沙', total: 3, targets: ['sand-1', 'sand-2', 'sand-3'] },
      { key: 'build:sandcastle', label: '向沙堡倒沙建造 3 次，每次使用 1 桶', total: 3, targets: ['sandcastle'] },
    ],
  },
  {
    id: 'photos',
    title: '把快乐拍下来',
    description: '带上相机，分别到海边和营地的取景点拍一张照片。',
    character: '猪妈妈',
    dialogue: ['贝壳可以带回家，风景可以留在照片里。', '海边拍一张，营地拍一张，给今天做一本小小的回忆册。'],
    objectives: [
      { key: 'photo:beach', label: '走到海边取景点，拍照 1 次', total: 1, targets: ['photo-beach'] },
      { key: 'photo:camp', label: '走到营地取景点，拍照 1 次', total: 1, targets: ['photo-camp'] },
    ],
  },
  {
    id: 'picnic',
    title: '全家人的野餐',
    description: '到营地的野餐垫旁，把食物摆好，邀请全家一起开饭。',
    character: '猪妈妈',
    dialogue: ['玩了这么久，小肚子是不是也在唱歌？', '把好吃的摆到野餐垫上，大家一起分享才最香。'],
    objectives: [
      { key: 'picnic:serve', label: '走到野餐垫旁，摆好食物 1 次', total: 1, targets: ['picnic'] },
    ],
  },
  {
    id: 'starlight',
    title: '完美假期的星空',
    description: '回到家门前点亮三盏小灯笼，再开启属于全家人的烟花时刻。',
    character: '佩奇',
    dialogue: ['今天走了好多地方，也装满了好多快乐！', '把三盏灯笼点亮，再一起看烟花，给假期说一声晚安。'],
    objectives: [
      { key: 'light:lantern', label: '走近 3 盏灯笼，分别点亮', total: 3, targets: ['lantern-1', 'lantern-2', 'lantern-3'] },
      { key: 'finale:fireworks', label: '走到烟花点，开启烟花 1 次', total: 1, targets: ['fireworks'] },
    ],
  },
];

const eventLimits = new Map();
for (const quest of QUESTS) {
  for (const objective of quest.objectives) {
    eventLimits.set(objective.key, Math.max(eventLimits.get(objective.key) ?? 0, objective.total));
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampCount(value, maximum) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, value))
    : 0;
}

function advanceQuests(state) {
  const completed = [];
  while (state.questIndex < QUESTS.length) {
    const quest = QUESTS[state.questIndex];
    if (!quest.objectives.every((objective) => (state.counts[objective.key] ?? 0) >= objective.total)) break;
    state.completed.push(quest.id);
    completed.push(quest.id);
    state.questIndex += 1;
  }
  return completed;
}

export function createQuestState(saved) {
  const state = { version: 1, questIndex: 0, counts: {}, completed: [] };
  if (isRecord(saved) && saved.version === 1 && isRecord(saved.counts)) {
    for (const [key, maximum] of eventLimits) {
      if (!Object.prototype.hasOwnProperty.call(saved.counts, key)) continue;
      const count = clampCount(saved.counts[key], maximum);
      if (count > 0) state.counts[key] = count;
    }
  }
  // Progress is a completed prefix derived only from sanitized historical events.
  advanceQuests(state);
  return state;
}

export function getCurrentQuest(state) {
  if (!isRecord(state) || !Number.isInteger(state.questIndex)) return null;
  return QUESTS[state.questIndex] ?? null;
}

export function getQuestProgress(state) {
  const quest = getCurrentQuest(state);
  if (!quest) return { done: 0, total: 0, objectives: [] };
  const counts = isRecord(state.counts) ? state.counts : {};
  const objectives = quest.objectives.map((objective) => {
    const current = clampCount(counts[objective.key], objective.total);
    return { ...objective, current, done: current >= objective.total };
  });
  return {
    done: objectives.reduce((done, objective) => done + Number(objective.done), 0),
    total: objectives.length,
    objectives,
  };
}

export function recordEvent(state, key, amount = 1) {
  const result = { changed: false, completed: [], allCompleted: state?.questIndex === QUESTS.length };
  if (!isRecord(state) || state.version !== 1 || !isRecord(state.counts)
    || !Array.isArray(state.completed) || !Number.isInteger(state.questIndex)
    || state.questIndex < 0 || state.questIndex > QUESTS.length
    || typeof key !== 'string' || !eventLimits.has(key)
    || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return result;

  const maximum = eventLimits.get(key);
  const previous = clampCount(state.counts[key], maximum);
  const next = Math.min(maximum, previous + amount);
  if (next === previous) return result;

  state.counts[key] = next;
  result.changed = true;
  result.completed = advanceQuests(state);
  result.allCompleted = state.questIndex === QUESTS.length;
  return result;
}
