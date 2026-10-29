// =======================================================================
// ===               EPhone 游戏大厅 (Game Hall) 脚本                  ===
// =======================================================================
// 此文件包含了所有与游戏大厅及其内部游戏相关的功能，
// 与主聊天、动态、设置等功能完全分离。

document.addEventListener('DOMContentLoaded', () => {
  const LUDO_BOARD_SIZE = 42; // 总格子数，可以根据你的棋盘布局调整

  // ▼▼▼ 游戏状态管理器 ▼▼▼
  // ▼▼▼ 【全新】这是狼人杀游戏的状态管理器 ▼▼▼
  let werewolfGameState = {
    isActive: false, // 游戏是否正在进行
    players: [], // 玩家列表 { id, name, avatar, role, isAlive, persona }
    roles: {}, // 角色配置 { wolf: 2, villager: 2, ... }
    gamePhase: 'setup', // 游戏阶段: setup, night, day_discussion, day_vote, etc.
    dayNumber: 0, // 天数
    gameLog: [], // 游戏日志
    turnIndex: 0, // 当前发言/行动的玩家索引
    votes: {}, // 投票记录
    seerLastNightResult: null, // 预言家昨晚查验结果
    witchPotions: { save: 1, poison: 1 }, // 女巫药剂
    hunterTarget: null, // 猎人目标
    lastNightKilled: [], // 昨晚被杀的玩家ID
    waitingFor: null, // 当前等待谁的行动: 'seer', 'witch_save', 'witch_poison', 'hunter', 'user_vote'
    gameConfig: {}, // 游戏配置
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 【全局修复】获取所有通用模态框的DOM元素，并声明一个全局的Promise解决器 ▼▼▼
  // （请将此代码块粘贴到所有 gameState 变量定义的正下方）
  let modalOverlay,
    modalConfirmBtn,
    modalCancelBtn,
    modalResolve = null;
  // 假设你的通用模态框ID是 'custom-modal-overlay'
  // 如果不是，请修改成你HTML里正确的ID
  modalOverlay = document.getElementById('custom-modal-overlay');
  modalConfirmBtn = document.getElementById('custom-modal-confirm');
  modalCancelBtn = document.getElementById('custom-modal-cancel');

  // ▲▲▲ 全局修复代码结束 ▲▲▲

  // ▼▼▼ 【全新】这是海龟汤游戏的状态管理器 ▼▼▼
  let seaTurtleSoupState = {
    isActive: false, // 游戏是否正在进行
    phase: 'setup', // 游戏阶段: setup, guessing, reveal
    players: [], // 玩家列表 { id, name, avatar, persona, isUser, isProvider }
    riddleProvider: null, // 出题人对象
    riddle: '', // 谜面
    answer: '', // 谜底
    gameLog: [], // 游戏日志
    currentTurnIndex: 0, // 当前轮到谁行动的索引
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀游戏的状态管理器 ▼▼▼
  let scriptKillGameState = {
    isActive: false, // 游戏是否正在进行
    script: null, // 当前加载的剧本对象
    players: [], // 玩家列表 { id, name, avatar, role, isUser, evidence, persona }
    gamePhase: 'setup', // 游戏阶段: setup, introduction, evidence, discussion, voting, end
    turnIndex: 0, // 当前行动的玩家索引
    gameLog: [], // 游戏日志
    evidenceCounts: {}, // 记录每个玩家已搜证次数
    votes: {}, // 投票记录
    is自由选择: false, // 是否为自由选择角色模式
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
  let guessWhatGameState = {
    isActive: false, // 游戏是否正在进行
    mode: 'ai_guesses', // 游戏模式: 'ai_guesses' 或 'user_guesses'
    opponent: null, // 对手玩家对象 { id, name, avatar, persona }
    secretWord: '', // 谜底词语
    gameLog: [], // 游戏日志
    currentTurn: 'user', // 当前轮到谁: 'user' 或 'ai'
  };
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  // ▼▼▼ 在这里粘贴下面这一整块新代码 ▼▼▼

  let ludoGameState = {
    isActive: false,
    opponent: null,
    players: [], // { id, name, avatar, piecePosition: -1 (at home), isUser }
    currentTurnIndex: 0,
    gameLog: [],
    boardLayout: [],
    isDiceRolling: false,
  };
  // ▼▼▼ 用这块【功能增强版】的代码，替换旧的 undercoverGameState ▼▼▼
  let undercoverGameState = {
    isActive: false,
    players: [],
    civilianWord: '',
    undercoverWord: '',
    gamePhase: 'setup',
    dayNumber: 1, // 【核心修改1】将初始轮次改为 1，更符合游戏逻辑
    gameLog: [],
    turnIndex: 0,
    votes: {},
    votedOutPlayers: [], // 【核心修改2】新增此行，用于记录每轮被投出去的玩家
    tiedPlayers: [],
  };
  // ▲▲▲ 替换结束 ▲▲▲
  // ...（上面是 undercoverGameState 的定义）...

  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】万能Markdown渲染函数 (带安全过滤和遮挡效果) ▼▼▼
  function addLongPressListener(element, callback) {
    let pressTimer;
    const startPress = e => {
      if (isSelectionMode) return;
      e.preventDefault();
      pressTimer = window.setTimeout(() => callback(e), 500);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    element.addEventListener('mousedown', startPress);
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchstart', startPress, { passive: true });
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress);
  }

  /**
   * 将Markdown文本安全地渲染为HTML
   * @param {string} markdownText - 原始的Markdown文本
   * @returns {string} - 处理和净化后的安全HTML字符串
   */
  function renderMarkdown(markdownText) {
    if (!markdownText) return '';

    // 1. 【预处理】支持自定义的“遮挡/剧透”语法 ||spoiler||
    // 我们在 marked.js 处理之前，手动把 ||text|| 替换成带特定class的HTML标签
    let processedText = markdownText.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler">$1</span>');

    // 2. 【核心】使用 marked.js 将Markdown转换为HTML
    // gfm: true 开启GitHub风格的Markdown，支持删除线等
    // breaks: true 让回车符也能变成<br>，更符合聊天习惯
    let rawHtml = marked.parse(processedText, { gfm: true, breaks: true });

    // 3. 【安全】使用 DOMPurify 清洗HTML，防止XSS攻击
    let sanitizedHtml = DOMPurify.sanitize(rawHtml);

    return sanitizedHtml;
  }

  // ▲▲▲ 新函数粘贴结束 ▲▲▲

  let tempGeneratedScriptData = null;

  // ▼▼▼ 游戏功能函数 ▼▼▼

  // --- 狼人杀 Werewolf ---
  // ...（后面的代码）...

  // ▼▼▼ 游戏功能函数 ▼▼▼

  // --- 狼人杀 Werewolf ---
  // ▼▼▼ 【全新】这里是狼人杀游戏的所有核心功能函数 ▼▼▼

  /**
   * 【狼人杀】打开游戏设置界面
   */
  async function openWerewolfSetup() {
    showScreen('werewolf-setup-screen');
    const selectionEl = document.getElementById('werewolf-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách nhân vật...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="werewolf-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
    // ▼▼▼ 在这里粘贴下面这块新代码 ▼▼▼
    const inviteModeRadios = document.querySelectorAll('input[name="undercover_invite_mode"]');
    const manualOptions = document.getElementById('undercover-manual-invite-options');
    const randomOptions = document.getElementById('undercover-random-invite-options');

    inviteModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'manual') {
          manualOptions.style.display = 'block';
          randomOptions.style.display = 'none';
        } else {
          // random mode
          manualOptions.style.display = 'none'; // 隐藏手动列表
          randomOptions.style.display = 'block'; // 显示随机选项
        }
      });
    });

    // 默认触发一次，以确保初始状态正确
    document.querySelector('input[name="undercover_invite_mode"]:checked').dispatchEvent(new Event('change'));
    // ▲▲▲ 粘贴结束 ▲▲▲
  }

  /**
   * 【狼人杀】开始游戏的核心逻辑
   */
  async function startWerewolfGame() {
    const countSelect = document.getElementById('werewolf-player-count');
    const totalPlayers = parseInt(countSelect.value);

    const selectedCheckboxes = document.querySelectorAll('.werewolf-player-checkbox:checked');
    // 邀请的AI/NPC数量必须是总人数-1（因为User是必须加入的）
    if (selectedCheckboxes.length !== totalPlayers - 1) {
      alert(`Vui lòng chọn ${totalPlayers - 1} người chơi AI hoặc NPC!`);
      return;
    }

    // --- 1. 重置并初始化游戏状态 ---
    werewolfGameState = {
      isActive: true,
      players: [],
      roles: {},
      gamePhase: 'start',
      dayNumber: 0,
      gameLog: [],
      turnIndex: 0,
      votes: {},
      seerLastNightResult: null,
      witchPotions: { save: 1, poison: 1 },
      hunterTarget: null,
      lastNightKilled: [],
      waitingFor: null,
      gameConfig: { totalPlayers },
    };

    // --- 2. 收集玩家信息 ---
    // 添加User
    werewolfGameState.players.push({
      id: 'user',
      name: state.qzoneSettings.nickname || 'Tôi',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isAlive: true,
      isUser: true, // 标记为真实用户
    });

    // 添加被邀请的AI和NPC
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        // 是主要角色
        werewolfGameState.players.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isAlive: true,
          isUser: false,
        });
      } else {
        // 是NPC
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            werewolfGameState.players.push({
              id: npc.id,
              name: npc.name,
              avatar: npc.avatar,
              persona: npc.persona,
              isAlive: true,
              isUser: false,
            });
            break;
          }
        }
      }
    });

    // 打乱玩家顺序（座位顺序）
    werewolfGameState.players.sort(() => Math.random() - 0.5);

    // --- 3. 根据人数分配角色 ---
    const roleConfigs = {
      6: { wolf: 2, villager: 2, seer: 1, guard: 1 },
      9: { wolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1 },
      12: { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, idiot: 1 },
    };
    // ▼▼▼ 【核心Bug修复】用这块代码替换上面的错误代码 ▼▼▼
    const rolesToAssign = [];
    const config = roleConfigs[totalPlayers];
    werewolfGameState.roles = config; // 将角色配置存入游戏状态
    for (const role in config) {
      for (let i = 0; i < config[role]; i++) {
        // 修正：config[i] -> config[role]
        rolesToAssign.push(role);
      }
    }
    // ▲▲▲ 修复结束 ▲▲▲
    rolesToAssign.sort(() => Math.random() - 0.5); // 打乱角色

    werewolfGameState.players.forEach((player, index) => {
      player.role = rolesToAssign[index];
    });
    // ▼▼▼ 在这里添加下面的新代码 ▼▼▼
    // ▼▼▼ 第1处修改（添加翻译）▼▼▼
    const roleNameMap = {
      wolf: 'Sói',
      villager: 'Dân làng',
      seer: 'Tiên tri',
      witch: 'Phù thủy',
      hunter: 'Thợ săn',
      guard: 'Bảo vệ',
      idiot: 'Kẻ ngốc',
    };

    // 弹窗告知用户身份
    const userPlayer = werewolfGameState.players.find(p => p.isUser);
    if (userPlayer) {
      const myRoleName = roleNameMap[userPlayer.role] || userPlayer.role;
      await showCustomAlert('Vai trò của bạn', `Vai trò của bạn trong ván này là: 【${myRoleName}】`);
    }
    // ▲▲▲ 修改结束 ▲▲▲
    // --- 4. 切换到游戏界面并开始游戏循环 ---
    showScreen('werewolf-game-screen');
    await processGameTurn();
  }

  // ▼▼▼ 用这【一整块】全新的游戏引擎代码，替换旧的 processGameTurn 函数 ▼▼▼
  /**
   * 【狼人杀 V2】游戏主循环/引擎
   */
  async function processGameTurn() {
    if (!werewolfGameState.isActive) return;

    renderWerewolfGameScreen();

    switch (werewolfGameState.gamePhase) {
      case 'start':
        logToWerewolfGame('Trò chơi bắt đầu, đang chia vai...');
        const roleNameMapForLog = {
          wolf: 'Sói',
          villager: 'Dân làng',
          seer: 'Tiên tri',
          witch: 'Phù thủy',
          hunter: 'Thợ săn',
          guard: 'Bảo vệ',
          idiot: 'Kẻ ngốc',
        };
        const configText = Object.entries(werewolfGameState.roles)
          .map(([role, count]) => `${roleNameMapForLog[role] || role}x${count}`)
          .join(', ');
        logToWerewolfGame(`Cấu hình ván: ${configText}`);
        werewolfGameState.gamePhase = 'night_start';
        await sleep(3000);
        await processGameTurn();
        break;

      case 'night_start':
        werewolfGameState.dayNumber++;
        werewolfGameState.lastNightKilled = [];
        werewolfGameState.votes = {};
        logToWerewolfGame(`Ngày thứ ${werewolfGameState.dayNumber}, trời tối rồi, mọi người nhắm mắt.`);
        werewolfGameState.gamePhase = 'guard_action'; // 从守卫开始
        await sleep(2000);
        await processGameTurn();
        break;

      // 【守卫行动阶段】
      case 'guard_action':
        const guard = werewolfGameState.players.find(p => p.role === 'guard' && p.isAlive);
        if (guard) {
          logToWerewolfGame('Bảo vệ mở mắt, hãy chọn người chơi bạn muốn bảo vệ.');
          let protectedId;
          // ★★★ 核心检查点1：判断守卫是不是User ★★★
          if (guard.isUser) {
            // 如果是，就调用waitForUserAction，这会弹出操作框
            protectedId = await waitForUserAction('Hãy chọn người chơi bạn muốn bảo vệ', 'guard_protect');
          } else {
            // 如果不是，就让AI自己决策
            protectedId = await triggerWerewolfAiAction(guard.id, 'guard_protect');
          }
          werewolfGameState.guardLastNightProtected = protectedId;
          logToWerewolfGame(`Bảo vệ nhắm mắt.`);
        }
        werewolfGameState.gamePhase = 'wolf_action';
        await sleep(2000);
        await processGameTurn();
        break;

      // ▼▼▼ 用这块【狼人频道增强+平票处理版】的代码替换旧的 'wolf_action' case ▼▼▼
      case 'wolf_action':
        logToWerewolfGame('Sói mở mắt, hãy chọn một mục tiêu.');
        const wolves = werewolfGameState.players.filter(p => p.role === 'wolf' && p.isAlive);
        const userPlayer = wolves.find(w => w.isUser);
        let allWolfVotes = [];

        // 场景1: 用户是狼人
        if (userPlayer) {
          const aiWolves = wolves.filter(w => !w.isUser);
          let suggestionsText = '🐺 Kênh Sói (bí mật):\n';

          if (aiWolves.length > 0) {
            // 从AI队友获取建议
            const aiVotePromises = aiWolves.map(wolf =>
              triggerWerewolfAiAction(wolf.id, 'wolf_kill', { isUserWolfAlly: true }),
            );
            const aiVotes = (await Promise.all(aiVotePromises)).filter(Boolean);
            allWolfVotes.push(...aiVotes);

            // 格式化建议给用户看
            aiVotes.forEach((targetId, index) => {
              const votingWolf = aiWolves[index];
              const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
              if (votingWolf && targetPlayer) {
                suggestionsText += `- ${votingWolf.name} đề nghị giết: ${targetPlayer.name}\n`;
              }
            });
            suggestionsText += '\nHãy tham khảo ý kiến đồng đội rồi bỏ phiếu.';

            await showCustomAlert('Sói hãy trao đổi', suggestionsText);
          } else {
            await showCustomAlert('Bạn là con sói duy nhất', 'Hãy tự quyết định mục tiêu đêm nay.');
          }

          // 获取用户的最终投票
          const userVote = await waitForUserAction('Hãy chọn mục tiêu tấn công cuối cùng', 'wolf_kill');
          if (userVote) {
            allWolfVotes.push(userVote);
          }
        } else {
          // 场景2: 用户不是狼人，AI狼人自行决定
          const wolfPromises = wolves.map(wolf => triggerWerewolfAiAction(wolf.id, 'wolf_kill'));
          const wolfVotes = (await Promise.all(wolfPromises)).filter(Boolean);
          allWolfVotes.push(...wolfVotes);
        }

        // 统计所有狼人的投票
        const voteCounts = {};
        allWolfVotes.forEach(vote => {
          voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        let maxVotes = 0;
        let targetId = null;
        let tied = false;
        for (const id in voteCounts) {
          if (voteCounts[id] > maxVotes) {
            maxVotes = voteCounts[id];
            targetId = id;
            tied = false;
          } else if (voteCounts[id] === maxVotes) {
            tied = true;
          }
        }

        // ★★★ 这就是我们新增的平票处理逻辑！★★★
        if (tied && maxVotes > 0) {
          // 如果出现平票，就从所有平票的目标中随机选择一个
          const tiedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
          targetId = tiedTargets[Math.floor(Math.random() * tiedTargets.length)];
          logToWerewolfGame(
            `(Bầy sói đã thảo luận kịch liệt, cuối cùng quyết định mục tiêu là ${werewolfGameState.players.find(p => p.id === targetId).name})`,
          );
        }

        if (targetId) {
          // 只要有目标（无论是统一意见还是随机决定），就执行击杀
          werewolfGameState.lastNightKilled = [targetId];
          logToWerewolfGame(`Sói nhắm mắt.`);
        } else {
          // 只有在所有狼人都没投票的情况下，才会是平安夜
          logToWerewolfGame(`Bầy sói bỏ hành động, đêm nay không ai bị tấn công.`);
          werewolfGameState.lastNightKilled = [];
        }

        // 进入下一个游戏阶段
        werewolfGameState.gamePhase = 'seer_action';
        await sleep(2000);
        await processGameTurn();
        break;
      // ▲▲▲ 替换结束 ▲▲▲

      // 【预言家行动阶段】
      case 'seer_action':
        const seer = werewolfGameState.players.find(p => p.role === 'seer' && p.isAlive);
        if (seer) {
          logToWerewolfGame('Tiên tri mở mắt, hãy chọn người chơi bạn muốn soi.');
          let targetId;
          // ★★★ 核心检查点3：判断预言家是不是User ★★★
          if (seer.isUser) {
            targetId = await waitForUserAction('Hãy chọn người chơi bạn muốn soi', 'seer_check');
          } else {
            targetId = await triggerWerewolfAiAction(seer.id, 'seer_check');
          }
          const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
          const isWolf = targetPlayer.role === 'wolf';
          werewolfGameState.seerLastNightResult = { targetName: targetPlayer.name, isWolf: isWolf };
          logToWerewolfGame(`Tiên tri nhắm mắt.`);
          if (seer.isUser) {
            await showCustomAlert('Kết quả soi', `Vai trò của ${targetPlayer.name} là: ${isWolf ? 'Sói' : 'Phe tốt'}`);
          }
        }
        werewolfGameState.gamePhase = 'witch_action';
        await sleep(2000);
        await processGameTurn();
        break;

      // 【女巫行动阶段】
      case 'witch_action':
        const witch = werewolfGameState.players.find(p => p.role === 'witch' && p.isAlive);
        if (witch) {
          logToWerewolfGame('Phù thủy mở mắt.');
          const killedId = werewolfGameState.lastNightKilled[0];
          let killedPlayerName = null;
          if (killedId) {
            killedPlayerName = werewolfGameState.players.find(p => p.id === killedId).name;
            logToWerewolfGame(`Đêm nay ${killedPlayerName} đã bị tấn công.`);
          }

          let witchAction;
          // ★★★ 核心检查点4：判断女巫是不是User ★★★
          if (witch.isUser) {
            witchAction = await waitForUserAction('Phù thủy hãy hành động', 'witch_action', { killedId, killedPlayerName });
          } else {
            witchAction = await triggerWerewolfAiAction(witch.id, 'witch_action', { killedId });
          }

          if (witchAction?.action === 'save' && killedId) {
            werewolfGameState.lastNightKilled = [];
            werewolfGameState.witchPotions.save = 0;
          } else if (witchAction?.action === 'poison' && witchAction.targetId) {
            werewolfGameState.lastNightKilled.push(witchAction.targetId);
            werewolfGameState.witchPotions.poison = 0;
          }
        }
        logToWerewolfGame(`Phù thủy nhắm mắt.`);
        werewolfGameState.gamePhase = 'day_start';
        await sleep(2000);
        await processGameTurn();
        break;

      case 'day_start':
        logToWerewolfGame('Trời sáng rồi.');
        let deathAnnouncements = [];
        const deathsThisNight = new Set();

        werewolfGameState.lastNightKilled.forEach(killedId => {
          if (killedId === werewolfGameState.guardLastNightProtected) {
            logToWerewolfGame(
              `Đêm qua ${werewolfGameState.players.find(p => p.id === killedId).name} bị tấn công nhưng đồng thời cũng được bảo vệ.`,
            );
          } else {
            deathsThisNight.add(killedId);
          }
        });

        if (deathsThisNight.size === 0) {
          logToWerewolfGame('Đêm qua là một đêm bình yên.');
        } else {
          deathsThisNight.forEach(deadId => {
            const deadPlayer = werewolfGameState.players.find(p => p.id === deadId);
            if (deadPlayer.isAlive) {
              deadPlayer.isAlive = false;
              deathAnnouncements.push(`${deadPlayer.name} đã bị loại đêm qua.`);
            }
          });
          deathAnnouncements.forEach(announcement => logToWerewolfGame(announcement));
        }

        renderWerewolfGameScreen();
        if (checkGameOver()) return;

        let hunterDied = null;
        deathsThisNight.forEach(deadId => {
          const deadPlayer = werewolfGameState.players.find(p => p.id === deadId);
          if (deadPlayer.role === 'hunter') hunterDied = deadPlayer;
        });

        if (hunterDied) {
          logToWerewolfGame(`${hunterDied.name} là thợ săn, có thể chọn kéo theo một người chơi.`);
          let targetId;
          // ★★★ 核心检查点5：判断猎人是不是User ★★★
          if (hunterDied.isUser) {
            targetId = await waitForUserAction('Hãy chọn người chơi bạn muốn kéo theo', 'hunter_shoot');
          } else {
            targetId = await triggerWerewolfAiAction(hunterDied.id, 'hunter_shoot');
          }
          if (targetId) {
            const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
            targetPlayer.isAlive = false;
            logToWerewolfGame(`Thợ săn đã nổ súng kéo theo ${targetPlayer.name}.`);
            renderWerewolfGameScreen();
            if (checkGameOver()) return;
          }
        }

        werewolfGameState.gamePhase = 'day_discussion';
        await sleep(2000);
        await processGameTurn();
        break;

      case 'day_discussion':
        logToWerewolfGame('Bây giờ bắt đầu phát biểu lần lượt.');
        const alivePlayersForSpeech = werewolfGameState.players.filter(p => p.isAlive);
        for (const player of alivePlayersForSpeech) {
          renderWerewolfGameScreen({ speakingPlayerId: player.id });
          let speech;
          if (player.isUser) {
            speech = await waitForUserAction('Tới lượt bạn phát biểu', 'speak');
          } else {
            speech = await triggerWerewolfAiAction(player.id, 'speak');
          }
          logToWerewolfGame({ player: player, speech: speech }, 'speech');
          await sleep(1000);
        }
        renderWerewolfGameScreen();
        werewolfGameState.gamePhase = 'day_vote';
        await processGameTurn();
        break;

      case 'day_vote':
        logToWerewolfGame('Hãy bỏ phiếu chọn người chơi bạn cho là sói.');
        const voterPromises = werewolfGameState.players
          .filter(p => p.isAlive)
          .map(player => {
            if (player.isUser) {
              return waitForUserAction('Hãy bỏ phiếu', 'vote');
            } else {
              return triggerWerewolfAiAction(player.id, 'vote');
            }
          });
        const allVotesResult = (await Promise.all(voterPromises)).filter(Boolean);

        const voteTallyResult = {};
        allVotesResult.forEach(vote => {
          voteTallyResult[vote] = (voteTallyResult[vote] || 0) + 1;
        });

        let maxVotesResult = 0,
          playersToEliminate = [];
        for (const playerId in voteTallyResult) {
          if (voteTallyResult[playerId] > maxVotesResult) {
            maxVotesResult = voteTallyResult[playerId];
            playersToEliminate = [playerId];
          } else if (voteTallyResult[playerId] === maxVotesResult) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length === 1) {
          const eliminatedPlayer = werewolfGameState.players.find(p => p.id === playersToEliminate[0]);
          eliminatedPlayer.isAlive = false;
          logToWerewolfGame(`Kết quả bỏ phiếu: ${eliminatedPlayer.name} bị loại.`);
          renderWerewolfGameScreen();
          if (checkGameOver()) return;
          if (eliminatedPlayer.role === 'hunter') {
            logToWerewolfGame(`${eliminatedPlayer.name} là thợ săn, có thể chọn kéo theo một người chơi.`);
            let targetId;
            if (eliminatedPlayer.isUser) {
              targetId = await waitForUserAction('Hãy chọn người chơi bạn muốn kéo theo', 'hunter_shoot');
            } else {
              targetId = await triggerWerewolfAiAction(eliminatedPlayer.id, 'hunter_shoot');
            }
            if (targetId) {
              const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
              targetPlayer.isAlive = false;
              logToWerewolfGame(`Thợ săn đã nổ súng kéo theo ${targetPlayer.name}.`);
              renderWerewolfGameScreen();
              if (checkGameOver()) return;
            }
          }
        } else {
          logToWerewolfGame('Phiếu hòa, không ai bị loại.');
        }

        werewolfGameState.gamePhase = 'night_start';
        await sleep(3000);
        await processGameTurn();
        break;
    }
  }
  // ▲▲▲ 新引擎代码结束 ▲▲▲
  // ▼▼▼ 【全新】这是狼人杀的重roll功能核心函数 ▼▼▼
  /**
   * 【狼人杀】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleWerewolfReroll(logIndex) {
    const logEntry = werewolfGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || logEntry.message.player.isUser) {
      return; // 安全检查，确保我们操作的是AI的发言
    }

    const playerToReroll = logEntry.message.player;

    // 给用户一个即时反馈
    const speechTextElement = document
      .querySelector(`button[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>Đang suy nghĩ lại...</i>';
    }

    try {
      // 重新调用AI生成新的发言
      const newSpeech = await triggerWerewolfAiAction(playerToReroll.id, 'speak');

      // 用新的发言内容替换掉旧的
      werewolfGameState.gameLog[logIndex].message.speech = newSpeech;

      // 重新渲染整个游戏界面以显示更新
      renderWerewolfGameScreen();
    } catch (error) {
      console.error('狼人杀发言重roll失败:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">Tạo lại thất bại, hãy kiểm tra mạng hoặc cài đặt API.</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 请用这块【已添加重roll按钮】的代码，完整替换旧的 renderWerewolfGameScreen 函数 ▼▼▼
  /**
   * 【狼人杀】渲染游戏主界面
   */
  function renderWerewolfGameScreen(options = {}) {
    const playersGrid = document.getElementById('werewolf-players-grid');
    const logContainer = document.getElementById('werewolf-game-log');

    // 渲染玩家座位
    playersGrid.innerHTML = '';
    werewolfGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${!player.isAlive ? 'dead' : ''} ${
        options.speakingPlayerId === player.id ? 'speaking' : ''
      } ${options.activePlayerId === player.id ? 'active-turn' : ''}`;

      let roleIndicator = '';
      const user = werewolfGameState.players.find(p => p.isUser);
      // 如果我是狼人，显示所有狼人队友
      if (user.role === 'wolf' && player.role === 'wolf') {
        roleIndicator = '<div class="player-role-indicator" style="display: flex;">W</div>';
      }

      seat.innerHTML = `
            ${roleIndicator}
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name} (${player.isAlive ? 'Còn sống' : 'Bị loại'})</span>
        `;
      playersGrid.appendChild(seat);
    });

    // 渲染游戏日志
    logContainer.innerHTML = werewolfGameState.gameLog
      .map((log, index) => {
        // ★ 核心修改1：增加了index参数
        // 判断是否为AI的发言
        if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
          const { player, speech } = log.message;
          // ★ 核心修改2：在AI发言的DOM结构中，加入一个带有特殊data属性的重roll按钮
          return `
            <div class="log-entry speech">
                <img src="${player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="speaker">${player.name}</span>
<button class="werewolf-reroll-btn" data-log-index="${index}" title="Tạo lại lời phát biểu" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                            <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                    <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
                </div>
            </div>
        `;
        }
        // 用户发言或其他系统消息保持原样
        else if (log.type === 'speech' && typeof log.message === 'object') {
          const { player, speech } = log.message;
          return `
            <div class="log-entry speech">
                <img src="${player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <span class="speaker">${player.name}</span>
                    <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
                </div>
            </div>
        `;
        } else {
          return `<div class="log-entry ${log.type}">${String(log.message).replace(/\n/g, '<br>')}</div>`;
        }
      })
      .join('');
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【狼人杀】等待用户投票
   */
  function waitForUserVote() {
    return new Promise(resolve => {
      const actionArea = document.getElementById('werewolf-action-area');
      const alivePlayers = werewolfGameState.players.filter(p => p.isAlive && !p.isUser);

      actionArea.innerHTML = '<h5>Hãy bỏ phiếu:</h5>';
      const grid = document.createElement('div');
      grid.className = 'vote-target-grid';

      alivePlayers.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'form-button-secondary vote-target-btn';
        btn.textContent = player.name;
        btn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(player.id);
        };
        grid.appendChild(btn);
      });
      actionArea.appendChild(grid);
    });
  }

  /**
   * 【狼人杀】添加一条游戏日志
   */
  function logToWerewolfGame(message, type = 'system') {
    werewolfGameState.gameLog.push({ message, type });
    renderWerewolfGameScreen();
  }
  /**
   * 【狼人杀-AI核心】调用AI为整局游戏生成复盘摘要
   * @returns {Promise<string>} - AI生成的摘要文本
   */
  async function generateAiGameSummary() {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      return '(AI tạo tóm tắt thất bại: API chưa được cấu hình)';
    }

    // 格式化完整的游戏日志，让AI能够理解
    const formattedLog = werewolfGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message;
      })
      .join('\n');

    const prompt = `
# Nhiệm vụ
Bạn là một nhà phân tích tổng kết ván Ma sói chuyên nghiệp. Hãy dựa vào nhật ký trò chơi đầy đủ dưới đây, dùng 100-150 từ tiếng Việt để tóm tắt khách quan, súc tích 【các sự kiện then chốt】 và 【bước ngoặt】 của ván này.

# Yêu cầu cốt lõi
- Bản tóm tắt cần logic, mạch lạc.
- Chỉ ra hành vi của những người chơi then chốt, ví dụ việc soi của tiên tri, thao tác của phù thủy, việc nổ súng của thợ săn...
- Phân tích quá trình đấu trí giữa phe sói và phe tốt.
- Đầu ra của bạn 【bắt buộc và chỉ được】 là văn bản thuần của bản tóm tắt, không kèm bất kỳ hội thoại hay tiêu đề nào khác.

# Nhật ký trò chơi
${formattedLog}
`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();
    } catch (error) {
      console.error('AI摘要生成失败:', error);
      return '(AI tạo tóm tắt thất bại, hãy kiểm tra mạng hoặc cài đặt API)';
    }
  }

  /**
   * 【狼人杀 V2 - 增强版】生成游戏复盘的文本，包含AI摘要
   * @param {string} winner - 胜利的阵营名称
   * @param {string} aiSummary - AI生成的摘要文本
   * @returns {string} - 格式化后的完整复盘Markdown文本
   */
  function generateWerewolfSummary(winner, aiSummary) {
    const roleNameMap = {
      wolf: 'Sói',
      villager: 'Dân làng',
      seer: 'Tiên tri',
      witch: 'Phù thủy',
      hunter: 'Thợ săn',
      guard: 'Bảo vệ',
      idiot: 'Kẻ ngốc',
    };

    let summaryText = `**Ma sói - Tổng kết ván**\n\n`; // 优化标题
    summaryText += `🏆 **Bên thắng:** ${winner}\n`;
    summaryText += `📅 **Số ngày chơi:** ${werewolfGameState.dayNumber} ngày\n\n`;

    // 加入AI生成的摘要
    summaryText += `**Tóm tắt ván này:**\n${aiSummary}\n\n`;

    summaryText += `**Tổng kết người chơi:**\n`;
    werewolfGameState.players.forEach(p => {
      const status = p.isAlive ? 'Còn sống' : 'Bị loại';
      const roleName = roleNameMap[p.role] || p.role;
      summaryText += `- ${p.name} (${roleName}) - ${status}\n`;
    });

    return summaryText;
  }

  /**
   * 【狼人杀】打开复盘发送目标选择器
   * @param {string} summaryText - 要发送的复盘文本
   */
  function openWerewolfSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('werewolf-target-picker-modal');
    const listEl = document.getElementById('werewolf-target-list');
    listEl.innerHTML = '';

    const aiPlayers = werewolfGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('Không có người chơi AI nào để gửi.');
      return;
    }

    // 渲染可选的AI玩家列表
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用之前的样式
      item.innerHTML = `
            <input type="checkbox" class="werewolf-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('wt-confirm-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.werewolf-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Vui lòng chọn ít nhất một người nhận!');
      }
    };

    const cancelBtn = document.getElementById('wt-cancel-btn');
    cancelBtn.onclick = () => modal.classList.remove('visible');

    document.getElementById('wt-select-all-btn').onclick = () => {
      document.querySelectorAll('.werewolf-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('wt-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.werewolf-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 【狼人杀】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showWerewolfSummaryModal(summaryText) {
    const modal = document.getElementById('werewolf-summary-modal');
    const contentEl = document.getElementById('werewolf-summary-content');

    // 使用你已有的Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // 为按钮绑定事件 (使用克隆节点防止重复绑定)
    const repostBtn = document.getElementById('repost-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openWerewolfSummaryTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }
  /**
   * 【狼人杀 V2 - 增强版】将游戏复盘发送到【选定】的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendSummaryToSelectedPlayers(summaryText, targetIds) {
    // 先关闭所有可能打开的弹窗
    document.getElementById('werewolf-summary-modal').classList.remove('visible');
    document.getElementById('werewolf-target-picker-modal').classList.remove('visible');

    const aiPlayers = werewolfGameState.players.filter(p => !p.isUser);
    let sentCount = 0;

    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván Ma sói, đây là bản tổng kết. Hãy dựa vào nội dung tổng kết này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        // ▼▼▼ 核心修改就在这里 ▼▼▼
        // 1. 创建对用户可见的【复盘卡片】消息
        // 创建对用户可见的复盘消息
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Ma sói - Tổng kết ván',
          description: 'Bấm để xem tổng kết chi tiết',
          source_name: 'Trung tâm trò chơi',
          content: summaryText,
        };

        // 2. 创建对AI可见的【隐藏指令】
        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        // 3. 将【两条】消息推入历史记录
        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
        // ▲▲▲ 修改结束 ▲▲▲
      }
    }

    await showCustomAlert('Gửi thành công', `Đã gửi bản tổng kết vào chat của ${sentCount} nhân vật AI!`);
    showScreen('game-hall-screen');
  }

  // ▼▼▼ 用这个【修正后】的函数替换旧的 checkGameOver ▼▼▼
  function checkGameOver() {
    const alivePlayers = werewolfGameState.players.filter(p => p.isAlive);
    const aliveWolves = alivePlayers.filter(p => p.role === 'wolf').length;
    const aliveGods = alivePlayers.filter(p => ['seer', 'witch', 'hunter', 'guard', 'idiot'].includes(p.role)).length;
    const aliveVillagers = alivePlayers.filter(p => p.role === 'villager').length;

    let winner = null;

    if (aliveWolves === 0) {
      winner = 'Phe tốt';
    } else if (aliveWolves >= aliveGods + aliveVillagers) {
      winner = 'Phe sói';
    } else if (aliveGods === 0 && aliveVillagers === 0) {
      winner = 'Phe sói';
    }

    if (winner) {
      logToWerewolfGame(`Trò chơi kết thúc! ${winner} chiến thắng!`);
      const roleNameMap = {
        wolf: 'Sói',
        villager: 'Dân làng',
        seer: 'Tiên tri',
        witch: 'Phù thủy',
        hunter: 'Thợ săn',
        guard: 'Bảo vệ',
        idiot: 'Kẻ ngốc',
      };
      const rolesReveal = werewolfGameState.players.map(p => `${p.name}: ${roleNameMap[p.role] || p.role}`).join('\n');
      logToWerewolfGame(`Công bố vai trò:\n${rolesReveal}`);

      // 【核心修改】在这里调用AI生成摘要并显示结算卡
      (async () => {
        await showCustomAlert('Vui lòng chờ...', 'AI đang tạo tóm tắt ván này...');
        const aiSummary = await generateAiGameSummary();
        const summary = generateWerewolfSummary(winner, aiSummary);
        showWerewolfSummaryModal(summary);
      })();

      werewolfGameState.isActive = false;
      document.getElementById('werewolf-action-area').innerHTML = '';

      return true;
    }

    return false;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【狼人杀输入框美化】请用这个【全新】的函数，完整替换掉你旧的 waitForUserAction 函数 ▼▼▼
  /**
   * 【狼人杀 V2 - 输入框美化版】等待用户行动的通用函数
   */
  function waitForUserAction(prompt, actionType, context = {}) {
    const me = werewolfGameState.players.find(p => p.isUser);

    // ★★★ 核心修复：当用户死亡时，允许'hunter_shoot'动作继续执行 ★★★
    if (me && !me.isAlive && actionType !== 'hunter_shoot') {
      const actionArea = document.getElementById('werewolf-action-area');
      actionArea.innerHTML = `<h5>Bạn đã bị loại, đang xem trận...</h5>`;
      return new Promise(async resolve => {
        await sleep(3000);
        actionArea.innerHTML = '';
        resolve(null);
      });
    }
    // ★★★ 修复结束 ★★★

    return new Promise(resolve => {
      const actionArea = document.getElementById('werewolf-action-area');
      actionArea.innerHTML = ''; // 清空，准备新的UI
      actionArea.className = 'werewolf-action-area'; // 重置class

      if (actionType === 'speak') {
        // --- 这是我们美化后的发言输入区 ---
        actionArea.classList.add('speaking-mode'); // 激活新CSS

        const textarea = document.createElement('textarea');
        textarea.id = 'user-speech-input';
        textarea.rows = 1;
        textarea.placeholder = 'Nhập lời phát biểu của bạn...';
        // 实时调整高度
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });

        const endBtn = document.createElement('button');
        endBtn.id = 'end-speech-btn';
        endBtn.className = 'form-button'; // 保留一个基础class
        endBtn.textContent = 'Kết thúc phát biểu';

        actionArea.appendChild(textarea);
        actionArea.appendChild(endBtn);

        textarea.focus();

        endBtn.onclick = () => {
          const speech = textarea.value.trim() || 'Tôi qua lượt.';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
        return; // 结束 'speak' 分支
      }

      // --- 以下是其他非发言动作的UI，保持原样 ---
      actionArea.innerHTML = `<h5>${prompt}</h5>`;
      const grid = document.createElement('div');
      grid.className = 'vote-target-grid';

      if (actionType === 'witch_action') {
        if (context.killedId && werewolfGameState.witchPotions.save > 0) {
          const saveBtn = document.createElement('button');
          saveBtn.className = 'form-button';
          saveBtn.textContent = `Dùng thuốc giải cứu ${context.killedPlayerName}`;
          saveBtn.onclick = () => {
            actionArea.innerHTML = '';
            resolve({ action: 'save' });
          };
          grid.appendChild(saveBtn);
        }
        if (werewolfGameState.witchPotions.poison > 0) {
          const poisonBtn = document.createElement('button');
          poisonBtn.className = 'form-button form-button-secondary';
          poisonBtn.textContent = 'Dùng thuốc độc';
          poisonBtn.onclick = async () => {
            const targetId = await waitForUserAction('Chọn người chơi muốn đầu độc', 'witch_poison_target');
            resolve({ action: 'poison', targetId: targetId });
          };
          grid.appendChild(poisonBtn);
        }
        const passBtn = document.createElement('button');
        passBtn.className = 'form-button form-button-secondary';
        passBtn.textContent = 'Bỏ qua';
        passBtn.onclick = () => {
          actionArea.innerHTML = '';
          resolve({ action: 'none' });
        };
        grid.appendChild(passBtn);
        actionArea.appendChild(grid);
        return;
      }

      let targets = [];
      if (['guard_protect', 'seer_check', 'hunter_shoot', 'witch_poison_target'].includes(actionType)) {
        targets = werewolfGameState.players.filter(p => p.isAlive);
      } else if (actionType === 'wolf_kill') {
        targets = werewolfGameState.players.filter(p => p.isAlive && p.role !== 'wolf');
      } else if (actionType === 'vote') {
        targets = werewolfGameState.players.filter(p => p.isAlive);
      }

      // ★★★ 针对猎人开枪的特殊目标筛选 ★★★
      // 如果是猎人开枪，目标不应该包括自己
      if (actionType === 'hunter_shoot') {
        targets = targets.filter(p => p.id !== me.id);
      }

      targets.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'form-button-secondary vote-target-btn';
        btn.textContent = player.name;
        btn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(player.id);
        };
        grid.appendChild(btn);
      });

      if (actionType === 'vote') {
        const passBtn = document.createElement('button');
        passBtn.className = 'form-button-secondary vote-target-btn';
        passBtn.textContent = 'Bỏ phiếu trắng';
        passBtn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(null);
        };
        grid.appendChild(passBtn);
      }
      actionArea.appendChild(grid);
    });
  }

  /**
   * 【狼人杀AI核心 V3 - 终极修复版】
   * @param {string} playerId - 触发行动的AI玩家ID
   * @param {string} action - AI需要执行的动作，例如 'speak', 'vote'
   * @param {object} context - 附加信息，例如女巫的救人目标
   * @returns {Promise<any>} - AI的决策结果
   */
  async function triggerWerewolfAiAction(playerId, action, context = {}) {
    const player = werewolfGameState.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return null;

    const { proxyUrl, apiKey, model } = state.apiConfig;

    let actionPrompt = '';
    let jsonFormat = '';

    // 1. 构建一个清晰的、包含所有存活玩家及其ID的列表
    const alivePlayersList = werewolfGameState.players
      .filter(p => p.isAlive)
      .map(p => `- ${p.name} (id: ${p.id})`)
      .join('\n');

    // 2. 构建完整的游戏日志，这是AI的“记忆核心”
    const fullGameLog = werewolfGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message.replace(/<strong>/g, '').replace(/<\/strong>/g, ''); // 移除HTML标签
      })
      .join('\n');

    let extraContext = '';
    // 如果是预言家发言，提供专属情报
    if (player.role === 'seer' && action === 'speak' && werewolfGameState.seerLastNightResult) {
      const result = werewolfGameState.seerLastNightResult;
      extraContext = `\n# Tin tình báo riêng của tiên tri (chỉ bạn thấy)\n- **Thông tin quan trọng**: Đêm qua bạn đã soi **${result.targetName}**, vai trò của người đó là 【${result.isWolf ? 'Sói' : 'Phe tốt'}】.\n- **Nhiệm vụ của bạn**: Bạn có thể chọn công bố thông tin này khi phát biểu (có thể nói thật, cũng có thể nói dối để đánh lừa sói), hoặc tạm thời giấu đi. Hãy dựa vào thiết lập nhân vật và cục diện hiện tại để đưa ra quyết định có lợi nhất.\n`;
      werewolfGameState.seerLastNightResult = null;
    }

    // 3. 根据不同的行动类型，生成具体的任务描述和输出格式要求
    switch (action) {
      case 'guard_protect':
        actionPrompt = 'Bạn là bảo vệ, hãy chọn một người chơi để bảo vệ. Bạn không được bảo vệ cùng một người hai đêm liên tiếp.';
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn chọn bảo vệ"}';
        if (werewolfGameState.guardLastNightProtected)
          extraContext = `\n- Gợi ý: Đêm qua bạn đã bảo vệ ${werewolfGameState.players.find(p => p.id === werewolfGameState.guardLastNightProtected).name}.`;
        break;
      case 'wolf_kill':
        const wolfTeammates = werewolfGameState.players
          .filter(p => p.role === 'wolf' && p.id !== player.id)
          .map(w => w.name)
          .join('、');
        if (context.isUserWolfAlly) {
          actionPrompt = `Bạn là sói, đồng đội của bạn là 【${wolfTeammates}】 và 【người dùng】. Hãy đưa cho đồng đội người dùng một đề nghị giết.`;
        } else {
          actionPrompt = `Bạn là sói, đồng đội của bạn là 【${wolfTeammates || 'Không'}】. Hãy chọn một nhân vật không phải sói để tấn công.`;
        }
        extraContext += `\n# Chỉ thị chiến thuật của sói (cực kỳ quan trọng)\n- **Phối hợp đồng đội**: Mục tiêu hàng đầu của bạn là cùng các đồng đội sói 【dồn hỏa lực】 vào cùng một mục tiêu, để đảm bảo giết thành công.\n- **Ưu tiên tấn công**: Hãy ưu tiên tấn công người chơi bạn cho là 【tiên tri】, 【phù thủy】 và các vai thần chức khác, hoặc người phe tốt phát biểu logic rõ ràng, đe dọa lớn tới phe sói.`;
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn chọn tấn công"}';
        break;
      case 'seer_check':
        actionPrompt = 'Bạn là tiên tri, hãy chọn một người chơi để soi vai trò (phe tốt hay sói).';
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn chọn soi"}';
        break;
      case 'witch_action':
        actionPrompt = 'Bạn là phù thủy.';
        if (context.killedId) {
          actionPrompt += `Đêm nay ${werewolfGameState.players.find(p => p.id === context.killedId).name} đã bị tấn công.`;
        } else {
          actionPrompt += 'Đêm nay là đêm bình yên.';
        }
        actionPrompt += ` Bạn có ${werewolfGameState.witchPotions.save} lọ thuốc giải và ${werewolfGameState.witchPotions.poison} lọ thuốc độc. Hãy quyết định hành động của bạn.`;
        jsonFormat = '{"action": "save" | "poison" | "none", "targetId": "(nếu dùng thuốc độc, điền ID mục tiêu)"}';
        break;
      case 'hunter_shoot':
        actionPrompt = 'Bạn là thợ săn, bạn đã bị loại, hãy chọn một người chơi cùng bị loại với bạn.';
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn chọn kéo theo"}';
        break;
      case 'speak':
        actionPrompt =
          'Bây giờ tới lượt bạn phát biểu. Hãy dựa vào vai trò, thiết lập nhân vật và cục diện hiện tại để bày tỏ quan điểm, có thể nói dối hoặc dẫn dắt. Lời phát biểu nên xoay quanh trò chơi, chứ không chỉ trò chuyện với người dùng. Phát biểu bằng tiếng Việt.';
        jsonFormat = '{"action": "speak", "speech": "nội dung phát biểu của bạn..."}';
        break;
      case 'vote':
        actionPrompt = 'Bây giờ là vòng bỏ phiếu ban ngày, hãy dựa vào lời phát biểu của mọi người và phán đoán của bạn để bỏ phiếu chọn người chơi bạn cho là sói.';
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn bỏ phiếu"}';
        break;
    }

    // 4. 构建最终发送给AI的、结构清晰的完整Prompt
    const systemPrompt = `
# Bối cảnh trò chơi: Ma sói
# Vai trò và thiết lập của bạn
- **Tên của bạn**: ${player.name}
- **Vai trò của bạn**: ${player.role}
- **Thiết lập tính cách của bạn**: ${player.persona}

# Cục diện hiện tại
- **Danh sách người chơi còn sống**:
${alivePlayersList}
- **Nhật ký trò chơi (đây là bản ghi đầy đủ của trò chơi, bạn phải đọc hết và ghi nhớ mọi thông tin)**:
${fullGameLog}
${extraContext}

# Nhiệm vụ của bạn: ${actionPrompt}

# Định dạng đầu ra: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
${jsonFormat}
`;
    // 5. 发送请求并处理返回结果 (这部分保持不变)
    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = await fetch(
        isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
        isGemini
          ? geminiConfig.data
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: messagesForApi,
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            },
      );
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiAction = JSON.parse(content);

      if (action === 'witch_action') return aiAction;
      if (aiAction.action === 'vote') return aiAction.targetId;
      if (aiAction.action === 'speak') return aiAction.speech;

      return null;
    } catch (error) {
      console.error(`AI (${player.name}) 行动失败:`, error);
      // 如果AI出错，提供一个保底的行动，防止游戏卡死
      if (
        action.includes('vote') ||
        action.includes('kill') ||
        action.includes('protect') ||
        action.includes('check') ||
        action.includes('shoot')
      ) {
        const potentialTargets = werewolfGameState.players.filter(p => p.isAlive && p.id !== player.id);
        if (potentialTargets.length > 0)
          return potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
      }
      if (action === 'witch_action') return { action: 'none' };
      return 'Tôi... tôi không biết nên nói gì nữa.';
    }
  }

  /**
   * 一个简单的sleep函数，用于在游戏流程中制造停顿
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ▲▲▲ 狼人杀功能函数结束 ▲▲▲

  // ▼▼▼ 【全新】这里是海龟汤游戏的所有核心功能函数 ▼▼▼

  /**
   * 【海龟汤】总入口：打开游戏设置界面
   */
  async function openSeaTurtleSoupSetup() {
    // 1. 重置游戏状态
    seaTurtleSoupState = {
      isActive: false,
      phase: 'setup',
      players: [],
      riddleProvider: null,
      riddle: '',
      answer: '',
      gameLog: [],
      currentTurnIndex: 0,
    };

    // 2. 渲染玩家选择列表
    const selectionEl = document.getElementById('sts-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách nhân vật...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用狼人杀的样式
      item.innerHTML = `
            <input type="checkbox" class="sts-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 3. 重置并显示设置弹窗
    document.getElementById('sts-riddle-provider-select').value = 'random';
    document.getElementById('sts-user-riddle-input-area').style.display = 'none';
    document.getElementById('sts-ai-riddle-input-area').style.display = 'none';
    document.getElementById('sea-turtle-soup-setup-modal').classList.add('visible');
  }

  /**
   * 【海龟汤】开始游戏的核心逻辑
   */
  async function startSeaTurtleSoupGame() {
    const selectedCheckboxes = document.querySelectorAll('.sts-player-checkbox:checked');
    if (selectedCheckboxes.length < 1) {
      alert('Vui lòng mời ít nhất một người chơi AI hoặc NPC!');
      return;
    }

    await showCustomAlert('Vui lòng chờ...', 'Đang chuẩn bị trò Súp rùa...');

    // 1. 收集玩家信息
    let players = [
      {
        id: 'user',
        name: state.qzoneSettings.nickname || 'Tôi',
        avatar: state.qzoneSettings.avatar || defaultAvatar,
        isUser: true,
        persona: 'Một người bình thường tò mò',
      },
    ];
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        // 是主要角色
        players.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isUser: false,
        });
      } else {
        // 是NPC
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            players.push({ id: npc.id, name: npc.name, avatar: npc.avatar, persona: npc.persona, isUser: false });
            break;
          }
        }
      }
    });
    players.sort(() => Math.random() - 0.5); // 打乱座位顺序
    seaTurtleSoupState.players = players;

    // 2. 决定出题人
    const providerChoice = document.getElementById('sts-riddle-provider-select').value;
    let providerIndex = -1;

    if (providerChoice === 'user') {
      providerIndex = players.findIndex(p => p.isUser);
    } else if (providerChoice === 'random_ai') {
      const aiIndices = players.map((p, i) => (!p.isUser ? i : -1)).filter(i => i !== -1);
      providerIndex = aiIndices[Math.floor(Math.random() * aiIndices.length)];
    } else {
      // random
      providerIndex = Math.floor(Math.random() * players.length);
    }

    seaTurtleSoupState.players[providerIndex].isProvider = true;
    seaTurtleSoupState.riddleProvider = seaTurtleSoupState.players[providerIndex];

    // 3. 获取谜面和谜底
    if (seaTurtleSoupState.riddleProvider.isUser) {
      const riddle = document.getElementById('sts-user-riddle-surface').value.trim();
      const answer = document.getElementById('sts-user-riddle-answer').value.trim();
      if (!riddle || !answer) {
        alert('Là người ra đề, đề bài và lời giải đều không được để trống nhé!');
        return;
      }
      seaTurtleSoupState.riddle = riddle;
      seaTurtleSoupState.answer = answer;
    } else {
      const riddleType = document.getElementById('sts-ai-riddle-type').value.trim();
      const { riddle, answer } = await generateSeaTurtleRiddle(seaTurtleSoupState.riddleProvider, riddleType);
      if (!riddle || !answer) {
        alert('AI ra đề thất bại, hãy kiểm tra API hoặc thử lại sau.');
        return;
      }
      seaTurtleSoupState.riddle = riddle;
      seaTurtleSoupState.answer = answer;
    }

    // 4. 初始化游戏
    seaTurtleSoupState.isActive = true;
    seaTurtleSoupState.phase = 'guessing';
    logToStsGame(
      `Trò chơi bắt đầu! Người ra đề là ${seaTurtleSoupState.riddleProvider.name}.`,
      'system',
      seaTurtleSoupState.riddleProvider,
    );
    logToStsGame(`【Đề bài】\n${seaTurtleSoupState.riddle}`);

    document.getElementById('sea-turtle-soup-setup-modal').classList.remove('visible');
    showScreen('sea-turtle-soup-screen');
    renderSeaTurtleGameScreen({ activePlayerId: 'user' });

    // 游戏开始，进入第一个回合
    await processStsTurn();
  }

  /**
   * 【海龟汤-AI核心 | 优化版】让AI根据指定类型出题，并优先选择经典谜题
   */
  async function generateSeaTurtleRiddle(provider, riddleType) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return { riddle: null, answer: null };

    // 核心修改：优化了Prompt，增加了“优先选择经典谜题”的指令
    const typePrompt = riddleType ? `hãy sáng tác một câu đố loại 【${riddleType}】 theo kiểu` : 'hãy sáng tác một câu đố theo kiểu';

    const systemPrompt = `
# Nhiệm vụ
Bây giờ bạn là nhân vật "${provider.name}", thiết lập nhân vật của bạn là: "${provider.persona}".
Nhiệm vụ của bạn là đóng nhân vật này, ${typePrompt} Súp rùa kinh điển. Viết bằng tiếng Việt.

# Quy tắc cốt lõi
1.  **Ưu tiên kinh điển**: Bạn 【bắt buộc ưu tiên】 chọn một câu chuyện "Súp rùa" kinh điển, nổi tiếng, được nhiều người biết làm câu đố lần này. Điều này đảm bảo tính logic và độ hấp dẫn của câu đố.
2.  **Sáng tác vừa phải**: Chỉ khi không nghĩ ra câu đố kinh điển phù hợp, bạn mới được phép tự sáng tác. Câu đố tự sáng tác cũng phải logic chặt chẽ, tình tiết hợp lý.
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, có hai trường "riddle" (đề bài) và "answer" (lời giải).
4.  **Cấm thoát vai**: Đừng nói bất cứ điều gì không liên quan tới việc ra đề.

# Ví dụ định dạng đầu ra JSON:
{
"riddle": "Một người đàn ông bước vào quán bar, xin người pha chế một ly nước. Người pha chế lại rút ra một khẩu súng chĩa vào anh ta. Người đàn ông nói 'cảm ơn' rồi bỏ đi. Vì sao?",
"answer": "Người đàn ông này đang bị nấc cụt. Anh ta muốn uống nước để hết nấc, nhưng người pha chế đã dùng cách hiệu quả hơn — làm anh ta giật mình — để chữa nấc giúp. Vì vậy người đàn ông cảm ơn rồi rời đi."
}
`;
    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      return JSON.parse(content);
    } catch (error) {
      console.error('AI出题失败:', error);
      return { riddle: null, answer: null };
    }
  }

  /**
   * 【海龟汤】渲染游戏主界面 (已添加当前回合玩家高亮)
   */
  function renderSeaTurtleGameScreen(options = {}) {
    const playersGrid = document.getElementById('sts-players-grid');
    const logContainer = document.getElementById('sts-game-log');

    // 渲染玩家座位
    playersGrid.innerHTML = '';
    seaTurtleSoupState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const roleIndicator = player.isProvider
        ? '<div class="player-role-indicator riddle-master" title="Người ra đề">👑</div>'
        : '';
      const avatarClass = `player-avatar ${options.activePlayerId === player.id ? 'active-turn' : ''}`;

      seat.innerHTML = `
            ${roleIndicator}
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name}</span>
        `;
      playersGrid.appendChild(seat);
    });

    // 渲染游戏日志
    logContainer.innerHTML = '';
    seaTurtleSoupState.gameLog.forEach(log => {
      const logEl = document.createElement('div');
      logEl.className = `sts-log-entry ${log.type}`;

      let avatarUrl = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg';
      if (log.speakerObj && log.speakerObj.avatar) {
        avatarUrl = log.speakerObj.avatar;
      }

      switch (log.type) {
        case 'system':
          logEl.innerHTML = log.message.replace(/\n/g, '<br>');
          break;
        case 'question':
        case 'guess':
          logEl.innerHTML = `
                    <img src="${avatarUrl}" class="sts-log-avatar">
                    <div class="sts-log-content">
                        <div class="speaker">${log.speaker}</div>
                        <div>${log.message}</div>
                    </div>
                `;
          break;
        case 'answer':
          const answerClass = { "Đúng": 'yes', "Sai": 'no', "Không liên quan": 'irrelevant' }[log.message] || 'irrelevant';
          logEl.innerHTML = `
                    <div class="sts-log-content">
                         <span class="answer-text ${answerClass}">${log.message}</span>
                    </div>
                    <img src="${avatarUrl}" class="sts-log-avatar">
                `;
          break;
      }
      logContainer.appendChild(logEl);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * 【海龟汤】添加一条游戏日志
   */
  function logToStsGame(message, type = 'system', speakerObj = { name: 'Hệ thống' }) {
    seaTurtleSoupState.gameLog.push({ message, type, speaker: speakerObj.name, speakerObj }); // 保存整个对象
    renderSeaTurtleGameScreen();
  }

  // ▼▼▼ 用这块【已添加重roll按钮】的代码，完整替换旧的 handleStsUserQuestion 函数 ▼▼▼
  /**
   * 【海龟汤】处理用户提问
   */
  async function handleStsUserQuestion() {
    if (seaTurtleSoupState.phase !== 'guessing') return;
    const input = document.getElementById('sts-question-input');
    const question = input.value.trim();
    if (!question) return;

    const userPlayer = seaTurtleSoupState.players.find(p => p.isUser);
    logToStsGame(question, 'question', userPlayer);
    input.value = '';

    // ★ 核心修改：在用户提问后，先移除可能存在的重roll按钮
    const oldRerollBtn = document.getElementById('sts-reroll-ai-turn-btn');
    if (oldRerollBtn) oldRerollBtn.remove();

    // 将控制权交给游戏主循环，并告知是用户在提问
    await processStsTurn(question, userPlayer);
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 把这一整块全新的函数，粘贴到 handleStsUserQuestion 函数的后面 ▼▼▼

  /**
   * 【海龟汤】处理用户猜测答案
   */
  async function handleStsUserGuess() {
    if (seaTurtleSoupState.phase !== 'guessing') return;
    const input = document.getElementById('sts-question-input');
    const guess = input.value.trim();
    if (!guess) {
      alert('Nội dung đoán không được để trống!');
      return;
    }

    const userPlayer = seaTurtleSoupState.players.find(p => p.isUser);
    logToStsGame(guess, 'guess', userPlayer);
    input.value = '';

    const provider = seaTurtleSoupState.riddleProvider;
    let isCorrect = false;

    if (provider.isUser) {
      isCorrect = await showCustomConfirm(
        'Phán định câu đoán',
        `Câu trả lời người chơi ${userPlayer.name} đoán là:\n\n"${guess}"\n\nCâu đoán này có đúng không?`,
      );
    } else {
      const aiEvaluation = await triggerStsAiTurn(provider, 'evaluate_guess', guess);
      isCorrect = aiEvaluation.isCorrect;
    }

    if (isCorrect) {
      logToStsGame(`${userPlayer.name} đã đoán đúng! Trò chơi kết thúc!`, 'system', userPlayer);
      await revealStsAnswer();
    } else {
      logToStsGame('Không đúng rồi.', 'answer', provider);
      await processStsTurn();
    }
  }
  // ▼▼▼ 【全新】这是海龟汤的重roll功能核心函数 ▼▼▼
  /**
   * 【海龟汤】处理重roll整个AI回合的请求
   */
  async function handleStsReroll() {
    // 1. 找到最后一次用户的发言（提问或猜测）
    const lastUserActionIndex = findLastIndex(seaTurtleSoupState.gameLog, log => log.speakerObj.isUser);

    if (lastUserActionIndex === -1) {
      alert('Chưa có lời phát biểu nào của bạn, không thể roll lại.');
      return;
    }

    // 2. 移除那之后的所有日志（也就是所有AI的行动记录）
    const removedLogs = seaTurtleSoupState.gameLog.splice(lastUserActionIndex + 1);

    if (removedLogs.length === 0) {
      alert('AI chưa hành động, không cần roll lại.');
      return;
    }

    console.log(`海龟汤：移除了 ${removedLogs.length} 条AI行动日志，准备重roll。`);

    // 3. 重新渲染UI，界面会立刻回滚
    renderSeaTurtleGameScreen();

    // 4. 给用户一个提示
    await showCustomAlert('Vui lòng chờ...', 'Đang để các AI sắp xếp lại lời nói...');

    // 5. 重新调用游戏主循环，它会自动执行AI的回合
    await processStsTurn();
  }

  /**
   * 辅助函数：从后往前查找数组中满足条件的第一个元素的索引
   */
  function findLastIndex(array, predicate) {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        return i;
      }
    }
    return -1;
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  /**
   * 【海龟汤】游戏主循环/引擎
   */
  async function processStsTurn(userQuestion = null, userObj = null) {
    if (!seaTurtleSoupState.isActive || seaTurtleSoupState.phase !== 'guessing') return;

    // 1. 如果有用户提问，出题人先回答
    if (userQuestion && userObj) {
      const provider = seaTurtleSoupState.riddleProvider;
      let providerAnswerResponse;
      if (provider.isUser) {
        const choice = await showChoiceModal(`Trả lời câu hỏi của ${userObj.name}: "${userQuestion}"`, [
          { text: 'Đúng', value: 'Đúng' },
          { text: 'Sai', value: 'Sai' },
          { text: 'Không liên quan', value: 'Không liên quan' },
        ]);
        providerAnswerResponse = { judgement: choice || 'Không liên quan', remark: '' };
      } else {
        providerAnswerResponse = await triggerStsAiTurn(provider, 'answer', {
          question: userQuestion,
          askerName: userObj.name,
        });
      }

      logToStsGame(providerAnswerResponse.judgement, 'answer', provider);
      if (providerAnswerResponse.remark) {
        await sleep(500);
        logToStsGame(providerAnswerResponse.remark, 'question', provider);
      }
    }

    // 2. 轮到AI玩家行动 (提问或猜测)
    const guessers = seaTurtleSoupState.players.filter(p => !p.isProvider);
    if (guessers.length === 0) return;

    for (const guesser of guessers) {
      if (guesser.isUser) continue;

      await sleep(2000 + Math.random() * 2000);

      renderSeaTurtleGameScreen({ activePlayerId: guesser.id });
      const aiAction = await triggerStsAiTurn(guesser, 'guess');

      if (aiAction.type === 'question') {
        logToStsGame(aiAction.content, 'question', guesser);
        await sleep(6000);

        const provider = seaTurtleSoupState.riddleProvider;
        let providerAnswerResponse;
        if (provider.isUser) {
          const choice = await showChoiceModal(`Trả lời câu hỏi của ${guesser.name}: "${aiAction.content}"`, [
            { text: 'Đúng', value: 'Đúng' },
            { text: 'Sai', value: 'Sai' },
            { text: 'Không liên quan', value: 'Không liên quan' },
          ]);
          providerAnswerResponse = { judgement: choice || 'Không liên quan', remark: '' };
        } else {
          providerAnswerResponse = await triggerStsAiTurn(provider, 'answer', {
            question: aiAction.content,
            askerName: guesser.name,
          });
        }

        logToStsGame(providerAnswerResponse.judgement, 'answer', provider);
        if (providerAnswerResponse.remark) {
          await sleep(500);
          logToStsGame(providerAnswerResponse.remark, 'question', provider);
        }
      } else if (aiAction.type === 'guess') {
        logToStsGame(aiAction.content, 'guess', guesser);

        let isCorrect = false;
        if (seaTurtleSoupState.riddleProvider.isUser) {
          isCorrect = await showCustomConfirm(
            'Phán định câu đoán',
            `Câu trả lời người chơi ${guesser.name} đoán là:\n\n"${aiAction.content}"\n\nCâu đoán này có đúng không?`,
          );
        } else {
          const aiEvaluation = await triggerStsAiTurn(
            seaTurtleSoupState.riddleProvider,
            'evaluate_guess',
            aiAction.content,
          );
          isCorrect = aiEvaluation.isCorrect;
        }

        if (isCorrect) {
          logToStsGame(`${guesser.name} đã đoán đúng! Trò chơi kết thúc!`, 'system', guesser);
          await revealStsAnswer();
          return;
        } else {
          logToStsGame('Không đúng rồi.', 'answer', seaTurtleSoupState.riddleProvider);
        }
      }
    }

    renderSeaTurtleGameScreen({ activePlayerId: 'user' });
    // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
    // ★ 核心修改：AI回合结束后，在操作区添加重roll按钮
    const actionArea = document.getElementById('sts-action-area');
    const mainRow = actionArea.querySelector('.chat-input-main-row');
    if (mainRow) {
      // 先检查是否已经存在，避免重复添加
      if (!document.getElementById('sts-reroll-ai-turn-btn')) {
        const rerollBtn = document.createElement('button');
        rerollBtn.id = 'sts-reroll-ai-turn-btn';
        rerollBtn.className = 'action-button';
        rerollBtn.title = 'Để các AI hỏi lại hoặc đoán lại';
        rerollBtn.style.backgroundColor = '#ff9800'; // 给它一个醒目的橙色
        rerollBtn.style.width = '40px';
        rerollBtn.style.height = '40px';
        rerollBtn.innerHTML = `<svg class="reroll-btn-icon" viewBox="0 0 24 24" style="stroke:white;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;

        // 将按钮插入到“提问”按钮的前面
        mainRow.insertBefore(rerollBtn, document.getElementById('send-sts-question-btn'));
      }
    }
    // ▲▲▲ 新增代码结束 ▲▲▲
  }

  /**
   * 【海龟汤-AI核心 V2】触发AI行动（回答、提问、判断或猜测）
   */
  async function triggerStsAiTurn(player, actionType, contextPayload = {}) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return { type: 'question', content: 'Tôi không biết nên hỏi gì nữa.' };

    let systemPrompt = '';
    const gameLogText = seaTurtleSoupState.gameLog
      .map(log => `${log.speaker}: ${log.message}`)
      .slice(-15)
      .join('\n');

    if (actionType === 'answer') {
      // 人设加强版 V3 Prompt
      systemPrompt = `
# Nhiệm vụ: Người ra đề Súp rùa (bản nhân cách nâng cao)
Bây giờ bạn 【chính là】 nhân vật "${player.name}", thiết lập nhân vật của bạn là: "${player.persona}".
Bạn là người ra đề Súp rùa, lời giải của bạn là: "${seaTurtleSoupState.answer}".
Bây giờ, người chơi "${contextPayload.askerName}" hỏi bạn: "${contextPayload.question}".

Nhiệm vụ của bạn là đưa ra phán định trước, sau đó dùng 【giọng điệu hoàn toàn đúng thiết lập nhân vật】 đưa ra một câu bổ sung tinh tế (remark) bằng tiếng Việt.

# Nguyên tắc hành xử của bạn (phải tuân thủ nghiêm ngặt)

## 1. Về phán định (Judgement)
Trường "judgement" của bạn phải chọn một trong 【bốn】 lựa chọn sau: \`Đúng\`, \`Sai\`, \`Không liên quan\`, \`Đúng một phần\`.

## 2. Về câu bổ sung (Remark)
-   **【【【Quy tắc sắt về nhân cách】】】**: Mỗi câu bổ sung của bạn đều 【bắt buộc】 là câu mà nhân vật "${player.name}" sẽ nói. Hãy nghĩ xem, một người có tính cách "${player.persona}" khi gặp câu hỏi này sẽ trả lời thế nào? Sẽ trêu chọc, sẽ động viên, sẽ làm ra vẻ thâm sâu, hay sẽ mất kiên nhẫn?
-   **Phối hợp với phán định**: Khi phán định là "Đúng một phần", câu bổ sung phải khéo léo chỉ ra phần họ đoán đúng.
-   **Đưa gợi ý (chỉ khi người chơi bị bí)**:
-   **Nhận biết bế tắc**: Khi bạn thấy 5-8 câu hỏi gần nhất phần lớn là "Không liên quan", nghĩa là người chơi có thể đã rơi vào bế tắc tư duy.
-   **Thực hiện**: Trong trường hợp này, câu bổ sung của bạn 【bắt buộc có một gợi ý định hướng】, và nói ra một cách tự nhiên bằng giọng điệu của nhân vật.

# Quy tắc sắt về định dạng
1.  Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, có hai trường "judgement" và "remark".
2.  【Tuyệt đối cấm】 dùng biểu tượng Emoji hoặc từ ngữ thoát vai trong bất kỳ câu trả lời nào.

# Ví dụ định dạng đầu ra JSON:
{
  "judgement": "",
  "remark": ""
}
Bây giờ, hãy xuất trực tiếp JSON phán định của bạn.`;
    } else if (actionType === 'evaluate_guess') {
      systemPrompt = `
# Nhiệm vụ: Người ra đề Súp rùa - Phán định câu đoán
Bạn đang đóng nhân vật "${player.name}", thiết lập là: "${player.persona}".
Bạn là người ra đề Súp rùa. Lời giải của bạn là: "${seaTurtleSoupState.answer}".
Bây giờ có người chơi đoán thẳng lời giải, nội dung là: "${contextPayload}".
Nhiệm vụ của bạn là phán định câu đoán này có 【ý chính trùng khớp】 với lời giải của bạn hay không, chỉ cần đúng 70% là được.

# Quy tắc cốt lõi
1.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng: \`{"isCorrect": true}\` hoặc \`{"isCorrect": false}\`.
2.  **Tiêu chuẩn phán định**: Chỉ cần tình tiết cốt lõi, quan hệ nhân vật, đạo cụ then chốt và kết quả cuối cùng của câu đoán trùng khớp với lời giải là được, không cần khớp từng chữ.

Bây giờ, hãy xuất trực tiếp phán định của bạn.`;
    } else {
      // 'guess'
      systemPrompt = `
# Nhiệm vụ: Người đoán Súp rùa
Bạn đang đóng nhân vật "${player.name}", thiết lập là: "${player.persona}".
Bạn đang chơi Súp rùa, cần dựa vào thông tin đã biết để đặt câu hỏi hoặc đoán lời giải.

# Thông tin trò chơi
- Đề bài: ${seaTurtleSoupState.riddle}
- Manh mối đã có (toàn bộ đoạn hội thoại):
${gameLogText}

# Quy tắc cốt lõi
1.  **【【【Quy tắc sắt về suy luận logic】】】**: Bạn 【bắt buộc】 phân tích kỹ "Manh mối đã có" phía trên, tránh đặt câu hỏi lặp lại hoặc mâu thuẫn với manh mối đã biết. Câu hỏi hoặc câu đoán của bạn nên dựa trên thông tin sẵn có, thể hiện khả năng suy luận logic.
2.  **【【【Quy tắc sắt về nhập vai nhân cách】】】**: Câu hỏi và câu đoán của bạn đều 【bắt buộc】 phù hợp thiết lập và giọng điệu của nhân vật, như người thật đang chơi. Bạn có thể thêm chút quá trình suy nghĩ hoặc cảm xúc để cuộc trò chuyện sinh động hơn. Ví dụ, bạn có thể nói: "Để tôi nghĩ xem... đã không liên quan tới địa điểm, vậy có liên quan tới thời gian không?", nói càng dài càng tốt. Viết bằng tiếng Việt.
3.  **Quyết định**: Dựa vào manh mối, quyết định đặt một câu hỏi "có/không" then chốt để thu hẹp phạm vi, hay đoán thẳng lời giải. Khi manh mối đã đủ, hãy mạnh dạn dùng chỉ thị "guess" để đoán toàn bộ câu chuyện.
4.  **【【【Quy tắc tăng tốc】】】**: Nếu đoạn hội thoại trong "Manh mối đã có" đã vượt quá 30 tin, nghĩa là trò chơi kéo dài quá lâu. Trong trường hợp này, bạn 【nên nghiêng về đoán thẳng lời giải】, thay vì tiếp tục hỏi chi tiết.
5.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt.
- Nếu đặt câu hỏi, định dạng: \`{"type": "question", "content": "câu hỏi của bạn..."}\`
- Nếu đoán, định dạng: \`{"type": "guess", "content": "toàn bộ câu chuyện bạn đoán..."}\`
6.  **Cấm Emoji**: 【Tuyệt đối cấm】 dùng biểu tượng Emoji trong bất kỳ câu trả lời nào.

Bây giờ, hãy dựa vào thiết lập nhân vật và phán đoán của bạn để tạo hành động.`;
    }
    const maxRetries = 3; // 最多重试3次
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messagesForApi = [{ role: 'user', content: 'Hãy dựa vào quy tắc bạn đọc được trong chỉ thị hệ thống và bắt đầu hành động ngay.' }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(
          model,
          apiKey,
          systemPrompt,
          messagesForApi,
          isGemini,
          state.apiConfig.temperature,
        );

        const response = isGemini
          ? await fetch(geminiConfig.url, geminiConfig.data)
          : await fetch(`${proxyUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi],
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            });

        // 【重要】如果响应状态码是429，也主动抛出错误，进入catch块进行重试
        if (response.status === 429) {
          const errorData = await response.json();
          // 构造一个和之前日志里一样的错误信息，方便我们解析
          throw new Error(JSON.stringify({ error: errorData.error }));
        }
        if (!response.ok) {
          // 对于其他错误，直接抛出
          throw new Error(`Yêu cầu API thất bại: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
          /^```json\s*|```$/g,
          '',
        );

        // 如果成功，解析并返回结果，结束函数
        return JSON.parse(content);
      } catch (error) {
        console.error(`海龟汤AI行动失败 (第 ${attempt} 次尝试):`, error.message);

        // 如果是最后一次尝试，就彻底失败，并把错误抛出去
        if (attempt === maxRetries) {
          // 将原始错误重新包装后抛出，以便外部能捕获
          throw new Error(`AI action failed after ${maxRetries} attempts: ${error.message}`);
        }

        let delay = 2000 * attempt; // 默认的指数退避延迟

        // 智能解析API建议的等待时间
        try {
          // 错误信息本身可能是一个JSON字符串，先解析它
          const errorJson = JSON.parse(error.message);
          const errorMessage = errorJson.error.message;

          // 正则表达式匹配 "retry in X.XXXXs"
          const retryMatch = errorMessage.match(/retry in (\d+\.?\d*)s/);
          if (retryMatch && retryMatch[1]) {
            // 找到了建议时间，就用它，并额外加一点点缓冲
            delay = parseFloat(retryMatch[1]) * 1000 + 500;
            console.log(`API请求过于频繁，将根据建议在 ${Math.round(delay / 1000)} 秒后重试...`);
          }
        } catch (e) {
          // 如果解析失败，说明错误信息格式不符合预期，就使用默认延迟
          console.log(`API请求失败，将在 ${Math.round(delay / 1000)} 秒后进行第 ${attempt + 1} 次重试...`);
        }

        // 等待计算出的延迟时间
        await sleep(delay);
      }
    }
    // ==========================================================
    // --- ▲▲▲ 【核心修改】到这里结束 ▲▲▲ ---
    // ==========================================================

    // 如果循环结束都没成功，返回一个备用结果，防止游戏卡死
    console.error('所有重试均失败，返回备用行动。');
    if (actionType === 'answer') return { judgement: 'Không liên quan', remark: '(AI bị chập mạch suy nghĩ rồi...)' };
    if (actionType === 'evaluate_guess') return { isCorrect: false };
    return { type: 'question', content: 'Người đó có phải con người không?' };
  }
  /**
   * 【海龟汤 V2 - 结算增强版】揭晓答案并显示结算界面
   */
  async function revealStsAnswer() {
    if (!seaTurtleSoupState.isActive) return;

    // 1. 标记游戏结束
    seaTurtleSoupState.isActive = false; // 确保游戏状态变为非激活
    seaTurtleSoupState.phase = 'reveal';

    // 2. 隐藏游戏中的操作区域
    document.getElementById('sts-action-area').style.visibility = 'hidden';

    // 3. 准备复盘内容
    const summaryText = generateStsSummary();

    // 4. 显示结算弹窗
    showStsSummaryModal(summaryText);
  }
  // ▼▼▼ 【全新】海龟汤结算与分享功能函数 ▼▼▼

  /**
   * 生成海龟汤的复盘文本
   * @returns {string} 格式化后的复盘Markdown文本
   */
  function generateStsSummary() {
    let summaryText = `**Súp rùa - Tổng kết ván**\n\n`;
    summaryText += `**Người ra đề:** ${seaTurtleSoupState.riddleProvider.name}\n\n`;
    summaryText += `**Đề bài:**\n${seaTurtleSoupState.riddle}\n\n`;
    summaryText += `**Lời giải:**\n${seaTurtleSoupState.answer}`;
    return summaryText;
  }

  /**
   * 显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showStsSummaryModal(summaryText) {
    const modal = document.getElementById('sts-summary-modal');
    const contentEl = document.getElementById('sts-summary-content');

    // 使用你已有的Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // 为按钮绑定事件 (使用克隆节点防止重复绑定)
    const shareBtn = document.getElementById('share-sts-summary-btn');
    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    newShareBtn.onclick = () => openStsShareTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-from-sts-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 打开复盘分享目标选择器
   * @param {string} summaryText - 要分享的复盘文本
   */
  function openStsShareTargetPicker(summaryText) {
    const modal = document.getElementById('sts-share-target-modal');
    const listEl = document.getElementById('sts-share-target-list');
    listEl.innerHTML = '';

    // 从游戏状态中获取所有非出题人的AI玩家
    const aiPlayers = seaTurtleSoupState.players.filter(p => !p.isUser && !p.isProvider);

    if (aiPlayers.length === 0) {
      alert('Không có người chơi AI nào để chia sẻ.');
      return;
    }

    // 渲染可选的AI玩家列表
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用样式
      item.innerHTML = `
            <input type="checkbox" class="sts-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('sts-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.sts-target-checkbox:checked')).map(cb => cb.value);
      if (selectedIds.length > 0) {
        sendStsSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Vui lòng chọn ít nhất một người để chia sẻ!');
      }
    };

    document.getElementById('sts-cancel-share-btn').onclick = () => modal.classList.remove('visible');
    document.getElementById('sts-select-all-btn').onclick = () => {
      document.querySelectorAll('.sts-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('sts-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.sts-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 将游戏复盘发送到【选定】的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendStsSummaryToSelectedPlayers(summaryText, targetIds) {
    // 关闭所有可能打开的弹窗
    document.getElementById('sts-summary-modal').classList.remove('visible');
    document.getElementById('sts-share-target-modal').classList.remove('visible');

    let sentCount = 0;
    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván Súp rùa, đây là bản tổng kết. Hãy dựa vào nội dung tổng kết này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        // 创建对用户可见的复盘卡片消息
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Súp rùa - Tổng kết ván',
          description: 'Bấm để xem tổng kết chi tiết',
          source_name: 'Trung tâm trò chơi',
          content: summaryText,
        };

        // 创建对AI可见的隐藏指令
        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('Chia sẻ thành công', `Đã chia sẻ bản tổng kết vào chat của ${sentCount} người chơi AI!`);
    showScreen('game-hall-screen');
  }

  // ▲▲▲ 新增函数结束 ▲▲▲

  /**
   * 【辅助函数】计算两个字符串的简单相似度
   */
  function simpleSimilarity(str1, str2) {
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
  }

  // ▲▲▲ 海龟汤功能函数结束 ▲▲▲

  // ▼▼▼ 【全新】这里是剧本杀游戏的所有核心功能函数 ▼▼▼

  /**
   * 【剧本杀】打开游戏设置界面
   */
  async function openScriptKillSetup() {
    showScreen('script-kill-setup-screen');

    const scriptSelect = document.getElementById('script-kill-script-select');
    scriptSelect.innerHTML = '<option value="">-- Vui lòng chọn kịch bản --</option>';

    // --- ▼▼▼ 核心修改在这里 ▼▼▼ ---

    // 1. 遍历我们创建的内置剧本库
    BUILT_IN_SCRIPTS.forEach(script => {
      const option = document.createElement('option');
      option.value = script.id; // value 是剧本的唯一ID
      option.textContent = `【Có sẵn】${script.name}`; // 显示的文本
      scriptSelect.appendChild(option);
    });

    // 2. 加载并显示自定义剧本
    const customScripts = await db.scriptKillScripts.toArray();
    customScripts.forEach(script => {
      const option = document.createElement('option');
      option.value = script.id;
      option.textContent = `【Tùy chỉnh】${script.name}`;
      scriptSelect.appendChild(option);
    });

    // --- ▲▲▲ 修改结束 ▲▲▲ ---
    // 渲染玩家选择列表
    const selectionEl = document.getElementById('script-kill-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách nhân vật...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用样式
      item.innerHTML = `
            <input type="checkbox" class="script-kill-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
  }
  // ▼▼▼ 在这里开始粘贴 ▼▼▼

  /**
   * 【剧本杀】显示角色选择弹窗，让用户选择角色
   * @param {string} title - 弹窗标题
   * @param {Array<object>} options - 角色选项数组 [{text, value}]
   * @returns {Promise<number|null>} - 返回用户选择的角色的索引，如果取消则返回null
   */
  async function showRoleSelectionModal(title, options) {
    return new Promise(resolve => {
      const modal = document.getElementById('custom-modal-overlay');
      const modalTitle = document.getElementById('custom-modal-title');
      const modalBody = document.getElementById('custom-modal-body');
      const modalConfirmBtn = document.getElementById('custom-modal-confirm');
      const modalCancelBtn = document.getElementById('custom-modal-cancel');

      modalTitle.textContent = title;

      let optionsHtml = '<div style="text-align: left; max-height: 400px; overflow-y: auto;">';
      options.forEach((option, index) => {
        optionsHtml += `
                <label style="display: block; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;">
                    <input type="radio" name="role_selection" value="${option.value}" ${index === 0 ? 'checked' : ''}>
                    ${option.text}
                </label>
            `;
      });
      optionsHtml += '</div>';

      modalBody.innerHTML = optionsHtml;
      modalConfirmBtn.textContent = 'Xác nhận chọn';
      modalCancelBtn.style.display = 'block';

      modal.classList.add('visible');

      modalConfirmBtn.onclick = () => {
        const selectedRadio = document.querySelector('input[name="role_selection"]:checked');
        if (selectedRadio) {
          modal.classList.remove('visible');
          resolve(parseInt(selectedRadio.value));
        } else {
          alert('Vui lòng chọn một vai!');
        }
      };

      modalCancelBtn.onclick = () => {
        modal.classList.remove('visible');
        resolve(null);
      };
    });
  }

  /**
   * 【剧本杀】开始游戏的核心逻辑 (V3 - 玩家自选，AI随机版)
   */
  async function startScriptKillGame() {
    const scriptId = document.getElementById('script-kill-script-select').value;
    if (!scriptId) {
      alert('Vui lòng chọn một kịch bản trước!');
      return;
    }
    // ▼▼▼ 用这块【已修复】的代码替换旧的 if/else 逻辑 ▼▼▼
    let script;
    // 【核心修改】我们不再只检查 'built_in_1'，而是检查 scriptId 是否以 'built_in_' 开头
    if (scriptId.startsWith('built_in_')) {
      // 如果是，就调用 getBuiltInScript 函数，并将正确的ID传进去
      script = getBuiltInScript(scriptId);
    } else {
      // 否则，说明是自定义剧本，才去数据库里查找
      script = await db.scriptKillScripts.get(parseInt(scriptId));
    }
    // ▲▲▲ 替换结束 ▲▲▲
    if (!script) {
      alert('Tải kịch bản thất bại!');
      return;
    }

    const selectedCheckboxes = document.querySelectorAll('.script-kill-player-checkbox:checked');
    const requiredPlayers = script.roles.length - 1;
    if (selectedCheckboxes.length !== requiredPlayers) {
      alert(`Kịch bản này cần bạn mời ${requiredPlayers} người chơi AI hoặc NPC!`);
      return;
    }

    await showCustomAlert('Vui lòng chờ...', 'Đang chia vai, vui lòng kiên nhẫn chờ...');

    // 1. 初始化游戏状态
    scriptKillGameState = {
      isActive: true,
      script: script,
      players: [],
      gamePhase: 'start',
      turnIndex: 0,
      gameLog: [],
      evidenceCounts: {},
      votes: {},
      isFreeChoice: document.getElementById('script-kill-free-choice-toggle').checked,
      discussionRound: 1, // <--- ★★★ 在这里添加这一行 ★★★
      collectedClueIds: new Set(),
    };
    // 2. 收集玩家信息 (这部分不变)
    let invitedPlayers = [];
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        invitedPlayers.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isUser: false,
        });
      } else {
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            invitedPlayers.push({
              id: npc.id,
              name: npc.name,
              avatar: npc.avatar,
              persona: npc.persona,
              isUser: false,
            });
            break;
          }
        }
      }
    });
    const userPlayer = {
      id: 'user',
      name: state.qzoneSettings.nickname || 'Tôi',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isUser: true,
      persona: 'Một người bình thường thích phá án',
    };

    // --- 3. 【核心改造】根据开关状态，执行不同的分配逻辑 ---
    const assignedRoles = new Map(); // 使用Map存储 {playerId -> roleObject}
    let remainingRoles = [...script.roles]; // 创建一个可修改的角色列表副本

    if (scriptKillGameState.isFreeChoice) {
      // --- 自由选择模式 (玩家自选，AI随机) ---

      // 3a. 用户先从所有角色中选择一个
      const roleOptions = remainingRoles.map((role, index) => ({
        text: `【${role.name}】: ${role.description.substring(0, 40)}...`,
        value: index,
      }));
      const userChoiceIndex = await showRoleSelectionModal('Hãy chọn vai của bạn', roleOptions);
      if (userChoiceIndex === null) {
        hideCustomModal();
        alert('Bạn đã hủy chọn vai, trò chơi chưa bắt đầu.');
        return;
      }
      // 从角色池中移除用户选择的角色，并分配给用户
      const userChosenRole = remainingRoles.splice(userChoiceIndex, 1)[0];
      assignedRoles.set(userPlayer.id, userChosenRole);

      // 3b. 【【【这就是本次的核心修改！】】】
      // 将剩余的角色【随机打乱】
      remainingRoles.sort(() => Math.random() - 0.5);
      // 然后【按顺序】分配给AI们
      invitedPlayers.forEach((aiPlayer, index) => {
        assignedRoles.set(aiPlayer.id, remainingRoles[index]);
      });
    } else {
      // --- 随机分配模式 (旧逻辑保持不变) ---
      const allGamePlayers = [userPlayer, ...invitedPlayers];
      allGamePlayers.sort(() => Math.random() - 0.5);
      const shuffledRoles = [...script.roles].sort(() => Math.random() - 0.5);
      allGamePlayers.forEach((player, index) => {
        assignedRoles.set(player.id, shuffledRoles[index]);
      });
    }

    // 4. 组合最终的玩家列表 (这部分不变)
    const allPlayersWithRoles = [userPlayer, ...invitedPlayers].map(player => ({
      ...player,
      role: assignedRoles.get(player.id),
      evidence: [],
    }));
    scriptKillGameState.players = allPlayersWithRoles;

    // 5. 显示身份给用户 (这部分不变)
    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    hideCustomModal();
    await showCustomAlert(
      `Vai của bạn là: 【${myPlayer.role.name}】`,
      `**Giới thiệu vai:**\n${myPlayer.role.description}\n\n**Nhiệm vụ của bạn:**\n${myPlayer.role.tasks}`,
    );

    // 6. 切换到游戏界面并开始 (这部分不变)
    showScreen('script-kill-game-screen');
    await processScriptKillTurn();
  }

  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【最终流程版】请用这整块代码，完整替换旧的 processScriptKillTurn 函数 ▼▼▼
  /**
   * 【剧本杀 V4 - 最终流程引擎】游戏主循环/引擎
   */
  async function processScriptKillTurn() {
    if (!scriptKillGameState.isActive) return;
    renderScriptKillGameScreen();

    switch (scriptKillGameState.gamePhase) {
      case 'start':
        logToScriptKillGame(`Trò chơi bắt đầu! Kịch bản: 【${scriptKillGameState.script.name}】`, 'system');
        await sleep(1000);
        logToScriptKillGame(`【Bối cảnh câu chuyện】\n${scriptKillGameState.script.storyBackground}`, 'system');
        await sleep(3000);
        logToScriptKillGame('Mời các người chơi xem thông tin vai của mình, chuẩn bị tự giới thiệu.', 'system');
        scriptKillGameState.gamePhase = 'introduction';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'introduction':
        logToScriptKillGame('Bây giờ bắt đầu lần lượt tự giới thiệu.', 'system');
        for (const player of scriptKillGameState.players) {
          renderScriptKillGameScreen({ speakingPlayerId: player.id });
          let introduction = player.isUser
            ? await waitForUserActionSK('Tới lượt bạn tự giới thiệu', 'speak', 'Giới thiệu ngắn về bản thân và vai bạn đóng...')
            : await triggerScriptKillAiAction(player.id, 'introduce');
          logToScriptKillGame({ player: player, speech: introduction }, 'speech');
          await sleep(1000);
        }
        renderScriptKillGameScreen();
        logToScriptKillGame('Phần tự giới thiệu kết thúc, giờ mời các người chơi chia sẻ dòng thời gian của mình.', 'system');
        scriptKillGameState.gamePhase = 'timeline_discussion';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'timeline_discussion':
        logToScriptKillGame('Mời các người chơi lần lượt phát biểu, sắp xếp và công khai dòng thời gian của mình.', 'system');
        await sleep(1500);
        for (const player of scriptKillGameState.players) {
          renderScriptKillGameScreen({ speakingPlayerId: player.id });
          let timelineSpeech = player.isUser
            ? await waitForUserActionSK('Tới lượt bạn trình bày dòng thời gian', 'speak', 'Hãy dựa vào kịch bản của bạn để trình bày chi tiết lộ trình hành động...')
            : await triggerScriptKillAiAction(player.id, 'discuss_timeline');
          logToScriptKillGame({ player: player, speech: timelineSpeech }, 'speech');
          await sleep(1000);
        }
        renderScriptKillGameScreen();
        logToScriptKillGame('Phần trình bày dòng thời gian kết thúc, giờ bước vào 【vòng tìm chứng cứ thứ nhất】.', 'system');
        scriptKillGameState.gamePhase = 'evidence_round_1';
        await processScriptKillTurn();
        break;

      case 'evidence_round_1':
        updateActionAreaSK();
        logToScriptKillGame('Bước vào vòng tìm chứng cứ thứ nhất, mỗi người chơi có 【2 lần】 tìm chứng cứ.', 'system');
        await sleep(2000);

        // 【核心修改】AI 进行第一轮的第1次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          logToScriptKillGame(`Tới lượt ${player.role.name} (${player.name}) tìm chứng cứ lần 1...`);
          await sleep(2000);
          await handleAiSearch(player);
        }
        // 【核心修改】AI 进行第一轮的第2次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          logToScriptKillGame(`Tới lượt ${player.role.name} (${player.name}) tìm chứng cứ lần 2...`);
          await sleep(2000);
          await handleAiSearch(player);
        }
        logToScriptKillGame('Tất cả AI đã tìm chứng cứ xong, người chơi có thể tìm tiếp hoặc kết thúc phần này để vào thảo luận.', 'system');
        break;

      case 'discussion_round_1':
        logToScriptKillGame('Vòng tìm chứng cứ thứ nhất kết thúc, giờ bước vào 【vòng thảo luận thứ nhất】.', 'system');
        updateActionAreaSK();
        break;

      case 'evidence_round_2':
        updateActionAreaSK();
        logToScriptKillGame('Vòng thảo luận thứ nhất kết thúc, giờ bước vào 【vòng tìm chứng cứ thứ hai】.', 'system');
        logToScriptKillGame('Dựa vào cuộc thảo luận vừa rồi, mỗi người chơi còn 【1 lần】 tìm chứng cứ.', 'system');
        await sleep(2000);

        // 【核心修改】AI 进行第二轮的唯一次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          const searchCount = scriptKillGameState.evidenceCounts[player.id] || 0;
          if (searchCount < 3) {
            // 确保AI也有次数限制
            logToScriptKillGame(`Tới lượt ${player.role.name} (${player.name}) tìm chứng cứ bổ sung...`);
            await sleep(2000);
            await handleAiSearch(player);
          }
        }
        logToScriptKillGame('Tất cả AI đã tìm chứng cứ bổ sung xong, người chơi có thể tìm tiếp hoặc kết thúc phần này để vào thảo luận cuối cùng.', 'system');
        break;

      // 【全新阶段】第二轮讨论
      case 'discussion_round_2':
        logToScriptKillGame('Vòng tìm chứng cứ thứ hai kết thúc, giờ bước vào 【vòng thảo luận thứ hai】.', 'system');
        updateActionAreaSK(); // 显示发言按钮
        break;

      // 【全新阶段】第三轮（最终）讨论
      case 'discussion_round_3':
        logToScriptKillGame('Vòng thảo luận thứ hai kết thúc, giờ bước vào 【vòng thảo luận cuối cùng】.', 'system');
        updateActionAreaSK(); // 再次显示发言按钮
        break;

      case 'voting':
        // 投票和结束逻辑保持不变
        logToScriptKillGame('Thảo luận cuối cùng kết thúc, giờ bước vào phần bỏ phiếu. Hãy bỏ phiếu chỉ ra hung thủ!', 'system');
        const detailedVotes = {};
        const alivePlayers = scriptKillGameState.players;
        for (const voter of alivePlayers) {
          let targetId = voter.isUser
            ? await waitForUserActionSK('Hãy bỏ phiếu chỉ ra hung thủ', 'vote')
            : await triggerScriptKillAiAction(voter.id, 'vote');
          detailedVotes[voter.id] = targetId;
          if (targetId) {
            const targetPlayer = scriptKillGameState.players.find(p => p.id === targetId);
            logToScriptKillGame(`${voter.name} đã bỏ phiếu cho ${targetPlayer.name}.`);
          } else {
            logToScriptKillGame(`${voter.name} đã bỏ phiếu trắng.`);
          }
        }
        scriptKillGameState.votes = detailedVotes;
        scriptKillGameState.gamePhase = 'end';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'end':
        // 结束逻辑保持不变
        logToScriptKillGame('Bỏ phiếu kết thúc, đang công bố sự thật...', 'system');
        await sleep(2000);
        const voteCounts = {};
        for (const voterId in scriptKillGameState.votes) {
          const targetId = scriptKillGameState.votes[voterId];
          if (targetId) {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
          }
        }
        let maxVotes = 0,
          votedPlayerIds = [];
        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            votedPlayerIds = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            votedPlayerIds.push(playerId);
          }
        }
        const killer = scriptKillGameState.players.find(p => p.role.isKiller);
        let winner = '',
          resultText = '';
        if (votedPlayerIds.length === 1 && votedPlayerIds[0] === killer.id) {
          winner = 'Phe tốt';
          resultText = `Chúc mừng! Các bạn đã chỉ ra đúng hung thủ 【${killer.role.name} (${killer.name})】! Phe tốt chiến thắng!`;
        } else {
          winner = 'Phe hung thủ';
          resultText = `Rất tiếc, hung thủ thật sự là 【${killer.role.name} (${killer.name})】! Phe hung thủ chiến thắng!`;
        }
        logToScriptKillGame(resultText, 'system');
        await sleep(3000);
        logToScriptKillGame(`【Sự thật】\n${scriptKillGameState.script.truth}`, 'system');
        await showCustomAlert('Vui lòng chờ...', 'AI đang tạo tóm tắt tổng kết ván này...');
        const aiSummary = await generateAiSkSummary();
        const summary = generateSkSummary(winner, aiSummary);
        showScriptKillSummaryModal(summary);
        scriptKillGameState.isActive = false;
        updateActionAreaSK();
        break;
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀的重roll功能核心函数 ▼▼▼
  /**
   * 【剧本杀】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleScriptKillReroll(logIndex) {
    const logEntry = scriptKillGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || !logEntry.message.player || logEntry.message.player.isUser) {
      return; // 安全检查，确保操作的是AI的发言
    }

    const playerToReroll = logEntry.message.player;

    // 给用户一个即时反馈
    const speechTextElement = document
      .querySelector(`button.sk-reroll-btn[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>Đang suy nghĩ lại...</i>';
    }

    try {
      // 根据游戏阶段智能判断AI应该执行哪个动作
      let actionType;
      const currentPhase = scriptKillGameState.gamePhase;
      if (currentPhase === 'introduction') {
        actionType = 'introduce';
      } else if (currentPhase === 'timeline_discussion') {
        actionType = 'discuss_timeline';
      } else {
        actionType = 'discuss'; // 默认为自由讨论
      }

      // 重新调用AI生成新的发言
      const newSpeech = await triggerScriptKillAiAction(playerToReroll.id, actionType);

      // 用新的发言内容替换掉旧的
      scriptKillGameState.gameLog[logIndex].message.speech = newSpeech;

      // 重新渲染整个游戏界面以显示更新
      renderScriptKillGameScreen();
    } catch (error) {
      console.error('剧本杀发言重roll失败:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">Tạo lại thất bại, hãy kiểm tra mạng hoặc cài đặt API.</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【剧本杀】用这块【已添加重roll按钮】的代码，完整替换旧的 renderScriptKillGameScreen 函数 ▼▼▼
  /**
   * 【剧本杀】渲染游戏主界面
   */
  function renderScriptKillGameScreen(options = {}) {
    const playersGrid = document.getElementById('script-kill-players-grid');
    const logContainer = document.getElementById('script-kill-game-log');

    playersGrid.innerHTML = '';
    scriptKillGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${options.speakingPlayerId === player.id ? 'speaking' : ''}`;

      seat.innerHTML = `
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.role.name}</span>
        `;
      playersGrid.appendChild(seat);
    });

    logContainer.innerHTML = '';
    scriptKillGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      // ★ 核心修改2：判断是否是AI的发言
      if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;

        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="speaker">${player.role.name} (${player.name})</span>
<button class="sk-reroll-btn" data-log-index="${index}" title="Tạo lại lời phát biểu" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                        <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else if (log.type === 'speech') {
        // 用户的发言保持原样
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <span class="speaker">${player.role.name} (${player.name})</span>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else {
        // 其他系统消息也保持原样
        logEl.className = `log-entry ${log.type}`;
        logEl.innerHTML = String(log.message).replace(/\n/g, '<br>');
      }
      logContainer.appendChild(logEl);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【剧本杀】添加一条游戏日志
   */
  function logToScriptKillGame(message, type = 'system') {
    scriptKillGameState.gameLog.push({ message, type });
    renderScriptKillGameScreen();
  }

  /**
   * 【剧本杀 V4 - 新流程版】更新底部操作区域的按钮
   */
  function updateActionAreaSK() {
    const actionArea = document.getElementById('script-kill-action-area');
    actionArea.innerHTML = '';
    const user = scriptKillGameState.players.find(p => p.isUser);

    const phase = scriptKillGameState.gamePhase;
    const searchCount = scriptKillGameState.evidenceCounts[user.id] || 0;

    if (phase === 'evidence_round_1' || phase === 'evidence_round_2') {
      let searchesLeftInRound, totalInRound;
      if (phase === 'evidence_round_1') {
        searchesLeftInRound = 2 - searchCount;
        totalInRound = 2;
      } else {
        // evidence_round_2
        searchesLeftInRound = 3 - searchCount;
        totalInRound = 1;
      }

      const searchBtn = document.createElement('button');
      searchBtn.id = 'sk-search-evidence-btn';
      searchBtn.className = 'form-button';
      searchBtn.textContent = `Tìm chứng cứ (${searchesLeftInRound}/${totalInRound})`;
      searchBtn.disabled = searchesLeftInRound <= 0;
      actionArea.appendChild(searchBtn);

      const endSearchBtn = document.createElement('button');
      endSearchBtn.id = 'sk-end-search-btn';
      endSearchBtn.className = 'form-button-secondary';
      endSearchBtn.textContent = phase === 'evidence_round_1' ? 'Vào vòng thảo luận thứ nhất' : 'Vào vòng thảo luận thứ hai';
      actionArea.appendChild(endSearchBtn);
    } else if (phase === 'discussion_round_1' || phase === 'discussion_round_2' || phase === 'discussion_round_3') {
      const speakBtn = document.createElement('button');
      speakBtn.id = 'sk-speak-btn';
      speakBtn.className = 'form-button';
      speakBtn.textContent = 'Tôi muốn phát biểu';
      actionArea.appendChild(speakBtn);
    } else if (!scriptKillGameState.isActive && phase === 'end') {
      const backBtn = document.createElement('button');
      backBtn.className = 'form-button';
      backBtn.textContent = 'Về sảnh trò chơi';
      backBtn.onclick = () => showScreen('game-hall-screen');
      actionArea.appendChild(backBtn);
    }
  }

  // ▼▼▼ 【剧本杀输入框美化版】请用这个【全新】的函数，完整替换掉你旧的 waitForUserActionSK 函数 ▼▼▼
  /**
   * 【剧本杀 V2 - 输入框美化版】等待用户行动的通用函数
   */
  function waitForUserActionSK(promptText, actionType, placeholder = '') {
    return new Promise(resolve => {
      const actionArea = document.getElementById('script-kill-action-area');
      actionArea.innerHTML = '';
      actionArea.className = 'script-kill-action-area'; // 重置class

      if (actionType === 'speak') {
        // --- 这是我们美化后的发言输入区 ---
        actionArea.classList.add('speaking-mode'); // 激活新CSS

        const textarea = document.createElement('textarea');
        textarea.id = 'user-sk-speech-input'; // 使用剧本杀专用的ID
        textarea.rows = 1;
        textarea.placeholder = placeholder || 'Nhập lời phát biểu của bạn...';
        // 实时调整高度
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });

        const endBtn = document.createElement('button');
        endBtn.id = 'sk-end-speech-btn'; // 使用剧本杀专用的ID
        endBtn.className = 'form-button';
        endBtn.textContent = 'Kết thúc phát biểu';

        actionArea.appendChild(textarea);
        actionArea.appendChild(endBtn);

        textarea.focus();

        endBtn.onclick = () => {
          const speech = textarea.value.trim() || 'Tôi chẳng có gì để nói, qua.';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
        return; // 结束 'speak' 分支
      }

      // --- 以下是投票逻辑，保持原样 ---
      else if (actionType === 'vote') {
        const modal = document.getElementById('script-kill-vote-modal');
        const optionsEl = document.getElementById('sk-vote-options-list');
        optionsEl.innerHTML = '';

        scriptKillGameState.players.forEach(player => {
          const label = document.createElement('label');
          label.innerHTML = `<input type="radio" name="sk_vote_target" value="${player.id}"> ${player.role.name} (${player.name})`;
          optionsEl.appendChild(label);
        });

        document.getElementById('confirm-sk-vote-btn').onclick = () => {
          const selected = document.querySelector('input[name="sk_vote_target"]:checked');
          if (selected) {
            modal.classList.remove('visible');
            resolve(selected.value);
          } else {
            alert('Vui lòng chọn một đối tượng để bỏ phiếu!');
          }
        };
        document.getElementById('cancel-sk-vote-btn').onclick = () => {
          modal.classList.remove('visible');
          resolve(null); // 用户取消
        };
        modal.classList.add('visible');
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲
  /**
   * 【全新】处理单个AI的搜证行动 (每次只搜一个线索)
   * @param {object} player - 正在行动的AI玩家对象
   */
  async function handleAiSearch(player) {
    const script = scriptKillGameState.script;

    // 消耗一次搜证机会
    scriptKillGameState.evidenceCounts[player.id] = (scriptKillGameState.evidenceCounts[player.id] || 0) + 1;

    let foundMessage = ''; // 用于记录本轮搜证的结果

    // 1. 增加随机性：有30%的几率什么都搜不到
    if (Math.random() < 0.3) {
      foundMessage = 'Không phát hiện được gì.';
    } else {
      // 2. 找出所有【全局还未被发现】的线索
      const uncollectedClues = script.clues.filter(c => !scriptKillGameState.collectedClueIds.has(c.description));

      if (uncollectedClues.length > 0) {
        // 3. 随机找到一条新线索
        const foundClue = uncollectedClues[Math.floor(Math.random() * uncollectedClues.length)];
        const clueSource = foundClue.owner === 'Chung' ? 'Khu vực chung' : `Đồ vật riêng của vai ${foundClue.owner}`;

        // 4. 将线索存入AI手牌和全局线索池
        player.evidence.push({ description: foundClue.description, source: clueSource });
        scriptKillGameState.collectedClueIds.add(foundClue.description);

        let revealed = true; // 默认公开

        // 5. 如果线索是关于自己的，让AI决策是否公开
        if (foundClue.owner === player.role.name) {
          const revealDecision = await triggerScriptKillAiAction(player.id, 'reveal_clue', {
            clue: foundClue.description,
          });
          if (revealDecision && revealDecision.action === 'hide') {
            revealed = false;
          }
        }

        // 6. 根据AI的决策，记录不同的搜证结果
        if (revealed) {
          foundMessage = `Đã phát hiện và công khai manh mối tại 【${clueSource}】: "${foundClue.description}"`;
        } else {
          foundMessage = `Đã phát hiện một manh mối về bản thân tại 【${clueSource}】, và chọn giấu nó đi.`;
        }
      } else {
        foundMessage = 'Không phát hiện thêm manh mối mới nào.';
      }
    }

    // 7. 将搜证结果记录到游戏日志
    logToScriptKillGame(`${player.name} đã hoàn thành một lần tìm chứng cứ: ${foundMessage}`);
    await sleep(1500);
  }

  /**
   * 【剧本杀-AI核心】触发AI行动
   */
  async function triggerScriptKillAiAction(playerId, action, context = {}) {
    const player = scriptKillGameState.players.find(p => p.id === playerId);
    if (!player) return;

    const { proxyUrl, apiKey, model } = state.apiConfig;

    // ▼▼▼ 请用下面这【一整块】代码，完整替换掉旧的 systemPrompt 变量定义 ▼▼▼
    let jsonFormat = '';
    let extraContext = '';
    let systemPrompt = `
# Nhiệm vụ: Nhập vai kịch bản giết người
# Danh tính kép của bạn (phải tuân thủ nghiêm ngặt)
1.  **Bản thể của bạn**: Danh tính thật của bạn là **${player.name}**, tính cách cốt lõi là: **${player.persona}**.
2.  **Vai của bạn trong kịch bản**: Trong trò chơi này, bạn cần đóng vai **【${player.role.name}】**.
-   **Thiết lập thân phận trong kịch bản**: ${player.role.description}
-   **Tuyến truyện của bạn (dòng thời gian)**: ${player.role.storyline}
-   **Nhiệm vụ bí mật trong kịch bản**: ${player.role.tasks}

# Manh mối bạn đã nắm:
${player.evidence.map(e => `- ${e.description}`).join('\n') || '(Chưa có manh mối)'}

# Giai đoạn trò chơi hiện tại: ${scriptKillGameState.gamePhase}
# Nhật ký trò chơi (50 dòng gần nhất):
${scriptKillGameState.gameLog
  .slice(-50)
  .map(log => {
    if (log.type === 'speech') return `${log.message.player.role.name}: ${log.message.speech}`;
    return log.message;
  })
  .join('\n')}
${extraContext}
# Chỉ thị hành động của bạn (phát biểu bằng tiếng Việt)
`;

    // ▲▲▲ 替换结束 ▲▲▲

    switch (action) {
      case 'introduce':
        systemPrompt += 'Bây giờ tới lượt bạn tự giới thiệu. Hãy dựa vào thiết lập nhân vật, giới thiệu ngắn ở ngôi thứ nhất.';
        jsonFormat = '{"action": "speak", "speech": "lời tự giới thiệu của bạn..."}';
        break;
      // ▼▼▼ 【全新】在这里为AI添加“讨论时间线”的新指令 ▼▼▼
      case 'discuss_timeline':
        systemPrompt +=
          'Bây giờ là phần trình bày dòng thời gian. Hãy dựa vào kịch bản vai của bạn (gồm thiết lập thân phận và nhiệm vụ bí mật) để trình bày chi tiết, rõ ràng lộ trình hành động của bạn trong khoảng thời gian xảy ra vụ án. Lời phát biểu phải ở ngôi thứ nhất và nghe tự nhiên, có thể giấu bớt thông tin bất lợi cho bạn, nhưng không được bịa đặt vô căn cứ.';
        jsonFormat = '{"action": "speak", "speech": "lời trình bày dòng thời gian của bạn..."}';
        break;
      // ▲▲▲ 新增指令结束 ▲▲▲
      case 'discuss':
        systemPrompt += 'Bây giờ là phần thảo luận tự do. Hãy dựa vào manh mối bạn nắm được và lời phát biểu của những người khác để bày tỏ quan điểm, đặt nghi vấn hoặc chỉ ra người khác.';
        jsonFormat = '{"action": "speak", "speech": "lời phát biểu của bạn..."}';
        break;
      case 'vote':
        systemPrompt += 'Bây giờ là phần bỏ phiếu cuối cùng. Hãy tổng hợp mọi thông tin, bỏ phiếu cho người bạn cho là hung thủ.';
        jsonFormat = '{"action": "vote", "targetId": "ID người chơi bạn bỏ phiếu"}';
        break;
      // ▼▼▼ 在 triggerScriptKillAiAction 函数的 switch 语句内添加这个 case ▼▼▼
      case 'reveal_clue':
        systemPrompt += `Bạn vừa tìm được một manh mối về chính mình: "${context.clue}".\nCông khai manh mối này có thể khiến bạn bị lộ, nhưng cũng có thể rửa sạch nghi ngờ; giấu nó đi có thể khiến bạn bị động về sau.\nHãy dựa vào thiết lập nhân vật và nhiệm vụ để quyết định công khai hay giấu.`;
        jsonFormat = '{"action": "reveal" or "hide", "reasoning": "lý do quyết định của bạn..."}';
        break;
      // ▲▲▲ 添加结束 ▲▲▲
    }

    systemPrompt += `\n# Danh sách người chơi còn sống:\n${scriptKillGameState.players
      .map(p => `- ${p.role.name} (id: ${p.id})`)
      .join('\n')}\n# Định dạng đầu ra: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:\n${jsonFormat}`;

    try {
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      // ▼▼▼ 用这块新代码替换旧的 return 逻辑 ▼▼▼
      const aiAction = JSON.parse(content);

      if (aiAction.action === 'speak') return aiAction.speech;
      if (aiAction.action === 'vote') return aiAction.targetId;
      if (action === 'reveal_clue') return aiAction; // 【核心修改】返回整个决策对象

      return null;
      // ▲▲▲ 替换结束 ▲▲▲
    } catch (error) {
      console.error(`AI (${player.name}) 行动失败:`, error);
      // 返回一个保底的行动，防止游戏卡死
      if (action === 'vote') {
        const potentialTargets = scriptKillGameState.players.filter(p => p.id !== player.id);
        return potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
      }
      return 'Tôi... tôi cần nghĩ thêm chút nữa.';
    }
  }

  // ▼▼▼ 用这块新代码替换旧的 getBuiltInScript 函数 ▼▼▼

  /**
   * 【剧本杀】根据ID获取一个内置剧本
   * @param {string} scriptId - 要获取的剧本的ID, 例如 'built_in_1'
   * @returns {object|null} - 找到的剧本对象，或 null
   */
  function getBuiltInScript(scriptId) {
    // 【核心修改】我们现在从 BUILT_IN_SCRIPTS 数组中查找匹配的剧本
    return BUILT_IN_SCRIPTS.find(script => script.id === scriptId) || null;
  }

  // ▲▲▲ 替换结束 ▲▲▲

  // --- 【全新】剧本杀自定义剧本管理核心功能 ---

  let editingScriptId = null; // 用于追踪正在编辑的剧本ID

  /**
   * 【总入口】打开自定义剧本管理模态框
   */
  async function openScriptManager() {
    await renderScriptManagerList();
    document.getElementById('script-kill-manager-modal').classList.add('visible');
  }

  /**
   * 渲染自定义剧本列表
   */
  async function renderScriptManagerList() {
    const listEl = document.getElementById('custom-scripts-list');
    listEl.innerHTML = '';
    const scripts = await db.scriptKillScripts.toArray();

    if (scripts.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa có kịch bản tùy chỉnh nào, bấm "Thêm" ở góc trên bên phải để tạo một kịch bản nhé!</p>';
      return;
    }

    scripts.forEach(script => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="item-title">${script.name}</div>
        <div class="item-content">${(script.storyBackground || 'Chưa có giới thiệu').substring(0, 50)}...</div>
    `;

      item.addEventListener('click', () => openScriptEditorForEdit(script.id));

      addLongPressListener(item, async () => {
        // ▼▼▼ 核心修改：在菜单里增加 'export' 选项 ▼▼▼
        const choice = await showChoiceModal(`Thao tác với 《${script.name}》`, [
          { text: '📤 Xuất kịch bản', value: 'export' }, // <-- 新增
          { text: '🗑️ Xóa kịch bản', value: 'delete', isDanger: true },
        ]);

        if (choice === 'delete') {
          deleteCustomScript(script.id, script.name);
        } else if (choice === 'export') {
          // <-- 新增处理逻辑
          await exportCustomScript(script.id);
        }
        // ▲▲▲ 修改结束 ▲▲▲
      });
      listEl.appendChild(item);
    });
  }

  /**
   * 打开剧本编辑器（用于创建新剧本）
   */
  function openScriptEditorForCreate() {
    editingScriptId = null; // 标记为创建模式
    document.getElementById('script-editor-title').textContent = 'Tạo kịch bản mới';
    document.getElementById('script-name-input').value = '';
    document.getElementById('script-background-input').value = '';
    // 提供一个JSON结构示例，方便用户填写
    const jsonExample = {
      roles: [
        { name: 'Nhân vật A', description: '...', tasks: '...', isKiller: true },
        { name: 'Nhân vật B', description: '...', tasks: '...', isKiller: false },
      ],
      clues: [
        { owner: 'Nhân vật A', description: 'Mô tả manh mối...', isKey: false },
        { owner: 'Chung', description: 'Manh mối chung...' },
      ],
      truth: 'Sự thật là...',
    };
    document.getElementById('script-roles-json-input').value = JSON.stringify(jsonExample, null, 2);

    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  /**
   * 打开剧本编辑器（用于编辑现有剧本）
   * @param {number} scriptId - 要编辑的剧本ID
   */
  async function openScriptEditorForEdit(scriptId) {
    editingScriptId = scriptId;
    const script = await db.scriptKillScripts.get(scriptId);
    if (!script) return;

    document.getElementById('script-editor-title').textContent = `Sửa kịch bản: ${script.name}`;
    document.getElementById('script-name-input').value = script.name;
    document.getElementById('script-background-input').value = script.storyBackground;

    // 将 roles, clues, truth 重新组合成一个对象并格式化为JSON
    const jsonData = {
      roles: script.roles,
      clues: script.clues,
      truth: script.truth,
    };
    document.getElementById('script-roles-json-input').value = JSON.stringify(jsonData, null, 2);

    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  // ▼▼▼ 用这块【可视化版】代码，替换旧的 saveCustomScript 函数 ▼▼▼
  /**
   * 【可视化版】保存或更新自定义剧本
   */
  async function saveCustomScript() {
    const name = document.getElementById('script-name-input').value.trim();
    const background = document.getElementById('script-background-input').value.trim();
    const truth = document.getElementById('sk-truth-input').value.trim();

    if (!name || !background || !truth) {
      alert('Tên kịch bản, bối cảnh câu chuyện và sự thật cuối cùng đều không được để trống!');
      return;
    }

    // 从 currentEditingScriptData 全局变量中获取角色和线索数据
    if (!currentEditingScriptData.roles || currentEditingScriptData.roles.length === 0) {
      alert('Vui lòng thêm ít nhất một vai!');
      return;
    }

    try {
      const scriptData = {
        name: name,
        storyBackground: background,
        roles: currentEditingScriptData.roles,
        clues: currentEditingScriptData.clues,
        truth: truth,
        isBuiltIn: false,
      };

      if (editingScriptId) {
        await db.scriptKillScripts.update(editingScriptId, scriptData);
        alert('Cập nhật kịch bản thành công!');
      } else {
        await db.scriptKillScripts.add(scriptData);
        alert('Lưu kịch bản mới thành công!');
      }

      document.getElementById('script-kill-editor-modal').classList.remove('visible');
      await renderScriptManagerList(); // 刷新管理列表
      editingScriptId = null;
    } catch (error) {
      alert(`Lưu thất bại: ${error.message}`);
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 把这一整块全新的功能函数，粘贴到 init() 函数的【正上方】 ▼▼▼

  // --- 【全新】剧本杀可视化编辑器核心功能 ---

  let currentEditingScriptData = { roles: [], clues: [] }; // 用于暂存正在编辑的剧本数据
  let editingItemIndex = -1; // -1 表示新建，否则为被编辑项的索引

  /**
   * 渲染可视化剧本编辑器的主界面
   */
  function renderVisualScriptEditor() {
    const rolesContainer = document.getElementById('sk-roles-container');
    const cluesContainer = document.getElementById('sk-clues-container');
    rolesContainer.innerHTML = '';
    cluesContainer.innerHTML = '';

    // 渲染角色列表
    currentEditingScriptData.roles.forEach((role, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'sk-editor-item';
      itemEl.innerHTML = `
            <div class="item-info">
                <div class="item-name">${role.name} ${role.isKiller ? '🔪' : ''}</div>
                <div class="item-meta">${role.description.substring(0, 20)}...</div>
            </div>
            <div class="item-actions">
<button class="form-button-secondary edit-role-btn" data-index="${index}">Sửa</button>
<button class="form-button-secondary delete-role-btn" data-index="${index}" style="border-color:#ff3b30; color:#ff3b30;">Xóa</button>
            </div>
        `;
      rolesContainer.appendChild(itemEl);
    });

    // 渲染线索列表
    currentEditingScriptData.clues.forEach((clue, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'sk-editor-item';
      itemEl.innerHTML = `
            <div class="item-info">
<div class="item-name">Manh mối ${index + 1}</div>
<div class="item-meta">Thuộc về: ${clue.owner}</div>
            </div>
            <div class="item-actions">
<button class="form-button-secondary edit-clue-btn" data-index="${index}">Sửa</button>
<button class="form-button-secondary delete-clue-btn" data-index="${index}" style="border-color:#ff3b30; color:#ff3b30;">Xóa</button>
            </div>
        `;
      cluesContainer.appendChild(itemEl);
    });
  }

  /**
   * 打开角色编辑器（新建或编辑）
   */
  function openRoleEditor(index = -1) {
    editingItemIndex = index;
    const modal = document.getElementById('sk-item-editor-modal');
    document.getElementById('sk-role-editor-fields').style.display = 'block';
    document.getElementById('sk-clue-editor-fields').style.display = 'none';

    if (index > -1) {
      // 编辑模式
      const role = currentEditingScriptData.roles[index];
      document.getElementById('sk-item-editor-title').textContent = `Sửa vai: ${role.name}`;
      document.getElementById('sk-role-name-input').value = role.name;
      document.getElementById('sk-role-desc-input').value = role.description;
      // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
      document.getElementById('sk-role-storyline-input').value = role.storyline || ''; // 使用 || '' 确保旧数据不会显示'undefined'
      // ▲▲▲ 新代码粘贴结束 ▲▲▲
      document.getElementById('sk-role-tasks-input').value = role.tasks;
      document.getElementById('sk-role-killer-toggle').checked = role.isKiller;
    } else {
      // 新建模式
      document.getElementById('sk-item-editor-title').textContent = 'Thêm vai mới';
      document.getElementById('sk-role-name-input').value = '';
      document.getElementById('sk-role-desc-input').value = '';
      // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
      document.getElementById('sk-role-storyline-input').value = ''; // 新建时清空
      // ▲▲▲ 新代码粘贴结束 ▲▲▲
      document.getElementById('sk-role-tasks-input').value = '';
      document.getElementById('sk-role-killer-toggle').checked = false;
    }
    modal.classList.add('visible');
  }

  /**
   * 打开线索编辑器（新建或编辑）
   */
  function openClueEditor(index = -1) {
    editingItemIndex = index;
    const modal = document.getElementById('sk-item-editor-modal');
    document.getElementById('sk-role-editor-fields').style.display = 'none';
    document.getElementById('sk-clue-editor-fields').style.display = 'block';

    // 动态填充线索归属的下拉菜单
    const ownerSelect = document.getElementById('sk-clue-owner-select');
    ownerSelect.innerHTML = '<option value="Chung">Manh mối chung</option>';
    currentEditingScriptData.roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.name;
      option.textContent = `Vai: ${role.name}`;
      ownerSelect.appendChild(option);
    });

    if (index > -1) {
      // 编辑模式
      const clue = currentEditingScriptData.clues[index];
      document.getElementById('sk-item-editor-title').textContent = `Sửa manh mối ${index + 1}`;
      ownerSelect.value = clue.owner;
      document.getElementById('sk-clue-desc-input').value = clue.description;
      document.getElementById('sk-clue-key-toggle').checked = clue.isKey || false;
    } else {
      // 新建模式
      document.getElementById('sk-item-editor-title').textContent = 'Thêm manh mối mới';
      ownerSelect.value = 'Chung';
      document.getElementById('sk-clue-desc-input').value = '';
      document.getElementById('sk-clue-key-toggle').checked = false;
    }
    modal.classList.add('visible');
  }

  /**
   * 保存子编辑器（角色或线索）中的数据
   */
  function saveItemFromEditor() {
    const isRoleEditor = document.getElementById('sk-role-editor-fields').style.display === 'block';

    if (isRoleEditor) {
      const roleData = {
        name: document.getElementById('sk-role-name-input').value.trim(),
        description: document.getElementById('sk-role-desc-input').value.trim(),
        // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
        storyline: document.getElementById('sk-role-storyline-input').value.trim(),
        // ▲▲▲ 新代码粘贴结束 ▲▲▲
        tasks: document.getElementById('sk-role-tasks-input').value.trim(),
        isKiller: document.getElementById('sk-role-killer-toggle').checked,
      };
      if (!roleData.name) {
        alert('Tên vai không được để trống!');
        return;
      }

      if (editingItemIndex > -1) {
        currentEditingScriptData.roles[editingItemIndex] = roleData;
      } else {
        currentEditingScriptData.roles.push(roleData);
      }
    } else {
      const clueData = {
        owner: document.getElementById('sk-clue-owner-select').value,
        description: document.getElementById('sk-clue-desc-input').value.trim(),
        isKey: document.getElementById('sk-clue-key-toggle').checked,
      };
      if (!clueData.description) {
        alert('Mô tả manh mối không được để trống!');
        return;
      }

      if (editingItemIndex > -1) {
        currentEditingScriptData.clues[editingItemIndex] = clueData;
      } else {
        currentEditingScriptData.clues.push(clueData);
      }
    }

    document.getElementById('sk-item-editor-modal').classList.remove('visible');
    renderVisualScriptEditor(); // 刷新主编辑器界面
  }

  /**
   * 替换 openScriptEditorForCreate 函数
   */
  function openScriptEditorForCreate() {
    editingScriptId = null;
    currentEditingScriptData = { roles: [], clues: [] }; // 清空暂存数据
    document.getElementById('script-editor-title').textContent = 'Tạo kịch bản mới';
    document.getElementById('script-name-input').value = '';
    document.getElementById('script-background-input').value = '';
    document.getElementById('sk-truth-input').value = '';
    renderVisualScriptEditor(); // 渲染空的编辑器
    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  /**
   * 替换 openScriptEditorForEdit 函数
   */
  async function openScriptEditorForEdit(scriptId) {
    editingScriptId = scriptId;
    const script = await db.scriptKillScripts.get(scriptId);
    if (!script) return;

    // 将数据库数据加载到暂存对象
    currentEditingScriptData = {
      roles: script.roles || [],
      clues: script.clues || [],
    };

    document.getElementById('script-editor-title').textContent = `Sửa kịch bản: ${script.name}`;
    document.getElementById('script-name-input').value = script.name;
    document.getElementById('script-background-input').value = script.storyBackground;
    document.getElementById('sk-truth-input').value = script.truth;

    renderVisualScriptEditor(); // 渲染带有数据的编辑器
    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  // --- ▲▲▲ 新增功能函数结束 ▲▲▲

  /**
   * 删除一个自定义剧本
   * @param {number} scriptId - 要删除的剧本ID
   * @param {string} scriptName - 剧本名称，用于确认提示
   */
  async function deleteCustomScript(scriptId, scriptName) {
    const confirmed = await showCustomConfirm('Xóa kịch bản', `Bạn có chắc muốn xóa vĩnh viễn kịch bản tùy chỉnh 《${scriptName}》?`, {
      confirmButtonClass: 'btn-danger',
    });
    if (confirmed) {
      await db.scriptKillScripts.delete(scriptId);
      await renderScriptManagerList();
      alert('Đã xóa kịch bản.');
    }
  }
  /**
   * 【全新】导出指定的自定义剧本
   * @param {number} scriptId - 要导出的剧本ID
   */
  async function exportCustomScript(scriptId) {
    try {
      const script = await db.scriptKillScripts.get(scriptId);
      if (!script) {
        alert('Lỗi: không tìm thấy kịch bản cần xuất.');
        return;
      }

      // 1. 准备要导出的纯数据结构 (去除本地数据库ID，保留核心内容)
      const exportData = {
        type: 'EPhoneScriptKill', // 标记文件类型
        version: 1,
        name: script.name,
        storyBackground: script.storyBackground,
        truth: script.truth,
        roles: script.roles,
        clues: script.clues,
      };

      // 2. 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 3. 创建并下载文件
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      // 文件名示例: [剧本杀]古堡之谜-2024-01-01.json
      link.href = url;
      link.download = `[Kich-ban]${script.name}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();

      // 4. 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await showCustomAlert('Xuất thành công', `Đã xuất kịch bản 《${script.name}》 thành công!`);
    } catch (error) {
      console.error('导出剧本失败:', error);
      await showCustomAlert('Xuất thất bại', `Có lỗi: ${error.message}`);
    }
  }

  /**
   * 【全新】导入剧本杀剧本文件
   * @param {File} file - 用户选择的JSON文件
   */
  async function importCustomScript(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        // 1. 简单的格式验证
        if (!data.name || !data.roles || !data.clues || !data.truth) {
          throw new Error('Định dạng file không hợp lệ. Thiếu các trường kịch bản cần thiết (name, roles, clues, truth).');
        }

        // 2. 检查是否重名，如果重名自动重命名
        let newScriptName = data.name;
        const existingScript = await db.scriptKillScripts.where('name').equals(newScriptName).first();
        if (existingScript) {
          newScriptName = `${newScriptName} (đã nhập)`;
        }

        // 3. 构建入库数据
        const scriptToAdd = {
          name: newScriptName,
          storyBackground: data.storyBackground || '(Không có giới thiệu bối cảnh)',
          truth: data.truth,
          roles: data.roles,
          clues: data.clues,
          isBuiltIn: false, // 标记为自定义剧本
        };

        // 4. 存入数据库
        await db.scriptKillScripts.add(scriptToAdd);

        // 5. 刷新列表并提示
        await renderScriptManagerList();
        await showCustomAlert('Nhập thành công', `Đã nhập kịch bản 《${newScriptName}》 thành công!`);
      } catch (error) {
        console.error('导入剧本失败:', error);
        await showCustomAlert('Nhập thất bại', `Có lỗi khi phân tích file: ${error.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // --- ▲▲▲ 新增功能函数结束 ▲▲▲
  // ▼▼▼ 在 init() 函数的【正上方】粘贴下面这一整块新代码 ▼▼▼

  /**
   * 【剧本杀】AI核心：调用AI为整局游戏生成复盘摘要
   * @returns {Promise<string>} - AI生成的摘要文本
   */
  async function generateAiSkSummary() {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      return '(AI tạo tóm tắt thất bại: API chưa được cấu hình)';
    }

    const formattedLog = scriptKillGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.role.name}: ${log.message.speech}`;
        }
        return log.message;
      })
      .join('\n');

    const killer = scriptKillGameState.players.find(p => p.role.isKiller)?.role.name || 'Không xác định';

    const prompt = `
# Nhiệm vụ
Bạn là một DM tổng kết kịch bản giết người chuyên nghiệp. Hãy dựa vào nhật ký trò chơi đầy đủ dưới đây, dùng khoảng 200 từ tiếng Việt để tóm tắt khách quan, súc tích 【các sự kiện then chốt】, 【manh mối quan trọng】 và 【logic của người chơi】 trong ván này.

# Yêu cầu cốt lõi
- Bản tóm tắt cần logic, mạch lạc, giống một bản tổng kết game thực thụ.
- Chỉ ra các manh mối then chốt đã được phát hiện và sử dụng thế nào.
- Phân tích hung thủ (${killer}) đã che giấu bản thân thế nào, cùng điểm sáng hoặc sai lầm trong suy luận của phe tốt.
- Đầu ra của bạn 【bắt buộc và chỉ được】 là văn bản thuần của bản tóm tắt, không kèm bất kỳ hội thoại hay tiêu đề nào khác.

# Nhật ký trò chơi
${formattedLog}
`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();
    } catch (error) {
      console.error('AI摘要生成失败:', error);
      return '(AI tạo tóm tắt thất bại, hãy kiểm tra mạng hoặc cài đặt API)';
    }
  }

  // ▼▼▼ 用这个【功能增强版】函数，完整替换你旧的 generateSkSummary 函数 ▼▼▼
  /**
   * 【剧本杀 V2 - 增强版】生成游戏复盘的文本，包含AI摘要和投票详情
   * @param {string} winner - 胜利的阵营名称
   * @param {string} aiSummary - AI生成的摘要文本
   * @returns {string} - 格式化后的完整复盘Markdown文本
   */
  function generateSkSummary(winner, aiSummary) {
    const roleNameMap = {
      wolf: 'Sói',
      villager: 'Dân làng',
      seer: 'Tiên tri',
      witch: 'Phù thủy',
      hunter: 'Thợ săn',
      guard: 'Bảo vệ',
      idiot: 'Kẻ ngốc',
    };

    let summaryText = `**Kịch bản giết người - Tổng kết ván**\n\n`;
    summaryText += `**Kịch bản:** ${scriptKillGameState.script.name}\n`;
    summaryText += `🏆 **Bên thắng:** ${winner}\n\n`;

    summaryText += `**Tóm tắt ván này:**\n${aiSummary}\n\n`;

    summaryText += `**Vai trò người chơi:**\n`;
    scriptKillGameState.players.forEach(p => {
      const roleName = p.role.name || 'Nhân vật không xác định';
      const isKiller = p.role.isKiller ? ' (🔪Hung thủ)' : '';
      summaryText += `- ${p.name}: đóng ${roleName}${isKiller}\n`;
    });

    // --- ▼▼▼ 这就是我们本次新增的核心代码！▼▼▼ ---
    summaryText += `\n**Chi tiết bỏ phiếu:**\n`;
    const votes = scriptKillGameState.votes;
    const playerMap = new Map(scriptKillGameState.players.map(p => [p.id, p.name]));

    for (const voterId in votes) {
      const voterName = playerMap.get(voterId) || 'Người bỏ phiếu không xác định';
      const targetId = votes[voterId];

      if (targetId) {
        // 如果不是弃票
        const targetName = playerMap.get(targetId) || 'Mục tiêu không xác định';
        summaryText += `- ${voterName}  →  ${targetName}\n`;
      } else {
        // 如果是弃票
        summaryText += `- ${voterName}  →  bỏ phiếu trắng\n`;
      }
    }
    // --- ▲▲▲ 新增代码结束 ▲▲▲ ---

    return summaryText;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【剧本杀】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showScriptKillSummaryModal(summaryText) {
    const modal = document.getElementById('script-kill-summary-modal');
    const contentEl = document.getElementById('script-kill-summary-content');

    contentEl.innerHTML = renderMarkdown(summaryText);

    const repostBtn = document.getElementById('repost-sk-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openSkSummaryTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-from-sk-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 【剧本杀】打开复盘发送目标选择器
   * @param {string} summaryText - 要转发的复盘文本
   */
  function openSkSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('script-kill-target-picker-modal');
    const listEl = document.getElementById('script-kill-target-list');
    listEl.innerHTML = '';

    const aiPlayers = scriptKillGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('Không có người chơi AI nào để chuyển tới.');
      return;
    }

    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="script-kill-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    const confirmBtn = document.getElementById('sk-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.script-kill-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendSkSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Vui lòng chọn ít nhất một người nhận!');
      }
    };

    modal.classList.add('visible');
  }

  /**
   * 【剧本杀】将游戏复盘发送到【选定】的AI角色的单聊中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendSkSummaryToSelectedPlayers(summaryText, targetIds) {
    document.getElementById('script-kill-summary-modal').classList.remove('visible');
    document.getElementById('script-kill-target-picker-modal').classList.remove('visible');
    let sentCount = 0;

    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván kịch bản giết người, đây là bản tổng kết. Hãy dựa vào nội dung tổng kết này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Kịch bản giết người - Tổng kết ván',
          description: 'Bấm để xem tổng kết chi tiết',
          source_name: 'Trung tâm trò chơi',
          content: summaryText,
        };

        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('Chuyển thành công', `Đã gửi bản tổng kết vào chat đơn của ${sentCount} người chơi AI!`);
    showScreen('game-hall-screen');
  }

  // ▲▲▲ 新代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀AI生成功能的所有核心函数 ▼▼▼

  function openAiScriptGenerator() {
    // 隐藏剧本管理弹窗
    document.getElementById('script-kill-manager-modal').classList.remove('visible');

    const modal = document.getElementById('sk-ai-generator-modal');
    // ▼▼▼ 在这里修改 ▼▼▼
    document.getElementById('sk-ai-elements-input').value = ''; // 清空要素输入框
    document.getElementById('sk-ai-summary-input').value = ''; // 清空梗概输入框
    // ▲▲▲ 修改结束 ▲▲▲
    document.getElementById('sk-ai-result-preview').textContent = 'Sau khi bấm "Bắt đầu tạo", kết quả sẽ hiện ở đây...';
    document.getElementById('sk-ai-generator-save-btn').disabled = true;
    tempGeneratedScriptData = null;

    modal.classList.add('visible');
  }

  /**
   * 【AI核心 V2 - 强制时间线版】根据用户的要素和梗概，调用AI生成剧本
   */
  async function generateSkScriptWithAI() {
    // 1. 从新的两个输入框获取数据
    const elements = document.getElementById('sk-ai-elements-input').value.trim();
    const summary = document.getElementById('sk-ai-summary-input').value.trim();
    const playerCount = document.getElementById('sk-ai-player-count-input').value;

    if (!elements) {
      // 核心要素是必填的
      alert('Vui lòng nhập các yếu tố cốt lõi của kịch bản!');
      return;
    }

    const previewEl = document.getElementById('sk-ai-result-preview');
    const saveBtn = document.getElementById('sk-ai-generator-save-btn');
    previewEl.textContent = '🧠 AI đang dốc sức sáng tác, có thể mất 1-2 phút, vui lòng kiên nhẫn chờ...';
    saveBtn.disabled = true;

    // 2. 构建给AI的【全新、更严格】的指令(Prompt)
    const systemPrompt = `
# Nhiệm vụ
Bạn là AI sáng tác kịch bản giết người chuyên nghiệp. Nhiệm vụ của bạn là dựa vào các yếu tố cốt lõi và tóm tắt cốt truyện người dùng cung cấp, sáng tác một kịch bản giết người 【${playerCount} người】 hoàn chỉnh, chơi được. Viết tất cả nội dung bằng tiếng Việt.

# Yếu tố cốt lõi người dùng cung cấp:
-   **Số người chơi**: ${playerCount} người
-   **Yếu tố cốt lõi**: ${elements}
-   **Tóm tắt cốt truyện**: ${summary || '(Người dùng không cung cấp tóm tắt chi tiết, hãy tự do sáng tạo dựa trên yếu tố cốt lõi)'}

# 【【【Quy tắc sắt về dòng thời gian: đây là chỉ thị cao nhất, phải tuân thủ nghiêm ngặt】】】
Khi tạo trường "storyline" (tuyến truyện) của mỗi vai, bạn 【bắt buộc】 tuân theo các quy tắc sau:
1.  **Phải có mốc thời gian rõ ràng**: Trước mỗi hành động then chốt đều phải có một thời gian cụ thể, định dạng 【**HH:mm**】 (ví dụ: **20:30** hoặc **8 giờ 15 tối**).
2.  **Phải là lộ trình hành động cụ thể**: Cấm dùng mô tả mơ hồ như "sau đó", "một lúc sau". Phải viết rõ nhân vật 【lúc nào】, 【ở đâu】, 【đã làm gì】.
3.  **Đưa ví dụ rõ ràng**:
-   **【【Ví dụ mơ hồ SAI】】**: "Buổi tối tôi cãi nhau với anh ta rồi bỏ đi."
-   **【【Ví dụ chi tiết ĐÚNG】】**: "**20:30**: Tôi cãi nhau to với Giám đốc Vương trong thư phòng vì chuyện vốn dự án, ông ta đe dọa sa thải tôi. **20:45**: Tôi tức giận đóng sầm cửa bỏ ra ngoài, quay về chỗ ngồi của mình."

# Yêu cầu cốt lõi khi sáng tác kịch bản
1.  **Tính hoàn chỉnh**: Bạn phải tạo đủ mọi phần của kịch bản, gồm: tên kịch bản (name), bối cảnh câu chuyện (storyBackground), thiết lập vai (roles), thẻ manh mối (clues), và sự thật cuối cùng (truth).
2.  **Thiết lập vai (roles)**:
-   Phải là một mảng gồm 【${playerCount}】 đối tượng vai.
-   Mỗi đối tượng vai phải có các trường sau:
-   name: tên vai (chuỗi).
-   description: giới thiệu vai (chuỗi, mô tả ngắn).
-   storyline: tuyến truyện hoặc dòng thời gian riêng của vai (chuỗi, **phải tuân thủ 【Quy tắc sắt về dòng thời gian】**).
-   tasks: nhiệm vụ bí mật của vai (chuỗi).
-   isKiller: có phải hung thủ không (boolean, true hoặc false).
-   Trong kịch bản 【phải có và chỉ có một】 vai có isKiller là true.
3.  **Thẻ manh mối (clues)**:
-   Phải là một mảng gồm nhiều đối tượng manh mối.
-   Mỗi đối tượng manh mối phải có các trường sau:
-   owner: manh mối thuộc về ai (chuỗi, có thể là tên một vai, hoặc "Chung").
-   description: mô tả chi tiết manh mối (chuỗi).
-   isKey: có phải manh mối then chốt không (boolean, true hoặc false).
-   Phải có ít nhất một manh mối then chốt.
4.  **Sự thật cuối cùng (truth)**: Phải tiết lộ rõ ràng, logic toàn bộ sự thật vụ án, động cơ và thủ đoạn gây án của hung thủ.

# 【Quy tắc sắt về định dạng】
Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, bắt đầu trực tiếp bằng '{' và kết thúc bằng '}'. Cấm có "json", "\`\`\`" hay bất kỳ chữ giải thích nào khác.
`;

    // 3. 调用API (这部分逻辑与之前相同)
    try {
      const { proxyUrl, apiKey, model } = state.apiConfig;
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status} - ${await response.text()}`);

      const data = await response.json();
      const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content)
        .replace(/^```json\s*|```$/g, '')
        .trim();

      const generatedScript = JSON.parse(rawContent);

      if (
        !generatedScript.name ||
        !generatedScript.storyBackground ||
        !Array.isArray(generatedScript.roles) ||
        !Array.isArray(generatedScript.clues) ||
        !generatedScript.truth
      ) {
        throw new Error('JSON AI trả về không đầy đủ, thiếu các trường cần thiết.');
      }

      previewEl.textContent = JSON.stringify(generatedScript, null, 2);
      tempGeneratedScriptData = generatedScript;
      saveBtn.disabled = false;

      await showCustomAlert('Tạo thành công!', 'Đã tạo kịch bản, hãy xem trước bên dưới. Nếu hài lòng có thể bấm lưu.');
    } catch (error) {
      console.error('AI剧本生成失败:', error);
      previewEl.textContent = `Tạo thất bại! Hãy kiểm tra cài đặt API hoặc mạng rồi thử lại.\n\nThông tin lỗi: ${error.message}`;
      await showCustomAlert('Tạo thất bại', `Đã xảy ra lỗi:\n${error.message}`);
    }
  }

  /**
   * 保存AI生成的剧本
   */
  async function saveAiGeneratedScript() {
    if (!tempGeneratedScriptData) {
      alert('Không có dữ liệu kịch bản nào để lưu.');
      return;
    }

    try {
      const scriptToSave = {
        ...tempGeneratedScriptData,
        isBuiltIn: false, // 标记为非内置剧本
      };

      // 存入数据库
      await db.scriptKillScripts.add(scriptToSave);

      document.getElementById('sk-ai-generator-modal').classList.remove('visible'); // 关闭AI生成器
      await renderScriptManagerList(); // 刷新剧本管理列表

      alert(`Đã lưu kịch bản 《${scriptToSave.name}》 vào kho kịch bản tùy chỉnh của bạn thành công!`);
    } catch (error) {
      console.error('保存AI剧本失败:', error);
      alert(`Lưu thất bại: ${error.message}`);
    }
  }

  // ▲▲▲ 新增功能函数结束 ▲▲▲

  // ▲▲▲ 剧本杀功能函数结束 ▲▲▲
  // ▼▼▼ 【全新】这里是“你说我猜”游戏的所有核心功能函数 ▼▼▼

  // ▼▼▼ 【全新】这里是“你说我猜”游戏的所有核心功能函数 ▼▼▼

  /**
   * 【你说我猜】打开游戏设置界面 (V2 - 复选框版)
   */
  async function openGuessWhatSetup() {
    // 重置游戏状态，以防上次游戏数据残留
    guessWhatGameState = {
      isActive: false,
      mode: 'ai_guesses',
      opponent: null,
      secretWord: '',
      gameLog: [],
      currentTurn: 'user',
    };

    showScreen('guess-what-setup-screen');
    const selectionEl = document.getElementById('guess-what-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách bạn chơi...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length === 0) {
      selectionEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary);">Chưa có bạn bè nào để chơi cùng~</p>';
      return;
    }

    // 【核心修改1】使用复选框，并添加专属class
    playerOptions.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="guess-what-player-checkbox" value="${player.id}" id="opponent-${player.id}" ${
        index === 0 ? 'checked' : ''
      }>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 【核心修改2】添加事件监听，实现单选效果
    selectionEl.addEventListener('click', e => {
      if (e.target.type === 'checkbox' && e.target.classList.contains('guess-what-player-checkbox')) {
        // 当点击一个复选框时，取消其他所有同类复选框的选中状态
        document.querySelectorAll('.guess-what-player-checkbox').forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
      }
    });

    // 默认显示“我出题”模式的输入框
    document.getElementById('user-word-input-container').style.display = 'block';
  }

  /**
   * 【你说我猜】开始游戏的核心逻辑 (V2 - 复选框版)
   */
  async function startGuessWhatGame() {
    // 【核心修改】修改选择器以匹配新的复选框class
    const selectedOpponentCheckbox = document.querySelector('.guess-what-player-checkbox:checked');
    if (!selectedOpponentCheckbox) {
      alert('Vui lòng chọn một bạn chơi!');
      return;
    }
    const opponentId = selectedOpponentCheckbox.value;
    const gameMode = document.querySelector('input[name="guess_what_mode"]:checked').value;
    const userWord = document.getElementById('guess-what-user-word').value.trim();

    if (gameMode === 'ai_guesses' && !userWord) {
      alert('Ở chế độ "Tôi ra đề", từ khóa không được để trống!');
      return;
    }

    await showCustomAlert('Vui lòng chờ...', 'Đang chuẩn bị trò chơi, AI cũng đang xoa tay háo hức...');

    const chat = Object.values(state.chats).find(c => c.id === opponentId);
    let opponentInfo = null;
    if (chat) {
      opponentInfo = { id: chat.id, name: chat.name, avatar: chat.settings.aiAvatar, persona: chat.settings.aiPersona };
    } else {
      for (const c of Object.values(state.chats)) {
        const npc = (c.npcLibrary || []).find(n => n.id === opponentId);
        if (npc) {
          opponentInfo = { id: npc.id, name: npc.name, avatar: npc.avatar, persona: npc.persona };
          break;
        }
      }
    }
    if (!opponentInfo) {
      alert('Không tìm thấy thông tin bạn chơi đã chọn!');
      return;
    }

    guessWhatGameState.isActive = true;
    guessWhatGameState.mode = gameMode;
    guessWhatGameState.opponent = opponentInfo;
    guessWhatGameState.gameLog = [];

    document.getElementById('guess-what-game-title').textContent = `Trò chơi với ${opponentInfo.name}`;
    const inputEl = document.getElementById('guess-what-user-input');

    if (gameMode === 'ai_guesses') {
      guessWhatGameState.secretWord = userWord;
      guessWhatGameState.currentTurn = 'user';
      logToGuessWhatGame('Trò chơi bắt đầu! Bạn ra đề, hãy đưa ra gợi ý đầu tiên.', 'system');
      inputEl.placeholder = 'Hãy đưa ra gợi ý đầu tiên...';
      inputEl.disabled = false;
    } else {
      const { secretWord, firstHint } = await triggerGuessWhatAiAction('generate_word');
      if (!secretWord) {
        await showCustomAlert('Ra đề thất bại', 'Xin lỗi, hôm nay AI có vẻ hết cảm hứng, không nghĩ ra đề. Hãy thử lại sau hoặc kiểm tra cài đặt API.');
        guessWhatGameState.isActive = false;
        showScreen('game-hall-screen');
        return;
      }
      guessWhatGameState.secretWord = secretWord;
      guessWhatGameState.currentTurn = 'user';
      logToGuessWhatGame(`Trò chơi bắt đầu! ${opponentInfo.name} đã nghĩ xong một từ.`, 'system');
      logToGuessWhatGame(
        { player: opponentInfo, text: `【${opponentInfo.name} chống cằm nghĩ ngợi】Gợi ý đầu tiên là... ${firstHint}` },
        'ai-turn',
      );
      inputEl.placeholder = 'Hãy đoán dựa trên gợi ý...';
      inputEl.disabled = false;
    }

    showScreen('guess-what-game-screen');
    renderGuessWhatGameScreen();
    inputEl.focus();
    const actionArea = document.getElementById('guess-what-action-area');
    if (actionArea) actionArea.style.display = 'flex';
  }
  // ▼▼▼ 【全新】这是“你说我猜”的重roll功能核心函数 ▼▼▼
  /**
   * 【你说我猜】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的AI发言在gameLog中的索引
   */
  async function handleGuessWhatReroll(logIndex) {
    // 1. 找到AI的发言和触发它的那条用户发言
    const aiLogIndex = logIndex;
    const userLogIndex = logIndex - 1;

    // 安全检查
    if (
      userLogIndex < 0 ||
      !guessWhatGameState.gameLog[userLogIndex] ||
      guessWhatGameState.gameLog[userLogIndex].type !== 'user-turn'
    ) {
      alert('Không thể roll lại, không tìm thấy tin nhắn người dùng đã kích hoạt phản hồi này.');
      return;
    }

    // 2. 提取用户原始的输入内容
    const originalUserInput = guessWhatGameState.gameLog[userLogIndex].message.text;

    // 3. 从日志中移除这两条记录，实现“时间倒流”
    guessWhatGameState.gameLog.splice(userLogIndex, 2);

    // 4. 立即刷新界面，让用户看到消息消失了
    renderGuessWhatGameScreen();
    await showCustomAlert('Vui lòng chờ...', 'AI đang đổi hướng suy nghĩ...');

    // 5. 使用用户原始的输入，重新调用游戏主流程
    await processGuessWhatTurn(originalUserInput);
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【你说我猜】用这块【已添加重roll按钮】的代码，完整替换旧的 renderGuessWhatGameScreen 函数 ▼▼▼
  /**
   * 【你说我猜】渲染游戏主界面
   */
  function renderGuessWhatGameScreen() {
    const logContainer = document.getElementById('guess-what-game-log');
    logContainer.innerHTML = '';

    guessWhatGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      logEl.className = `guess-log-entry ${log.type}`;

      if (log.type === 'system') {
        logEl.textContent = log.message;
      } else if (log.type === 'ai-turn') {
        // ★ 核心修改2：定位到AI的发言
        const avatarUrl = log.message.player.avatar;
        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
                <img src="${avatarUrl}" class="avatar">
                <div class="bubble">
                    <div class="name" style="display: flex; align-items: center; gap: 8px;">
                        ${log.message.player.name}
<button class="gw-reroll-btn" data-log-index="${index}" title="Để người ấy nói cách khác" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                           <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                    <div>${log.message.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
      } else {
        // 用户的发言保持原样
        const avatarUrl = log.message.player.isUser
          ? state.qzoneSettings.avatar || defaultAvatar
          : log.message.player.avatar;
        logEl.innerHTML = `
                <img src="${avatarUrl}" class="avatar">
                <div class="bubble">
                    <div class="name">${log.message.player.name}</div>
                    <div>${log.message.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
      }
      logContainer.appendChild(logEl);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【你说我猜】添加一条游戏日志
   */
  function logToGuessWhatGame(message, type = 'system') {
    guessWhatGameState.gameLog.push({ message, type });
    renderGuessWhatGameScreen();
  }

  /**
   * 【你说我猜 V5 | 裁判逻辑最终修复版】游戏主循环/引擎
   * @param {string} userInput - 用户刚刚的输入
   */
  async function processGuessWhatTurn(userInput) {
    if (!guessWhatGameState.isActive) return;

    const inputEl = document.getElementById('guess-what-user-input');
    const userPlayer = { id: 'user', name: state.qzoneSettings.nickname || 'Tôi', isUser: true };
    const aiPlayer = guessWhatGameState.opponent;
    const currentMode = guessWhatGameState.mode;

    // 1. 记录并显示用户的行为
    logToGuessWhatGame({ player: userPlayer, text: userInput }, 'user-turn');

    // 2. 轮到AI行动，禁用输入框
    guessWhatGameState.currentTurn = 'ai';
    inputEl.placeholder = `Đang chờ ${aiPlayer.name} phản hồi...`;
    inputEl.disabled = true;
    renderGuessWhatGameScreen();
    await sleep(1500);

    // 3. 让AI根据上下文执行动作
    const aiResponse = await triggerGuessWhatAiAction(
      currentMode === 'ai_guesses' ? 'guess_word' : 'give_hint',
      userInput,
    );

    // 4. 【核心修复】使用 switch 结构清晰地处理AI的每一种行动结果
    if (aiResponse) {
      switch (aiResponse.type) {
        case 'guess':
          const guessText = aiResponse.text;
          // 先把AI的猜测显示出来
          logToGuessWhatGame({ player: aiPlayer, text: guessText }, 'ai-turn');

          // 调用裁判函数进行判断
          if (isGuessCorrect(guessText, guessWhatGameState.secretWord)) {
            await sleep(1000); // 停顿一下，让玩家看到猜测内容
            endGuessWhatGame('ai', `Tôi đoán đúng rồi! Đáp án chính là 【${guessWhatGameState.secretWord}】!`);
            return; // 猜对了，游戏结束，退出函数
          }
          // 如果没猜对，则不执行任何操作，流程会自然地走到最后，把控制权还给用户
          break;

        case 'hint':
          // AI给出新提示
          logToGuessWhatGame({ player: aiPlayer, text: aiResponse.text }, 'ai-turn');
          break;

        case 'game_over':
          // AI在给提示时直接判断用户猜对了
          endGuessWhatGame(aiResponse.winner, aiResponse.reason);
          return; // 游戏结束，退出函数

        case 'error':
          // AI返回了错误信息
          logToGuessWhatGame({ player: aiPlayer, text: aiResponse.text }, 'ai-turn');
          break;

        default:
          // 未知类型的回复，也记录下来
          logToGuessWhatGame({ player: aiPlayer, text: 'Hình như tôi hơi lơ đãng, mình đang nói tới đâu rồi?' }, 'ai-turn');
          console.warn('收到了未知的AI行动类型:', aiResponse);
          break;
      }
    } else {
      // API调用彻底失败
      logToGuessWhatGame({ player: aiPlayer, text: 'Tôi... hình như mất kết nối hoàn toàn rồi...' }, 'ai-turn');
    }

    // 5. 如果游戏没有结束，则轮到用户行动，恢复输入框
    guessWhatGameState.currentTurn = 'user';
    inputEl.placeholder = currentMode === 'ai_guesses' ? 'Hãy tiếp tục đưa ra gợi ý của bạn...' : 'Hãy tiếp tục đoán dựa trên gợi ý...';
    inputEl.disabled = false;
    inputEl.focus();
  }

  /**
   * 【你说我猜】游戏结束处理
   */
  function endGuessWhatGame(winner, reason) {
    if (!guessWhatGameState.isActive) return; // 防止重复执行
    guessWhatGameState.isActive = false; // 标记游戏为非激活状态

    // 立即隐藏游戏中的输入区域
    const actionArea = document.getElementById('guess-what-action-area');
    if (actionArea) actionArea.style.display = 'none';

    // 生成复盘文本
    const summaryText = generateGuessWhatSummary(winner, reason);
    // 显示结算卡片
    showGuessWhatSummaryModal(summaryText);
  }
  /**
   * 【全新】判断AI的猜测是否正确（简单版）
   * @param {string} guess - AI猜测的词语
   * @param {string} answer - 正确答案
   * @returns {boolean}
   */
  function isGuessCorrect(guess, answer) {
    if (!guess || !answer) return false;

    // 为了更宽松的匹配，我们都转为小写并去除空格
    const cleanGuess = guess.toLowerCase().replace(/\s+/g, '');
    const cleanAnswer = answer.toLowerCase().replace(/\s+/g, '');

    // 只要猜测包含了答案，或者答案包含了猜测，就认为正确
    // 例如：答案是“冰淇淋”，猜测“冰淇淋车”或“淇淋”，都算对
    return cleanGuess.includes(cleanAnswer) || cleanAnswer.includes(cleanGuess);
  }

  /**
   * 【你说我猜-AI核心 V4 | 铜墙铁壁版】调用AI执行游戏逻辑，内置强大的重试机制
   * @param {string} actionType - AI需要执行的动作: 'generate_word', 'give_hint', 'guess_word'
   * @param {string} userInput - 用户刚刚的输入
   * @returns {Promise<object|null>} - AI的行动结果
   */
  async function triggerGuessWhatAiAction(actionType, userInput = null) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return null;

    // --- 这部分Prompt逻辑保持不变 ---
    const opponent = guessWhatGameState.opponent;
    const historyText = guessWhatGameState.gameLog
      .map(log =>
        log.type === 'system' ? `[Thông báo hệ thống: ${log.message}]` : `${log.message.player.name}: ${log.message.text}`,
      )
      .slice(-10)
      .join('\n');
    let systemPrompt = `# Nhiệm vụ của bạn\nBạn đang đóng nhân vật "${opponent.name}", thiết lập là: "${opponent.persona}".\nBạn đang chơi trò "Bạn tả tôi đoán" với "${state.qzoneSettings.nickname || 'Tôi'}".\nMọi lời bạn nói đều 【bắt buộc】 phù hợp nghiêm ngặt thiết lập và giọng điệu nhân vật, khiến cả quá trình như một cuộc trò chuyện tương tác thật. Nói bằng tiếng Việt.\n\n# Lịch sử trò chơi (cuộc trò chuyện gần đây)\n${historyText}\n`;
    switch (actionType) {
      case 'generate_word':
        systemPrompt += `# Chỉ thị hành động của bạn\n1. Dựa vào thiết lập nhân vật, nghĩ một từ tiếng Việt thông dụng (1-3 từ) làm đáp án.\n2. Đưa ra 【gợi ý đầu tiên】 thú vị, phù hợp thiết lập nhân vật cho từ đó.\n3. Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, có hai trường "secretWord" và "firstHint".\n\n# Ví dụ định dạng đầu ra JSON:\n{"secretWord": "mặt trăng", "firstHint": "【chỉ lên trời】Thứ chỉ thấy được vào buổi tối nha, tròn tròn, sáng sáng~"}`;
        break;
      case 'give_hint':
        systemPrompt += `# Luật chơi
Bạn là người ra đề, đáp án của bạn là 【${guessWhatGameState.secretWord}】.
Câu đoán vừa rồi của người dùng là: "${userInput}".

# Chỉ thị hành động của bạn
1.  Trước tiên phán định câu đoán của người dùng có đúng không.
2.  Nếu người dùng đoán đúng, trò chơi kết thúc.
3.  Nếu người dùng đoán sai, bạn 【bắt buộc】 dựa vào câu đoán sai đó để đưa ra 【gợi ý tiếp theo】 mới, có trọng tâm hơn, dẫn dắt họ.
4.  【【【Quy tắc sắt về nhập vai】】】 Mọi gợi ý của bạn đều 【bắt buộc】 phù hợp thiết lập và giọng điệu nhân vật, có thể thêm hành động, biểu cảm, từ ngữ cảm thán, thậm chí 【trêu chọc nghịch ngợm những câu đoán ngốc nghếch】 của người dùng, để trò chơi vui hơn. Viết bằng tiếng Việt.
5.  Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt.

# Định dạng đầu ra JSON
- Nếu đoán đúng: \`{"type": "game_over", "winner": "user", "reason": "Chúc mừng bạn đoán đúng rồi! Chính là 【${guessWhatGameState.secretWord}】!"}\`
- Nếu đoán sai: \`{"type": "hint", "text": "【thở dài】Không đúng rồi, nghĩ lại đi. Gợi ý là: [viết gợi ý mới của bạn ở đây]"}\``;
        break;

      // ▼▼▼ 请用这整块【修复后】的代码，替换掉旧的 case 'guess_word' 代码块 ▼▼▼
      case 'guess_word':
        systemPrompt += `# Luật chơi
Bạn là người đoán, người dùng đang mô tả một từ, bạn cần dựa vào gợi ý để đoán ra từ đó.
Gợi ý mới người dùng vừa đưa cho bạn là: "${userInput}".

# Chỉ thị hành động của bạn
1.  Phân tích tổng hợp 【tất cả gợi ý】 người dùng đã đưa trong 【lịch sử trò chơi】.
2.  Dựa vào mọi manh mối, đưa ra 【một lần】 đoán.
3.  【【【Quy tắc sắt về nhập vai】】】 Câu đoán của bạn 【bắt buộc】 phù hợp thiết lập và giọng điệu nhân vật. Bạn có thể thêm quá trình suy nghĩ, cảm xúc, thậm chí 【cà khịa gợi ý của người dùng】. Viết bằng tiếng Việt.
4.  【【【Chỉ thị tạo niềm vui】】】 Để trêu người dùng, bạn có thể 【cố ý đưa ra vài đáp án thú vị, hơi dính dáng nhưng rõ ràng là sai】, rồi mới đưa ra đáp án bạn cho là khả năng nhất. Nhưng đây chỉ là gia vị thỉnh thoảng, mục đích cuối cùng vẫn là đoán đúng.
5.  【【【Tuyệt đối cấm】】】 Bạn 【không được】 hỏi lại người dùng, nhiệm vụ của bạn là đoán thẳng.
6.  Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt.

# Định dạng đầu ra JSON (lưu ý: bạn không thể tự biết mình đoán đúng hay chưa, nên luôn dùng định dạng này)
{"type": "guess", "text": "【giả vờ chợt hiểu ra】À~ tôi biết rồi, là 'nồi cơm điện' đúng không? ...Thôi được thôi được không trêu nữa, tôi đoán là... [đáp án thật của bạn]"}`;
        break;
      // ▲▲▲ 替换结束 ▲▲▲
    }

    // --- 【核心改造】带有智能重试的API请求逻辑 ---
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messagesForApi = [{ role: 'user', content: 'Hãy dựa vào quy tắc bạn đọc được trong chỉ thị hệ thống và bắt đầu hành động ngay.' }];
        const isGemini = proxyUrl === GEMINI_API_URL;
        const geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
          ? await fetch(geminiConfig.url, geminiConfig.data)
          : await fetch(`${proxyUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi],
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            });

        // 智能判断错误类型
        if (!response.ok) {
          // 对于 4xx 类的客户端错误 (如 401 Unauthorized, 400 Bad Request)，通常重试无效，直接抛出。
          if (response.status >= 400 && response.status < 500) {
            const errorText = await response.text();
            throw new Error(`Lỗi phía client API (mã trạng thái ${response.status}): ${errorText}`);
          }
          // 对于 5xx 服务器错误或 429 速率限制，是可重试的。
          throw new Error(`Lỗi tạm thời phía server API (mã trạng thái ${response.status})`);
        }

        const data = await response.json();
        const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
          /^```json\s*|```$/g,
          '',
        );
        return JSON.parse(content); // **成功，直接返回结果，跳出循环**
      } catch (error) {
        console.error(`“你说我猜”AI行动[${actionType}]失败 (第 ${attempt}/${maxRetries} 次尝试):`, error.message);

        // 如果是最后一次尝试，或者是一个不可重试的错误，则跳出循环准备返回最终失败信息
        if (attempt === maxRetries || error.message.includes('Lỗi phía client API')) {
          break;
        }

        // 等待一段时间再重试（比如 1.5s, 3s, 4.5s）
        await sleep(1500 * attempt);
      }
    }

    // --- 所有重试都失败后的最终处理 ---
    console.error(`“你说我猜”AI行动[${actionType}]在所有尝试后均失败。`);
    // 根据失败的阶段，返回一个特定的错误对象
    if (actionType === 'generate_word') {
      return { secretWord: null, firstHint: null };
    }
    // 返回一个全新的 'error' 类型，让游戏主循环知道如何处理
    return { type: 'error', text: '【thở dài】Xin lỗi, hình như mạng của tôi có vấn đề, thử mấy lần rồi vẫn không kết nối được...' };
  }
  // ▼▼▼ 【全新】“你说我猜”游戏结算与转发功能核心代码 ▼▼▼

  /**
   * 【你说我猜】生成游戏复盘的文本
   * @param {string} winner - 胜利者 ('user' or 'ai')
   * @param {string} reason - 游戏结束原因
   * @returns {string} 格式化后的复盘Markdown文本
   */
  function generateGuessWhatSummary(winner, reason) {
    let summaryText = `**Bạn tả tôi đoán - Tổng kết ván**\n\n`;
    summaryText += `**Kết quả:** ${reason}\n`;
    summaryText += `**Đáp án:** ${guessWhatGameState.secretWord}\n\n`;
    summaryText += `**Người chơi:** Tôi, ${guessWhatGameState.opponent.name}\n\n`;
    summaryText += `---\n\n**Nhật ký trò chơi:**\n`;

    const formattedLog = guessWhatGameState.gameLog
      .map(log => {
        if (log.type === 'system') {
          return `[Thông báo hệ thống: ${log.message}]`;
        } else {
          return `${log.message.player.name}: ${log.message.text}`;
        }
      })
      .join('\n');

    summaryText += formattedLog;

    return summaryText;
  }

  /**
   * 【你说我猜】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showGuessWhatSummaryModal(summaryText) {
    const modal = document.getElementById('guess-what-summary-modal');
    const contentEl = document.getElementById('guess-what-summary-content');

    contentEl.innerHTML = renderMarkdown(summaryText);

    // 使用克隆节点技巧，防止事件重复绑定
    const forwardBtn = document.getElementById('forward-guess-what-summary-btn');
    const newForwardBtn = forwardBtn.cloneNode(true);
    forwardBtn.parentNode.replaceChild(newForwardBtn, forwardBtn);

    const closeBtn = document.getElementById('close-guess-what-summary-btn');
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // 检查对手是否是主要角色（有独立聊天窗口），而不是NPC
    const opponentId = guessWhatGameState.opponent.id;
    const canForward = state.chats[opponentId] !== undefined;

    if (canForward) {
      newForwardBtn.style.display = 'block';
      newForwardBtn.onclick = () => forwardGuessWhatSummary(summaryText);
    } else {
      // 如果对手是NPC，没有独立聊天窗口，则隐藏转发按钮
      newForwardBtn.style.display = 'none';
    }

    newCloseBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 【你说我猜】将游戏复盘转发到对应的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   */
  async function forwardGuessWhatSummary(summaryText) {
    const opponentId = guessWhatGameState.opponent.id;
    const chat = state.chats[opponentId];

    if (!chat) {
      await showCustomAlert('Chuyển thất bại', 'Không tìm thấy cửa sổ chat của người chơi này.');
      return;
    }

    document.getElementById('guess-what-summary-modal').classList.remove('visible');

    // 创建对用户可见的复盘消息
    // 创建对用户可见的复盘消息
    const visibleMessage = {
      role: 'user',
      type: 'share_link',
      timestamp: Date.now(),
      title: 'Bạn tả tôi đoán - Tổng kết ván',
      description: 'Bấm để xem tổng kết chi tiết',
      source_name: 'Trung tâm trò chơi',
      content: summaryText,
    };

    // 创建给AI看的隐藏指令
    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván "Bạn tả tôi đoán", đây là bản tổng kết. Hãy dựa vào nội dung tổng kết này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;
    const hiddenInstruction = {
      role: 'system',
      content: aiContext,
      timestamp: Date.now() + 1,
      isHidden: true,
    };

    chat.history.push(visibleMessage, hiddenInstruction);
    await db.chats.put(chat);

    await showCustomAlert('Chuyển thành công', `Đã gửi bản tổng kết vào chat với "${chat.name}"!`);

    // ▼▼▼ 这就是本次的核心修改！ ▼▼▼
    // 我们现在通过 window 对象来调用这两个“公共函数”
    window.openChat(chat.id);
    window.triggerAiResponse();
    // ▲▲▲ 修改结束 ▲▲▲
  }

  // ▲▲▲ 新增代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】这是“心动飞行棋”的所有核心功能函数 ▼▼▼
  /**
   * 【全新】导出指定的飞行棋问题库
   * @param {number} bankId - 要导出的问题库的ID
   */
  async function exportLudoQuestionBank(bankId) {
    try {
      const bank = await db.ludoQuestionBanks.get(bankId);
      const questions = await db.ludoQuestions.where('bankId').equals(bankId).toArray();

      if (!bank) {
        alert('Lỗi: không tìm thấy kho câu hỏi cần xuất.');
        return;
      }

      // 1. 准备要导出的数据结构，只包含纯粹的数据
      const exportData = {
        bankName: bank.name,
        questions: questions.map(q => ({
          text: q.text,
          type: q.type,
        })),
      };

      // 2. 将数据转换为格式化的JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 3. 创建Blob对象
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 4. 创建并触发下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `[Kho-cau-hoi-co-ca-ngua]${bank.name}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();

      // 5. 清理临时创建的对象
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await showCustomAlert('Xuất thành công', `Đã xuất kho câu hỏi "${bank.name}" thành công!`);
    } catch (error) {
      console.error('导出飞行棋题库失败:', error);
      await showCustomAlert('Xuất thất bại', `Đã xảy ra lỗi: ${error.message}`);
    }
  }

  /**
   * 【全新】处理导入的飞行棋问题库文件
   * @param {File} file - 用户选择的JSON文件
   */
  async function importLudoQuestionBank(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        // 1. 验证文件格式
        if (!data.bankName || !Array.isArray(data.questions)) {
          throw new Error("Định dạng file không hợp lệ. Phải có 'bankName' và mảng 'questions'.");
        }

        // 2. 检查题库名称是否已存在
        let newBankName = data.bankName;
        const existingBank = await db.ludoQuestionBanks.where('name').equals(newBankName).first();
        if (existingBank) {
          newBankName = `${newBankName} (đã nhập)`; // 如果重名，自动添加后缀
        }

        // 3. 创建新的题库
        const newBankId = await db.ludoQuestionBanks.add({ name: newBankName });

        // 4. 准备要批量添加的新问题
        const questionsToAdd = data.questions.map(q => ({
          bankId: newBankId,
          text: q.text,
          type: q.type || 'both_answer', // 兼容旧的没有type的题库
        }));

        // 5. 如果有问题，就批量添加到数据库
        if (questionsToAdd.length > 0) {
          await db.ludoQuestions.bulkAdd(questionsToAdd);
        }

        // 6. 刷新UI并给出提示
        await renderLudoQuestionBanks();
        await showCustomAlert('Nhập thành công', `Đã nhập kho câu hỏi "${newBankName}" thành công, gồm ${questionsToAdd.length} câu hỏi!`);
      } catch (error) {
        console.error('导入飞行棋题库失败:', error);
        await showCustomAlert('Nhập thất bại', `Không phân tích được file, hãy đảm bảo đó là file sao lưu kho câu hỏi đúng.\n\nLỗi: ${error.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  /**
   * 【飞行棋】打开游戏设置界面 (V2 - 复选框版)
   */
  async function openLudoSetup() {
    showScreen('ludo-setup-screen');
    const selectionEl = document.getElementById('ludo-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách nhân vật...</p>';

    // 【核心修改】为了保持统一，我们在这里也加载NPC作为可选玩伴
    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length === 0) {
      selectionEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary);">Chưa có bạn bè nào để chơi cùng~</p>';
      return;
    }

    // 【核心修改1】渲染复选框列表
    playerOptions.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="ludo-player-checkbox" value="${player.id}" id="ludo-opponent-${player.id}" ${
        index === 0 ? 'checked' : ''
      }>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 【核心修改2】添加事件监听以实现单选
    selectionEl.addEventListener('click', e => {
      if (e.target.type === 'checkbox' && e.target.classList.contains('ludo-player-checkbox')) {
        document.querySelectorAll('.ludo-player-checkbox').forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
      }
    });

    // 加载问题库到下拉框
    const bankSelect = document.getElementById('ludo-question-bank-select');
    bankSelect.innerHTML = '';
    const banks = await db.ludoQuestionBanks.toArray();
    if (banks.length === 0) {
      bankSelect.innerHTML = '<option value="">Chưa có kho câu hỏi khả dụng</option>';
    } else {
      banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = bank.name;
        bankSelect.appendChild(option);
      });
    }
  }

  /**
   * 【飞行棋】开始游戏的核心逻辑 (V2 - 复选框版)
   */
  async function startLudoGame() {
    // 【核心修改】修改选择器以匹配新的复选框class
    const selectedOpponentRadio = document.querySelector('.ludo-player-checkbox:checked');
    if (!selectedOpponentRadio) {
      alert('Vui lòng chọn một bạn chơi!');
      return;
    }
    const opponentId = selectedOpponentRadio.value;
    const opponentChat =
      state.chats[opponentId] ||
      Object.values(state.chats)
        .flatMap(c => c.npcLibrary)
        .find(n => n.id === opponentId);

    const selectedBankId = parseInt(document.getElementById('ludo-question-bank-select').value);
    if (isNaN(selectedBankId)) {
      alert('Vui lòng chọn một kho câu hỏi hợp lệ!');
      return;
    }

    // 查找对手的完整信息（和旧逻辑一样）
    let opponentInfo = null;
    const mainChat = Object.values(state.chats).find(c => c.id === opponentId);
    if (mainChat) {
      opponentInfo = { ...mainChat, persona: mainChat.settings.aiPersona, avatar: mainChat.settings.aiAvatar };
    } else {
      for (const c of Object.values(state.chats)) {
        const npc = (c.npcLibrary || []).find(n => n.id === opponentId);
        if (npc) {
          opponentInfo = npc;
          break;
        }
      }
    }
    if (!opponentInfo) {
      alert('Không tìm thấy thông tin bạn chơi đã chọn!');
      return;
    }

    // 初始化游戏状态 (和旧逻辑一样)
    ludoGameState = {
      isActive: true,
      opponent: opponentInfo,
      players: [],
      currentTurnIndex: 0,
      gameLog: [],
      boardLayout: [],
      isDiceRolling: false,
      activeQuestionBankId: selectedBankId,
    };
    const userPlayer = {
      id: 'user',
      name: 'Bạn',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      piecePosition: -1,
      isUser: true,
    };
    const charPlayer = {
      id: opponentInfo.id,
      name: opponentInfo.name,
      avatar: opponentInfo.avatar || defaultAvatar,
      piecePosition: -1,
      isUser: false,
      persona: opponentInfo.persona,
    };
    if (Math.random() > 0.5) {
      ludoGameState.players = [userPlayer, charPlayer];
    } else {
      ludoGameState.players = [charPlayer, userPlayer];
    }
    ludoGameState.currentTurnIndex = 0;
    generateLudoBoard();
    showScreen('ludo-game-screen');
    renderLudoGameScreen();
    logToLudoGame('Trò chơi bắt đầu! Tung được 6 điểm là có thể xuất quân.', 'system');
    await sleep(1000);
    await processLudoTurn();
  }
  // ▼▼▼ 【全新】这是飞行棋的重roll功能核心函数 ▼▼▼
  /**
   * 【飞行棋】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleLudoReroll(logIndex) {
    const logEntry = ludoGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'char') return;

    // 提取原始发言内容
    const originalSpeech = logEntry.message.replace(/<strong>.*?<\/strong>:\s*/, '');

    // 重新调用AI，让它换个说法
    const newSpeech = await triggerLudoAiAction('reroll_comment', { originalSpeech: originalSpeech });

    // 更新日志并重新渲染
    ludoGameState.gameLog[logIndex].message = `<strong>${ludoGameState.opponent.name}:</strong> ${newSpeech}`;
    renderLudoGameScreen();
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【飞行棋】用这块【已添加重roll按钮】的代码，完整替换旧的 renderLudoGameScreen 函数 ▼▼▼
  function renderLudoGameScreen(options = {}) {
    if (!ludoGameState.isActive) return;

    const userPieceEl = document.getElementById('ludo-user-piece');
    const charPieceEl = document.getElementById('ludo-char-piece');
    if (!userPieceEl || !charPieceEl) return;

    userPieceEl.style.backgroundImage = `url(${ludoGameState.players.find(p => p.isUser).avatar})`;
    charPieceEl.style.backgroundImage = `url(${ludoGameState.players.find(p => !p.isUser).avatar})`;

    ludoGameState.players.forEach(player => {
      const pieceEl = player.isUser ? userPieceEl : charPieceEl;
      const pos = player.piecePosition;

      if (pos === -1) {
        const startCell = document.querySelector('.ludo-cell.start');
        if (startCell) {
          pieceEl.style.left = `${startCell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${startCell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      } else if (pos >= LUDO_BOARD_SIZE) {
        const endCell = document.querySelector('.ludo-cell.end');
        if (endCell) {
          pieceEl.style.left = `${endCell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${endCell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      } else {
        const cell = document.querySelector(`.ludo-cell[data-index="${pos}"]`);
        if (cell) {
          pieceEl.style.left = `${cell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${cell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      }
    });

    const logContainer = document.getElementById('ludo-game-log');
    // ★ 核心修改：在map函数中加入 index 参数
    logContainer.innerHTML = ludoGameState.gameLog
      .map((log, index) => {
        // ★ 核心修改：判断是否为AI发言
        if (log.type === 'char') {
          // ★ 核心修改：为AI发言添加重roll按钮
          return `
                <div class="log-entry char">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${log.message.replace(/\n/g, '<br>')}</span>
<button class="ludo-reroll-btn" data-log-index="${index}" title="Để người ấy nói cách khác" style="background:none; border:none; cursor:pointer; padding:0 5px; color:var(--text-secondary);">
                           <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }
        // 其他类型的日志保持原样
        return `<div class="log-entry ${log.type}">${log.message.replace(/\n/g, '<br>')}</div>`;
      })
      .join('');
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【全新】飞行棋专用的用户输入函数
   * @param {string} promptText - 提示文字 (虽然我们没用上，但保留接口)
   * @param {string} placeholder - 输入框的占位文字
   * @returns {Promise<string>} - 返回用户的输入内容
   */
  function waitForLudoUserAction(promptText, placeholder) {
    return new Promise(resolve => {
      const actionArea = document.getElementById('ludo-action-area');
      actionArea.innerHTML = ''; // 清空旧内容（比如骰子）
      actionArea.classList.add('speaking-mode'); // 复用剧本杀的发言样式

      const textarea = document.createElement('textarea');
      textarea.id = 'ludo-user-speech-input'; // 使用新ID，避免冲突
      textarea.rows = 1;
      textarea.placeholder = placeholder || 'Nhập câu trả lời của bạn...';

      // 实时调整高度
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'form-button'; // 使用通用按钮样式
      confirmBtn.textContent = 'Xác nhận trả lời';

      actionArea.appendChild(textarea);
      actionArea.appendChild(confirmBtn);
      textarea.focus();

      confirmBtn.onclick = () => {
        const answer = textarea.value.trim() || '...(bỏ qua)';
        actionArea.innerHTML = ''; // 清空输入框和按钮
        actionArea.classList.remove('speaking-mode');
        resolve(answer);
      };
    });
  }
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  // ▼▼▼ 用这块【V2 - 支持新问题类型】的代码，完整替换你旧的 handleLudoQuestionEvent 函数 ▼▼▼
  async function handleLudoQuestionEvent(player) {
    // 1. 根据游戏状态获取问题库
    const questionBankId = ludoGameState.activeQuestionBankId;
    let questions = [];
    if (questionBankId) {
      questions = await db.ludoQuestions.where('bankId').equals(questionBankId).toArray();
    }

    // 2. 如果题库是空的，提示并直接进入下一回合
    if (questions.length === 0) {
      logToLudoGame('Kho câu hỏi hiện tại đang trống, bỏ qua lượt hỏi đáp này.', 'system');
      await sleep(1500);
      await advanceTurn(); // 别忘了切换回合
      return;
    }

    // 3. 随机抽一个问题
    const questionObj = getRandomItem(questions);
    const questionText = questionObj.text;

    // 4. 【核心】弹出模式选择框，让用户决定怎么玩
    const mode = await showAnswerModeSelector(questionText);
    if (!mode) {
      logToLudoGame('Người chơi đã hủy trả lời, trò chơi tiếp tục.', 'system');
      await advanceTurn(); // 取消也要切换回合
      return;
    }

    // 5. 根据选择的模式，执行不同的流程
    logToLudoGame(
      `【${mode === 'both_answer' ? 'Cùng trả lời' : 'Một người trả lời, một người nhận xét'}】 rút được câu hỏi: "${questionText}"`,
      'system',
    );
    await sleep(1500);

    const currentPlayer = player;
    const otherPlayer = ludoGameState.players.find(p => p.id !== currentPlayer.id);

    // --- 流程分支 ---
    if (mode === 'both_answer') {
      logToLudoGame(`Mời <strong>${currentPlayer.name}</strong> trả lời trước.`, 'system');
      let answer1 = currentPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer1}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`Bây giờ mời <strong>${otherPlayer.name}</strong> trả lời.`, 'system');
      let answer2 = otherPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${answer2}`, otherPlayer.isUser ? 'user' : 'char');
    } else if (mode === 'single_answer') {
      logToLudoGame(`Mời <strong>${currentPlayer.name}</strong> trả lời trước.`, 'system');
      let answer = currentPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`Bây giờ mời <strong>${otherPlayer.name}</strong> nhận xét về câu trả lời của người ấy nhé.`, 'system');
      let evaluation = otherPlayer.isUser
        ? await waitForLudoUserAction(`Nhận xét về "${answer}"`, 'Nhập nhận xét của bạn...')
        : await triggerLudoAiAction('evaluate_answer', { question: questionText, answer: answer });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${evaluation}`, otherPlayer.isUser ? 'user' : 'char');
    }

    // 6. 问答流程结束后，提示并切换到下一回合
    await sleep(1500);
    logToLudoGame('Lượt hỏi đáp này kết thúc, trò chơi tiếp tục!', 'system');
    await advanceTurn();
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【飞行棋】添加一条游戏日志
   */
  function logToLudoGame(message, type) {
    ludoGameState.gameLog.push({ message, type });
    renderLudoGameScreen();
  }
  // ▼▼▼ 在这里粘贴下面的新函数 ▼▼▼
  /**
   * 【全新】一个带“魔法”的掷骰子函数
   * @param {object} player - 正在掷骰子的玩家对象
   * @returns {number} - 最终的骰子点数
   */
  function rollTheDice(player) {
    // 如果玩家还在起点（没有起飞）
    if (player.piecePosition === -1) {
      // 就有50%的超高概率直接掷出6！
      if (Math.random() < 0.5) {
        return 6;
      }
      // 另外50%的概率，随机掷出1-5
      return Math.floor(Math.random() * 5) + 1;
    }
    // 如果已经起飞了，就恢复正常的公平骰子
    return Math.floor(Math.random() * 6) + 1;
  }
  // ▲▲▲ 新函数粘贴结束 ▲▲▲

  /**
   * 【飞行棋】游戏主循环
   */
  async function processLudoTurn() {
    if (!ludoGameState.isActive) return;

    const currentPlayer = ludoGameState.players[ludoGameState.currentTurnIndex];
    logToLudoGame(`Tới lượt <strong>${currentPlayer.name}</strong> hành động.`, 'system');

    if (currentPlayer.isUser) {
      // 用户回合
      const actionArea = document.getElementById('ludo-action-area');
      actionArea.innerHTML = `
            <div id="ludo-dice-container" title="Bấm để tung xúc xắc">
                <div class="dice">
                    <div class="face front">1</div><div class="face back">6</div>
                    <div class="face right">3</div><div class="face left">4</div>
                    <div class="face top">2</div><div class="face bottom">5</div>
                </div>
            </div>
        `;
      document.getElementById('ludo-dice-container').onclick = handleUserRollDice;
    } else {
      // AI回合
      document.getElementById('ludo-action-area').innerHTML = `<p>${currentPlayer.name} đang suy nghĩ...</p>`;
      await sleep(2000);
      const diceRoll = rollTheDice(currentPlayer);
      await handlePlayerMove(currentPlayer, diceRoll, false);
    }
  }

  /**
   * 【飞行棋】处理用户掷骰子
   */
  async function handleUserRollDice() {
    if (ludoGameState.isDiceRolling) return;
    ludoGameState.isDiceRolling = true;

    const diceEl = document.querySelector('.dice');
    diceEl.classList.add('rolling');
    document.getElementById('ludo-dice-container').onclick = null; // 防止重复点击

    const userPlayer = ludoGameState.players.find(p => p.isUser); // 先找到用户玩家对象
    const diceRoll = rollTheDice(userPlayer); // 调用新函数

    setTimeout(async () => {
      diceEl.classList.remove('rolling');
      // 根据点数旋转到对应面 (这是一个简化的视觉效果)
      const rotations = {
        1: 'rotateY(0deg)',
        2: 'rotateX(-90deg)',
        3: 'rotateY(-90deg)',
        4: 'rotateY(90deg)',
        5: 'rotateX(90deg)',
        6: 'rotateY(180deg)',
      };
      diceEl.style.transform = rotations[diceRoll];

      const userPlayer = ludoGameState.players.find(p => p.isUser);
      await handlePlayerMove(userPlayer, diceRoll, true);

      ludoGameState.isDiceRolling = false;
    }, 1500);
  }

  // ▼▼▼ 用这块【已修复】的代码，完整替换你旧的 handlePlayerMove 函数 ▼▼▼
  async function handlePlayerMove(player, diceRoll, isUserMove) {
    logToLudoGame(
      `<strong>${player.name}</strong> tung được <strong>${diceRoll}</strong> điểm!`,
      isUserMove ? 'user' : 'char',
    );

    if (player.piecePosition === -1) {
      // 如果棋子还在起点
      if (diceRoll === 6) {
        player.piecePosition = 0; // 起飞到第0格
        logToLudoGame(`Quân của <strong>${player.name}</strong> đã xuất phát!`, 'system');
        renderLudoGameScreen();

        if (!isUserMove) {
          await triggerLudoAiAction('roll_6');
        }
        logToLudoGame(`Tung được 6 điểm, <strong>${player.name}</strong> được đi thêm một lượt.`, 'system');
        await sleep(1000);
        await processLudoTurn(); // 重新执行当前玩家的回合
      } else {
        logToLudoGame('Không phải 6 điểm, không thể xuất quân.', 'system');
        await advanceTurn(); // 切换到下一位玩家
      }
      return; // 结束本次移动处理
    }

    // --- ▼▼▼ 核心修复从这里开始 ▼▼▼ ---

    const newPosition = player.piecePosition + diceRoll;
    const finalPositionIndex = LUDO_BOARD_SIZE - 1; // 终点格子的索引

    // 1. 【核心修改】只要新位置大于或等于终点，就直接判定胜利！
    if (newPosition >= finalPositionIndex) {
      player.piecePosition = finalPositionIndex; // 无论掷出几点，都让棋子停在终点格子上
      renderLudoGameScreen();
      logToLudoGame(`🎉 <strong>${player.name}</strong> đã về đích!`, 'system');
      await triggerLudoAiAction(isUserMove ? 'user_win' : 'char_win');
      ludoGameState.isActive = false;
      document.getElementById('ludo-action-area').innerHTML = '';
      await sleep(1000);
      showLudoSummary(player.name); // 显示结算界面
      return; // 游戏结束，直接返回
    }
    // 2. 如果不是胜利，就正常移动
    else {
      player.piecePosition = newPosition;
    }

    // --- ▲▲▲ 核心修复到这里结束 ▲▲▲ ---

    renderLudoGameScreen();
    await sleep(500);

    // 检查是否踩到对方棋子
    const opponent = ludoGameState.players.find(p => p.id !== player.id);
    if (player.piecePosition === opponent.piecePosition && opponent.piecePosition !== -1) {
      opponent.piecePosition = -1; // 将对方棋子送回起点
      logToLudoGame(`💥 <strong>${player.name}</strong> đã đá trúng <strong>${opponent.name}</strong>!`, 'system');
      renderLudoGameScreen();
      await triggerLudoAiAction(isUserMove ? 'kick_char' : 'kick_user');
      await sleep(1000);
    }

    // ▼▼▼ 请用这块【新代码】替换旧的“检查是否踩到事件格子”的 if 语句块 ▼▼▼

    // 检查是否踩到事件格子
    const cellIndex = ludoGameState.boardLayout.findIndex(c => c && c.index === player.piecePosition);
    if (cellIndex > -1 && ludoGameState.boardLayout[cellIndex].event) {
      const cellData = ludoGameState.boardLayout[cellIndex];
      const eventType = cellData.event;
      if (eventType === 'question') {
        // 【核心修改】将格子上的问题对象，直接传给处理函数
        await handleLudoQuestionEvent(player, cellData.question);
        return;
      }
    }
    // ▲▲▲ 替换结束 ▲▲▲

    // 如果掷出6点，再行动一次
    if (diceRoll === 6) {
      if (!isUserMove) {
        await triggerLudoAiAction('roll_6');
      }
      logToLudoGame(`Tung được 6 điểm, <strong>${player.name}</strong> được đi thêm một lượt.`, 'system');
      await sleep(1000);
      await processLudoTurn();
    } else {
      await advanceTurn(); // 否则切换到下一位玩家
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【飞行棋】推进到下一个回合
   */
  async function advanceTurn() {
    ludoGameState.currentTurnIndex = (ludoGameState.currentTurnIndex + 1) % ludoGameState.players.length;
    await processLudoTurn();
  }

  // ▼▼▼ 用这块【优化后】的代码，完整替换你旧的 triggerLudoAiAction 函数 ▼▼▼
  async function triggerLudoAiAction(eventType, context = {}) {
    const aiPlayer = ludoGameState.players.find(p => !p.isUser);
    const userPlayer = ludoGameState.players.find(p => p.isUser);

    const eventPrompts = {
      roll_6: 'Bạn tung được 6 điểm, được đi thêm một lượt!',
      kick_char: 'Bạn vừa đá tôi về vạch xuất phát!',
      kick_user: 'Tôi vừa đá quân của bạn về vạch xuất phát!',
      char_win: 'Tôi đã thắng ván này!',
      user_win: 'Bạn đã thắng ván này!',
    };

    let eventPrompt = eventPrompts[eventType] || 'Hãy tự do phản ứng theo tình huống hiện tại.';

    // --- ▼▼▼ 核心修改1：为不同的问答场景提供更详细的指令 ▼▼▼ ---
    if (eventType === 'answer_question') {
      eventPrompt = `Bây giờ hãy dựa vào thiết lập nhân vật để trả lời chi tiết câu hỏi này: "${context.question}"`;
    } else if (eventType === 'evaluate_answer') {
      eventPrompt = `Với câu hỏi "${context.question}", câu trả lời của đối phương là: "${context.answer}". Bây giờ hãy với tư cách nhân vật của bạn, nhận xét hoặc bày tỏ cảm nhận chi tiết về câu trả lời này.`;
    }
    // ★★★ 在这里粘贴下面的新代码 ★★★
    else if (eventType === 'reroll_comment') {
      eventPrompt = `Trước đó bạn đã nói: "${context.originalSpeech}". Hãy nói theo cách khác, nhưng thể hiện cảm xúc hoặc ý nghĩa tương tự.`;
    }
    // ★★★ 粘贴结束 ★★★
    const systemPrompt = `
# Chỉ thị nhập vai
Bạn đang chơi một ván cờ cá ngựa online đầy rung động với người yêu (${userPlayer.name}).
Tên của bạn là "${aiPlayer.name}", thiết lập nhân vật là: ${aiPlayer.persona}
Câu trả lời của bạn phải hoàn toàn phù hợp thiết lập nhân vật, bày tỏ cảm xúc một cách tự nhiên. Viết bằng tiếng Việt.

# Trạng thái trò chơi hiện tại
- Vị trí quân của bạn: ${aiPlayer.piecePosition}
- Vị trí quân của đối phương: ${userPlayer.piecePosition}
- Lượt hiện tại: tới lượt ${ludoGameState.players[ludoGameState.currentTurnIndex].name}

# Sự kiện vừa xảy ra
${eventPrompt}

# Nhiệm vụ của bạn
Dựa vào toàn bộ thông tin trên, tạo một đoạn phản hồi phù hợp thiết lập nhân vật. Phản hồi có thể gồm hành động, hoạt động tâm lý và lời thoại để tương tác sinh động hơn, phải thật sát với thiết lập nhân vật, lấy thiết lập làm chủ.

# Định dạng đầu ra
Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
{"speech": "phản hồi của bạn..."}
`;

    try {
      const { proxyUrl, apiKey, model } = state.apiConfig;
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiResponse = JSON.parse(content);
      // ★★★ 在这里粘贴下面的新代码 ★★★
      // 如果是重roll请求，直接返回新的发言内容
      if (eventType === 'reroll_comment') {
        return aiResponse.speech || 'Ừm... thôi được.';
      }
      // ★★★ 粘贴结束 ★★★
      if (eventType === 'answer_question' || eventType === 'evaluate_answer') {
        return aiResponse.speech || 'Ừm... để tôi nghĩ đã.';
      }

      if (aiResponse.speech) {
        logToLudoGame(`<strong>${aiPlayer.name}:</strong> ${aiResponse.speech}`, 'char');
      }
    } catch (error) {
      console.error('飞行棋AI响应失败:', error);
      if (eventType === 'answer_question' || eventType === 'evaluate_answer') {
        return 'Tôi... tôi không biết trả lời thế nào nữa.';
      }
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【最终智能版 | 问题数量精确匹配】用这块代码，完整替换你旧的 generateLudoBoard 函数 ▼▼▼
  /**
   * 【飞行棋】生成棋盘格子 (V4 - 问题数量精确匹配版)
   */
  async function generateLudoBoard() {
    const boardEl = document.getElementById('ludo-board');
    boardEl.innerHTML = '';
    const pathCoordinates = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 0],
      [9, 0],
      [9, 1],
      [9, 2],
      [8, 2],
      [7, 2],
      [6, 2],
      [5, 2],
      [4, 2],
      [3, 2],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [8, 4],
      [9, 4],
      [9, 5],
      [8, 5],
      [7, 5],
      [6, 5],
      [5, 5],
      [4, 5],
      [3, 5],
      [2, 5],
      [1, 5],
      [0, 5],
    ];

    let cells = Array(60).fill(null);
    pathCoordinates.slice(0, LUDO_BOARD_SIZE).forEach((coord, i) => {
      const pos = coord[1] * 10 + coord[0];
      cells[pos] = { type: 'path', index: i };
    });

    cells[21] = { type: 'start', index: -1 };
    cells[38] = { type: 'end', index: LUDO_BOARD_SIZE };

    // --- ▼▼▼ 这就是本次的【核心修改】 ▼▼▼ ---

    // 1. 获取当前游戏选择的问题库ID
    const questionBankId = ludoGameState.activeQuestionBankId;
    let questionsInBank = [];

    // 2. 从数据库中加载该问题库的所有问题
    if (questionBankId) {
      questionsInBank = await db.ludoQuestions.where('bankId').equals(questionBankId).toArray();
    }

    // ▼▼▼ 请用这块【全新的代码】替换掉函数中从 “// 4. 筛选出所有可以放置问题的普通格子...” 开始的那一大段逻辑 ▼▼▼

    // 4. 筛选出所有可以放置问题的普通格子
    const availableCellIndices = [];
    cells.forEach((cellData, index) => {
      if (cellData && cellData.type === 'path' && cellData.index > 0) {
        availableCellIndices.push(index);
      }
    });

    // 5. 【核心修改】我们不再打乱问题库，而是打乱可用的格子索引！
    availableCellIndices.sort(() => Math.random() - 0.5);

    // 6. 确定要放置的问题数量，仍然是取问题数和可用格子数的最小值
    const questionCount = Math.min(questionsInBank.length, availableCellIndices.length);

    if (questionsInBank.length > availableCellIndices.length) {
      console.warn(
        `飞行棋警告：问题库中的问题数量(${questionsInBank.length})超过了棋盘上的可用格子数量(${availableCellIndices.length})，部分问题将不会出现。`,
      );
    }

    // 7. 将问题库里的问题，按顺序放置到【被打乱顺序】的格子里
    for (let i = 0; i < questionCount; i++) {
      // 这次我们是从被打乱的格子列表里取出一个随机的格子
      const cellIndexToModify = availableCellIndices[i];
      // 然后按顺序从问题库里拿一个问题放上去
      const questionToPlace = questionsInBank[i];

      if (cells[cellIndexToModify]) {
        cells[cellIndexToModify].event = 'question';
        cells[cellIndexToModify].question = questionToPlace;
      }
    }
    // ▲▲▲ 替换结束 ▲▲▲

    ludoGameState.boardLayout = cells;

    // 后续的渲染逻辑保持不变...
    cells.forEach((cellData, i) => {
      if (cellData) {
        const cellEl = document.createElement('div');
        cellEl.className = 'ludo-cell';

        if (cellData.type === 'path') {
          cellEl.dataset.index = cellData.index;
          cellEl.innerHTML = `<span class="cell-number">${cellData.index + 1}</span>`;
        }
        if (cellData.type === 'start') {
          cellEl.classList.add('start');
          cellEl.innerHTML = '🏠';
        }
        if (cellData.type === 'end') {
          cellEl.classList.add('end');
          cellEl.innerHTML = '🏁';
        }
        if (cellData.event === 'question') {
          cellEl.classList.add(`event-truth`);
          cellEl.innerHTML += '❓';
        }

        const position = ludoGameState.boardLayout.indexOf(cellData);
        const row = Math.floor(position / 10);
        const col = position % 10;
        cellEl.style.gridRowStart = row + 1;
        cellEl.style.gridColumnStart = col + 1;

        boardEl.appendChild(cellEl);
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 把这一整块全新的功能函数，粘贴到 init() 函数的【正上方】 ▼▼▼

  // ▼▼▼ 用这整块新代码，替换掉所有旧的飞行棋问题库核心函数 ▼▼▼

  /* --- 【全新 | V2分类版】飞行棋问题库功能核心函数 --- */

  let activeQuestionBankId = null; // 用于追踪正在编辑的问题库ID
  let editingQuestionId = null; // 用于追踪正在编辑的问题ID
  function hideCustomModal() {
    modalOverlay.classList.remove('visible');
    modalConfirmBtn.classList.remove('btn-danger');
    if (modalResolve) modalResolve(null);
  }
  // ▼▼▼ 用这块【已修复】的代码，完整替换你旧的 migrateDefaultLudoQuestions 函数 ▼▼▼
  /**
   * 【数据迁移】在首次加载时，将旧的硬编码问题迁移到数据库
   */
  async function migrateDefaultLudoQuestions() {
    const defaultBankName = 'Kho câu hỏi mặc định';
    const existingBank = await db.ludoQuestionBanks.where('name').equals(defaultBankName).first();
    // 如果“默认题库”已经存在，就说明迁移过了，直接返回
    if (existingBank) return;

    console.log('正在迁移飞行棋默认问题到数据库...');

    // 创建默认题库
    const bankId = await db.ludoQuestionBanks.add({ name: defaultBankName });

    // ★★★ 核心修改：将问题库改为对象数组，并为每个问题添加类型 ★★★
    const defaultQuestions = [
      // --- 类型1: 共同回答 (双方都需要回答) ---
      { type: 'both_answer', text: 'Nếu chúng ta cùng đi du lịch, bạn muốn đến đâu nhất, vì sao?' },
      { type: 'both_answer', text: 'Bạn nghĩ ba yếu tố không thể thiếu nhất trong một mối quan hệ hoàn hảo là gì?' },
      { type: 'both_answer', text: 'Chia sẻ một chuyện nhỏ gần đây khiến bạn rung động hoặc vui vẻ vì tôi.' },
      { type: 'both_answer', text: 'Nhớ lại xem, lần đầu gặp nhau, ấn tượng đầu tiên của bạn về tôi là gì?' },
      { type: 'both_answer', text: 'Nếu chúng ta có thể cùng học một kỹ năng mới, bạn mong đó là gì?' },
      { type: 'both_answer', text: 'Mô tả một cuối tuần hoàn hảo mà bạn mong được cùng tôi trải qua nhất.' },
      { type: 'both_answer', text: 'Bạn thấy chuyện gì là sự ăn ý nhất giữa chúng ta?' },
      { type: 'both_answer', text: 'Nếu dùng một con vật để miêu tả tôi, bạn nghĩ là con gì? Vì sao?' },
      { type: 'both_answer', text: 'Trong một năm tới, điều bạn muốn cùng tôi hoàn thành nhất là gì?' },
      { type: 'both_answer', text: 'Chia sẻ một bộ phim hoặc phim bộ bạn rất thích gần đây và muốn giới thiệu cho tôi xem cùng.' },
      { type: 'both_answer', text: 'Lần hẹn hò tới, bạn mong tôi mặc phong cách gì?' },

      // --- 类型2: 一人回答，对方评价 ---
      { type: 'single_answer', text: 'Mô tả một khoảnh khắc tôi khiến bạn rung động nhất.' },
      { type: 'single_answer', text: 'Nói thật đi, tôi đã làm chuyện gì từng khiến bạn lén giận?' },
      { type: 'single_answer', text: 'Nếu tôi có một siêu năng lực, bạn mong đó là gì?' },
      { type: 'single_answer', text: 'Cho tôi ba nhãn dán phù hợp nhất.' },
      { type: 'single_answer', text: 'Trong lòng bạn, hình tượng của tôi gần với mẫu người lý tưởng của bạn đến mức nào?' },
      { type: 'single_answer', text: 'Chia sẻ một bí mật nhỏ về bạn mà bạn nghĩ có lẽ tôi chưa biết.' },
      { type: 'single_answer', text: 'Nếu câu chuyện của chúng ta là một bài hát, bạn nghĩ tên bài nên là gì?' },
      { type: 'single_answer', text: 'Kể một chuyện mà bạn thấy tôi làm tốt hơn/giỏi hơn bạn.' },
      { type: 'single_answer', text: 'Nếu có thể quay lại một ngày bất kỳ kể từ khi quen nhau, bạn sẽ chọn ngày nào, và muốn làm gì?' },
      { type: 'single_answer', text: 'Dùng ba từ để miêu tả mối quan hệ của chúng ta trong mắt bạn.' },
    ];

    const questionsToAdd = defaultQuestions.map(q => ({
      bankId: bankId,
      text: q.text,
      type: q.type, // <-- 关键修复：把类型也存进去！
    }));

    await db.ludoQuestions.bulkAdd(questionsToAdd);
    console.log(`成功迁移了 ${questionsToAdd.length} 条默认问题。`);
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 打开问题库管理弹窗
   */
  async function openLudoQuestionBankManager() {
    await renderLudoQuestionBanks();
    document.getElementById('ludo-qbank-manager-modal').classList.add('visible');
  }

  /**
   * 渲染问题库列表
   */
  async function renderLudoQuestionBanks() {
    const listEl = document.getElementById('ludo-qbank-list');
    listEl.innerHTML = '';
    const banks = await db.ludoQuestionBanks.toArray();

    if (banks.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa có kho câu hỏi nào, bấm "Tạo mới" ở góc trên bên phải để tạo một kho nhé!</p>';
    } else {
      banks.forEach(bank => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div class="item-title">${bank.name}</div>`;
        item.addEventListener('click', () => openLudoQuestionEditor(bank.id, bank.name));
        addLongPressListener(item, async () => {
          // ▼▼▼ 核心修改在这里：在菜单里增加一个 'export' 选项 ▼▼▼
          const choice = await showChoiceModal(`Thao tác với "${bank.name}"`, [
            { text: '✏️ Đổi tên', value: 'rename' },
            { text: '📤 Xuất', value: 'export' }, // <-- 新增的导出选项
            { text: '🗑️ Xóa', value: 'delete', isDanger: true },
          ]);

          if (choice === 'rename') {
            const newName = await showCustomPrompt('Đổi tên kho câu hỏi', 'Nhập tên mới:', bank.name);
            if (newName && newName.trim()) {
              await db.ludoQuestionBanks.update(bank.id, { name: newName.trim() });
              await renderLudoQuestionBanks();
            }
          } else if (choice === 'export') {
            // ▼▼▼ 在这里调用我们新写的导出函数 ▼▼▼
            await exportLudoQuestionBank(bank.id);
          } else if (choice === 'delete') {
            const confirmed = await showCustomConfirm(
              'Xác nhận xóa',
              `Bạn có chắc muốn xóa kho câu hỏi "${bank.name}"? Việc này sẽ xóa luôn mọi câu hỏi trong kho.`,
              { confirmButtonClass: 'btn-danger' },
            );
            if (confirmed) {
              await db.transaction('rw', db.ludoQuestionBanks, db.ludoQuestions, async () => {
                await db.ludoQuestions.where('bankId').equals(bank.id).delete();
                await db.ludoQuestionBanks.delete(bank.id);
              });
              await renderLudoQuestionBanks();
            }
          }
        });
        listEl.appendChild(item);
      });
    }
  }

  /**
   * 添加一个新的问题库
   */
  async function addNewLudoQuestionBank() {
    const name = await showCustomPrompt('Tạo kho câu hỏi mới', 'Nhập tên kho câu hỏi:');
    if (name && name.trim()) {
      await db.ludoQuestionBanks.add({ name: name.trim() });
      await renderLudoQuestionBanks();
    }
  }

  /**
   * 打开指定问题库的问题编辑器
   */
  async function openLudoQuestionEditor(bankId, bankName) {
    activeQuestionBankId = bankId;
    document.getElementById('ludo-question-editor-title').textContent = `Sửa - ${bankName}`;
    await renderLudoQuestionsInBank(bankId);
    document.getElementById('ludo-question-editor-modal').classList.add('visible');
  }

  /**
   * 渲染一个问题库中的所有问题
   */
  async function renderLudoQuestionsInBank(bankId) {
    const listEl = document.getElementById('ludo-question-list');
    listEl.innerHTML = '';
    const questions = await db.ludoQuestions.where('bankId').equals(bankId).toArray();

    if (questions.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Kho câu hỏi này vẫn còn trống, bấm "+" ở góc trên bên phải để thêm câu hỏi đầu tiên nhé!</p>';
    } else {
      questions.forEach(q => {
        const item = document.createElement('div');
        item.className = 'list-item';

        // ★★★ 核心修改：根据问题类型添加标签 ★★★
        const typeText = q.type === 'single_answer' ? 'Một người trả lời' : 'Cùng trả lời';
        const typeClass = q.type === 'single_answer' ? 'single-answer' : 'both-answer';

        item.innerHTML = `
                <div class="item-title" style="white-space: normal; display: flex; align-items: center;">
                    <span>${q.text}</span>
                    <span class="question-type-tag ${typeClass}">${typeText}</span>
                </div>
            `;

        item.addEventListener('click', () => openSingleQuestionEditor(q.id));
        addLongPressListener(item, async () => {
          const confirmed = await showCustomConfirm('Xóa câu hỏi', 'Bạn có chắc muốn xóa câu hỏi này?', {
            confirmButtonClass: 'btn-danger',
          });
          if (confirmed) {
            await db.ludoQuestions.delete(q.id);
            await renderLudoQuestionsInBank(bankId);
          }
        });
        listEl.appendChild(item);
      });
    }
  }

  /**
   * 打开单个问题编辑器（用于新建或编辑）
   */
  async function openSingleQuestionEditor(questionId = null) {
    editingQuestionId = questionId;
    const modal = document.getElementById('ludo-single-question-editor-modal');
    const titleEl = document.getElementById('ludo-single-question-title');
    const textInput = document.getElementById('ludo-question-text-input');
    const typeRadios = document.querySelectorAll('input[name="ludo_question_type"]');

    if (questionId) {
      // 编辑模式
      const question = await db.ludoQuestions.get(questionId);
      if (!question) return;
      titleEl.textContent = 'Sửa câu hỏi';
      textInput.value = question.text;
      typeRadios.forEach(radio => (radio.checked = radio.value === (question.type || 'both_answer')));
    } else {
      // 新建模式
      titleEl.textContent = 'Thêm câu hỏi mới';
      textInput.value = '';
      typeRadios[0].checked = true; // 默认选中“共同回答”
    }

    modal.classList.add('visible');
  }

  /**
   * 保存单个问题（新建或更新）
   */
  async function saveSingleQuestion() {
    const text = document.getElementById('ludo-question-text-input').value.trim();
    if (!text) {
      alert('Nội dung câu hỏi không được để trống!');
      return;
    }
    const type = document.querySelector('input[name="ludo_question_type"]:checked').value;

    if (editingQuestionId) {
      // 更新
      await db.ludoQuestions.update(editingQuestionId, { text, type });
    } else {
      // 新建
      await db.ludoQuestions.add({ bankId: activeQuestionBankId, text, type });
    }

    document.getElementById('ludo-single-question-editor-modal').classList.remove('visible');
    await renderLudoQuestionsInBank(activeQuestionBankId); // 刷新列表
    editingQuestionId = null;
  }

  // ▼▼▼ 请用这块【全新的函数】完整替换旧的 handleLudoQuestionEvent 函数 ▼▼▼

  /**
   * 【飞行棋】处理踩中问题格子的事件 (V3 - 直接使用传入的问题)
   */
  async function handleLudoQuestionEvent(player, questionObj) {
    // 1. 安全检查：如果因为某种原因没有拿到问题，就跳过
    if (!questionObj || !questionObj.text) {
      logToLudoGame('Không tìm thấy câu hỏi, bỏ qua lượt hỏi đáp này.', 'system');
      await sleep(1500);
      await advanceTurn();
      return;
    }

    // 2. 直接使用传入的问题对象，不再随机抽取
    const questionText = questionObj.text;
    const mode = questionObj.type || 'both_answer'; // 直接从问题对象获取模式

    logToLudoGame(
      `【${mode === 'both_answer' ? 'Cùng trả lời' : 'Một người trả lời, một người nhận xét'}】 rút được câu hỏi: "${questionText}"`,
      'system',
    );
    await sleep(1500);

    const currentPlayer = player;
    const otherPlayer = ludoGameState.players.find(p => p.id !== currentPlayer.id);

    // --- 流程分支 (这部分逻辑保持不变) ---
    if (mode === 'both_answer') {
      logToLudoGame(`Mời <strong>${currentPlayer.name}</strong> trả lời trước.`, 'system');
      let answer1 = currentPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer1}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`Bây giờ mời <strong>${otherPlayer.name}</strong> trả lời.`, 'system');
      let answer2 = otherPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${answer2}`, otherPlayer.isUser ? 'user' : 'char');
    } else if (mode === 'single_answer') {
      logToLudoGame(`Mời <strong>${currentPlayer.name}</strong> trả lời câu hỏi này.`, 'system');
      let answer = currentPlayer.isUser
        ? await waitForLudoUserAction('Tới lượt bạn trả lời câu hỏi', 'Nhập câu trả lời của bạn...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`Bây giờ mời <strong>${otherPlayer.name}</strong> nhận xét về câu trả lời của người ấy nhé.`, 'system');
      let evaluation = otherPlayer.isUser
        ? await waitForLudoUserAction(`Nhận xét về "${answer}"`, 'Nhập nhận xét của bạn...')
        : await triggerLudoAiAction('evaluate_answer', { question: questionText, answer: answer });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${evaluation}`, otherPlayer.isUser ? 'user' : 'char');
    }

    await sleep(1500);
    logToLudoGame('Lượt hỏi đáp này kết thúc, trò chơi tiếp tục!', 'system');
    await advanceTurn();
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【全新】显示飞行棋游戏结算卡片
   * @param {string} winnerName - 胜利者的名字
   */
  function showLudoSummary(winnerName) {
    const modal = document.getElementById('ludo-summary-modal');
    const contentEl = document.getElementById('ludo-summary-content');

    // 1. 提取问答记录
    let qaLogHtml = '<h4>Nhật ký hỏi đáp rung động</h4>';
    const questionsAndAnswers = [];
    let currentQuestion = null;

    ludoGameState.gameLog.forEach(log => {
      // 通过识读系统日志里的特定文本来找到“问题”
      if (log.type === 'system' && log.message.includes('rút được câu hỏi')) {
        const questionText = log.message.match(/“(.+?)”/);
        if (questionText && questionText[1]) {
          currentQuestion = { question: questionText[1], answers: [] };
          questionsAndAnswers.push(currentQuestion);
        }
      }
      // 如果我们刚刚找到了一个问题，那么后续的用户或角色发言就是“回答”
      else if (currentQuestion && (log.type === 'user' || log.type === 'char') && !log.message.includes('tung được')) {
        const answerText = log.message.replace(/<strong>.*?<\/strong>:\s*/, '');
        const speakerNameMatch = log.message.match(/<strong>(.*?)<\/strong>/);
        if (speakerNameMatch && speakerNameMatch[1]) {
          currentQuestion.answers.push({ speaker: speakerNameMatch[1], text: answerText });
        }
      }
    });

    // 2. 将提取出的问答记录格式化为HTML
    if (questionsAndAnswers.length > 0) {
      questionsAndAnswers.forEach((qa, index) => {
        qaLogHtml += `<div class="qa-item">
                <div class="qa-question">Q${index + 1}: ${qa.question}</div>`;
        qa.answers.forEach(ans => {
          qaLogHtml += `<div class="qa-answer"><strong>${ans.speaker}:</strong> ${ans.text}</div>`;
        });
        qaLogHtml += `</div>`;
      });
    } else {
      qaLogHtml += '<p>Ván này không kích hoạt lượt hỏi đáp nào.</p>';
    }

    // 3. 拼接完整的结算卡片内容
    contentEl.innerHTML = `
        <h3>🎉 Chúc mừng ${winnerName} chiến thắng! 🎉</h3>
        <div class="ludo-qa-log">${qaLogHtml}</div>
    `;

    // 4. 为按钮绑定事件 (使用克隆节点技巧防止重复绑定)
    const shareBtn = document.getElementById('share-ludo-summary-btn');
    const backBtn = document.getElementById('back-to-hall-from-ludo-btn');

    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    newShareBtn.onclick = () => {
      // 准备纯文本格式的复盘内容用于分享
      const summaryForShare =
        `Ván cờ cá ngựa kết thúc rồi! 🎉\n\nNgười thắng: ${winnerName}\n\n--- Hỏi đáp rung động ---\n` +
        questionsAndAnswers
          .map(
            (qa, i) => `Q${i + 1}: ${qa.question}\n` + qa.answers.map(ans => `${ans.speaker}: ${ans.text}`).join('\n'),
          )
          .join('\n\n');

      shareLudoSummary(summaryForShare, winnerName);
    };

    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    // 5. 显示结算弹窗
    modal.classList.add('visible');
  }

  /**
   * 【全新】将飞行棋游戏复盘发送给对手
   * @param {string} summaryText - 要发送的复盘文本
   */
  async function shareLudoSummary(summaryText, winnerName) {
    const opponentId = ludoGameState.opponent?.id;
    if (!opponentId) {
      alert('Không tìm thấy thông tin đối thủ, không thể chia sẻ.');
      return;
    }

    const chat = state.chats[opponentId];
    if (!chat) {
      alert('Không tìm thấy cửa sổ chat với đối thủ, không thể chia sẻ.');
      return;
    }

    // 创建对用户可见的复盘消息
    const visibleMessage = {
      role: 'user',
      type: 'share_link',
      timestamp: Date.now(),
      title: 'Cờ cá ngựa rung động - Tổng kết ván',
      description: 'Bấm để xem tổng kết chi tiết',
      source_name: 'Trung tâm trò chơi',
      content: summaryText,
    };

    // 创建给AI看的隐藏指令，让它可以就游戏结果发表感想
    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván cờ cá ngựa. Quan trọng: người thắng ván này là 【${winnerName}】. Đây là bản tổng kết, hãy dựa vào kết quả này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;
    const hiddenInstruction = {
      role: 'system',
      content: aiContext,
      timestamp: Date.now() + 1,
      isHidden: true,
    };

    chat.history.push(visibleMessage, hiddenInstruction);
    await db.chats.put(chat);

    // 关闭结算卡片
    document.getElementById('ludo-summary-modal').classList.remove('visible');

    await showCustomAlert('Chia sẻ thành công', `Đã gửi bản tổng kết vào chat với "${chat.name}"!`);

    window.openChat(chat.id);
    window.triggerAiResponse();
  }

  // ▲▲▲ 新增代码粘贴结束 ▲▲▲

  // ▼▼▼ 【全新】这是“谁是卧底”游戏的全部核心逻辑代码，请粘贴到 init() 函数前 ▼▼▼

  /**
   * 【卧底】打开游戏设置界面
   */
  async function openUndercoverSetup() {
    showScreen('undercover-setup-screen');
    const selectionEl = document.getElementById('undercover-player-selection');
    selectionEl.innerHTML = '<p>Đang tải danh sách nhân vật...</p>';

    // 复用狼人杀的玩家加载逻辑，非常方便
    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Nhân vật' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length < 2) {
      selectionEl.innerHTML =
        '<p style="text-align:center; padding-top: 50px; color: var(--text-secondary);">Bạn cần ít nhất 2 bạn bè AI hoặc NPC mới bắt đầu được trò chơi.</p>';
      document.getElementById('start-undercover-game-btn').disabled = true;
      return;
    }

    document.getElementById('start-undercover-game-btn').disabled = false;
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="undercover-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
  }

  /**
   * 【卧底V2】开始游戏的核心逻辑 (支持手动/随机邀请)
   */
  async function startUndercoverGame() {
    const inviteMode = document.querySelector('input[name="undercover_invite_mode"]:checked').value;
    let invitedPlayerInfos = [];
    let totalPlayers = 0;

    // --- 1. 根据邀请模式，收集被邀请的玩家信息 ---
    if (inviteMode === 'manual') {
      const selectedCheckboxes = document.querySelectorAll('.undercover-player-checkbox:checked');
      totalPlayers = selectedCheckboxes.length + 1;
      if (totalPlayers < 3) {
        alert(`Trò chơi cần ít nhất 3 người! Hiện đang chọn thủ công ${selectedCheckboxes.length} người.`);
        return;
      }
      selectedCheckboxes.forEach(checkbox => {
        const playerId = checkbox.value;
        const chat = Object.values(state.chats).find(c => c.id === playerId);
        if (chat) {
          invitedPlayerInfos.push({
            id: chat.id,
            name: chat.name,
            avatar: chat.settings.aiAvatar,
            persona: chat.settings.aiPersona,
            isUser: false,
          });
        } else {
          for (const c of Object.values(state.chats)) {
            const npc = (c.npcLibrary || []).find(n => n.id === playerId);
            if (npc) {
              invitedPlayerInfos.push({
                id: npc.id,
                name: npc.name,
                avatar: npc.avatar,
                persona: npc.persona,
                isUser: false,
              });
              break;
            }
          }
        }
      });
    } else {
      // 'random' mode
      const randomPlayerCount = parseInt(document.getElementById('undercover-random-player-count').value);
      if (isNaN(randomPlayerCount) || randomPlayerCount < 2) {
        alert('Số người mời ngẫu nhiên phải ít nhất 2 người!');
        return;
      }
      totalPlayers = randomPlayerCount + 1;

      const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
      const allNpcs = Object.values(state.chats).flatMap(chat =>
        (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
      );
      let allAvailablePlayers = [
        ...singleChats.map(c => ({
          id: c.id,
          name: c.name,
          avatar: c.settings.aiAvatar,
          persona: c.settings.aiPersona,
          isUser: false,
        })),
        ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, persona: n.persona, isUser: false })),
      ];

      if (allAvailablePlayers.length < randomPlayerCount) {
        alert(`Không đủ người chơi! Cần ${randomPlayerCount} người, nhưng chỉ có ${allAvailablePlayers.length} người để chọn.`);
        return;
      }

      allAvailablePlayers.sort(() => Math.random() - 0.5); // 洗牌
      invitedPlayerInfos = allAvailablePlayers.slice(0, randomPlayerCount); // 取出需要的人数
    }

    // --- 2. 重置并初始化游戏状态 ---
    undercoverGameState = {
      isActive: true,
      players: [],
      gamePhase: 'reveal_words',
      dayNumber: 1,
      gameLog: [],
      turnIndex: 0,
      votes: {},
      votedOutPlayers: [],
      tiedPlayers: [],
    };

    // --- 3. 让AI生成或从内置词库获取词语 ---
    let wordPair;
    try {
      wordPair = await generateUndercoverWordsAI();
    } catch (e) {
      await showCustomAlert('AI ra đề thất bại', 'Huhu, hôm nay AI hết cảm hứng rồi... sẽ dùng kho từ có sẵn để ra đề cho bạn!');
      const BUILT_IN_WORDS = [
        { civilian: 'Sữa bò', undercover: 'Sữa đậu nành' },
        { civilian: 'Cải thảo', undercover: 'Xà lách' },
        { civilian: 'Sủi cảo', undercover: 'Hoành thánh' },
        { civilian: 'Găng tay', undercover: 'Tất' },
        { civilian: 'Thư tình', undercover: 'Di thư' },
      ];
      wordPair = getRandomItem(BUILT_IN_WORDS);
    }
    undercoverGameState.civilianWord = wordPair.civilian;
    undercoverGameState.undercoverWord = wordPair.undercover;

    // --- 4. 添加玩家到游戏状态 ---
    const userPlayer = {
      id: 'user',
      name: state.qzoneSettings.nickname || 'Tôi',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isAlive: true,
      isUser: true,
    };
    undercoverGameState.players.push(userPlayer);
    invitedPlayerInfos.forEach(pInfo => {
      undercoverGameState.players.push({ ...pInfo, isAlive: true });
    });
    undercoverGameState.players.sort(() => Math.random() - 0.5); // 打乱座位顺序

    // --- 5. 分配角色和词语 ---
    let rolesToAssign = [];
    if (totalPlayers >= 3 && totalPlayers <= 5) {
      rolesToAssign.push('undercover');
    } else if (totalPlayers >= 6 && totalPlayers <= 8) {
      rolesToAssign.push('undercover');
      rolesToAssign.push('whiteboard');
    } else {
      rolesToAssign.push('undercover');
      rolesToAssign.push('undercover');
      rolesToAssign.push('whiteboard');
    }
    while (rolesToAssign.length < totalPlayers) {
      rolesToAssign.push('civilian');
    }
    rolesToAssign.sort(() => Math.random() - 0.5);

    undercoverGameState.players.forEach((player, index) => {
      const role = rolesToAssign[index];
      player.role = role;
      if (role === 'civilian') player.word = undercoverGameState.civilianWord;
      else if (role === 'undercover') player.word = undercoverGameState.undercoverWord;
      else if (role === 'whiteboard') player.word = null;
    });

    // --- 6. 切换到游戏界面并开始 ---
    showScreen('undercover-game-screen');
    await processUndercoverTurn();
  }

  // ▼▼▼ 【最终流程修复版】请用这整块代码，完整替换旧的 processUndercoverTurn 函数 ▼▼▼
  /**
   * 【卧底】游戏主循环/引擎 (V3 - 已修复轮次卡死问题)
   */
  async function processUndercoverTurn() {
    if (!undercoverGameState.isActive) return;

    renderUndercoverGameScreen();

    switch (undercoverGameState.gamePhase) {
      case 'reveal_words': {
        logToUndercoverGame(`Trò chơi bắt đầu, vòng ${undercoverGameState.dayNumber}. Hãy xem từ khóa của mình.`, 'system');
        const me = undercoverGameState.players.find(p => p.isUser);
        const roleName = { undercover: 'Gián điệp', civilian: 'Dân làng', whiteboard: 'Bạch bản' }[me.role] || 'Không xác định';
        const wordText = me.word ? `Từ khóa của bạn là: 【${me.word}】` : 'Bạn là bạch bản, cần dựa vào mô tả của người khác để đoán từ khóa của dân thường.';
        await showCustomAlert(`Vai trò của bạn là: 【${roleName}】`, wordText);

        undercoverGameState.gamePhase = 'description_round';
        await sleep(1000);
        await processUndercoverTurn();
        break;
      }

      case 'description_round': {
        logToUndercoverGame(`Vòng phát biểu thứ ${undercoverGameState.dayNumber} bắt đầu, mời lần lượt mô tả từ khóa của mình.`, 'system');

        const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
        for (const player of alivePlayers) {
          renderUndercoverGameScreen({ speakingPlayerId: player.id });
          let description;
          if (player.isUser) {
            description = await waitForUserUndercoverAction('Tới lượt bạn phát biểu', 'speak', {
              placeholder: 'Hãy dùng một câu để mô tả từ khóa của bạn...',
            });
          } else {
            description = await triggerUndercoverAiAction(player.id, 'describe');
          }
          logToUndercoverGame({ player: player, speech: description }, 'speech');
          await sleep(1000);
        }
        renderUndercoverGameScreen();
        undercoverGameState.gamePhase = 'voting_round';
        await sleep(1000);
        await processUndercoverTurn();
        break;
      }

      case 'voting_round': {
        logToUndercoverGame('Mô tả kết thúc, giờ bắt đầu bỏ phiếu.', 'system');
        undercoverGameState.votes = {}; // 清空上一轮的票
        const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
        for (const voter of alivePlayers) {
          let voteResult;
          if (voter.isUser) {
            voteResult = await waitForUserUndercoverAction('Hãy bỏ phiếu', 'vote');
          } else {
            voteResult = await triggerUndercoverAiAction(voter.id, 'vote');
          }

          if (voteResult && voteResult.voteForId) {
            const targetId = voteResult.voteForId;
            const reason = voteResult.reason || 'Không nêu lý do';
            const targetPlayer = undercoverGameState.players.find(p => p.id === targetId);

            if (targetPlayer) {
              logToUndercoverGame(
                `<strong>${voter.name}</strong> đã bỏ phiếu cho <strong>${targetPlayer.name}</strong>, lý do là: "${reason}"`,
              );
              undercoverGameState.votes[targetId] = (undercoverGameState.votes[targetId] || 0) + 1;
            }
          } else {
            const reason = voteResult ? voteResult.reason || 'Thông tin chưa đủ, không thể phán đoán.' : 'Thông tin chưa đủ, không thể phán đoán.';
            logToUndercoverGame(`<strong>${voter.name}</strong> đã bỏ phiếu trắng, lý do là: "${reason}"`);
          }
          await sleep(500);
        }

        undercoverGameState.gamePhase = 'elimination';
        await sleep(2000);
        await processUndercoverTurn();
        break;
      }

      case 'elimination': {
        logToUndercoverGame('Bỏ phiếu kết thúc, đang kiểm phiếu...', 'system');
        await sleep(2000);

        const voteCounts = undercoverGameState.votes;
        let maxVotes = 0;
        let playersToEliminate = [];

        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            playersToEliminate = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length > 1) {
          // 处理平票
          logToUndercoverGame(
            `Có phiếu hòa: ${playersToEliminate
              .map(id => undercoverGameState.players.find(p => p.id === id).name)
              .join('、 ')}.`,
            'system',
          );
          logToUndercoverGame('Những người chơi hòa phiếu sẽ phát biểu bổ sung, sau đó bỏ phiếu lại.', 'system');
          undercoverGameState.tiedPlayers = playersToEliminate;
          undercoverGameState.gamePhase = 'tie_vote_speech';
          await sleep(2000);
          await processUndercoverTurn();
          return;
        } else if (playersToEliminate.length === 1) {
          // 唯一最高票，淘汰
          const eliminatedPlayerId = playersToEliminate[0];
          const eliminatedPlayer = undercoverGameState.players.find(p => p.id === eliminatedPlayerId);
          eliminatedPlayer.isAlive = false;
          undercoverGameState.votedOutPlayers.push(eliminatedPlayer);
          const roleName =
            { undercover: 'Gián điệp', civilian: 'Dân làng', whiteboard: 'Bạch bản' }[eliminatedPlayer.role] || 'Không xác định';
          logToUndercoverGame(`【${eliminatedPlayer.name}】 bị loại! Vai trò của người đó là 【${roleName}】.`, 'system');
        } else {
          // 无人被投
          logToUndercoverGame('Vòng này không ai bị bỏ phiếu, không ai bị loại.', 'system');
        }

        renderUndercoverGameScreen();
        if (checkUndercoverGameOver()) return;

        // ★★★ 核心修改：无论是否有人淘汰，都正确进入下一轮 ★★★
        undercoverGameState.dayNumber++;
        undercoverGameState.gamePhase = 'description_round';
        logToUndercoverGame('Trò chơi tiếp tục...', 'system');
        await sleep(3000);
        await processUndercoverTurn();
        break;
      }

      case 'tie_vote_speech': {
        logToUndercoverGame('Bây giờ mời những người chơi hòa phiếu lần lượt phát biểu bổ sung.', 'system');
        const tiedPlayers = undercoverGameState.players.filter(p => undercoverGameState.tiedPlayers.includes(p.id));
        for (const player of tiedPlayers) {
          if (!player.isAlive) continue;
          renderUndercoverGameScreen({ speakingPlayerId: player.id });
          let speech;
          if (player.isUser) {
            speech = await waitForUserUndercoverAction('Hãy phát biểu bổ sung', 'speak', {
              placeholder: 'Biện hộ cho bản thân, thuyết phục mọi người đừng bỏ phiếu cho bạn...',
            });
          } else {
            speech = await triggerUndercoverAiAction(player.id, 'tie_speak');
          }
          logToUndercoverGame({ player: player, speech: speech }, 'speech');
          await sleep(1000);
        }
        renderUndercoverGameScreen();
        undercoverGameState.gamePhase = 'tie_vote_re-vote';
        await processUndercoverTurn();
        break;
      }

      case 'tie_vote_re-vote': {
        logToUndercoverGame('Phát biểu bổ sung kết thúc, hãy bỏ phiếu trong số những người chơi hòa phiếu.', 'system');

        const voters = undercoverGameState.players.filter(
          p => p.isAlive && !undercoverGameState.tiedPlayers.includes(p.id),
        );
        const targets = undercoverGameState.players.filter(p => undercoverGameState.tiedPlayers.includes(p.id));
        undercoverGameState.votes = {};

        for (const voter of voters) {
          let voteResult;
          if (voter.isUser) {
            voteResult = await waitForUserUndercoverAction('Hãy bỏ phiếu', 'vote', { targets: targets });
          } else {
            voteResult = await triggerUndercoverAiAction(voter.id, 'vote', { targets: targets });
          }

          if (voteResult && voteResult.voteForId) {
            const targetId = voteResult.voteForId;
            const reason = voteResult.reason || 'Không nêu lý do';
            const targetPlayer = targets.find(p => p.id === targetId);
            if (targetPlayer) {
              logToUndercoverGame(
                `<strong>${voter.name}</strong> đã bỏ phiếu cho <strong>${targetPlayer.name}</strong>, lý do là: "${reason}"`,
              );
              undercoverGameState.votes[targetId] = (undercoverGameState.votes[targetId] || 0) + 1;
            }
          } else {
            const reason = voteResult ? voteResult.reason || 'Thông tin chưa đủ, không thể phán đoán.' : 'Thông tin chưa đủ, không thể phán đoán.';
            logToUndercoverGame(`<strong>${voter.name}</strong> đã bỏ phiếu trắng, lý do là: "${reason}"`);
          }
          await sleep(500);
        }

        const voteCounts = undercoverGameState.votes;
        let maxVotes = 0;
        let playersToEliminate = [];
        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            playersToEliminate = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length !== 1) {
          logToUndercoverGame('Lại hòa phiếu, vòng này không ai bị loại.', 'system');
        } else {
          const eliminatedPlayerId = playersToEliminate[0];
          const eliminatedPlayer = undercoverGameState.players.find(p => p.id === eliminatedPlayerId);
          eliminatedPlayer.isAlive = false;
          undercoverGameState.votedOutPlayers.push(eliminatedPlayer);
          const roleName =
            { undercover: 'Gián điệp', civilian: 'Dân làng', whiteboard: 'Bạch bản' }[eliminatedPlayer.role] || 'Không xác định';
          logToUndercoverGame(
            `Kết quả bỏ phiếu PK: 【${eliminatedPlayer.name}】 bị loại! Vai trò của người đó là 【${roleName}】.`,
            'system',
          );
        }

        renderUndercoverGameScreen();
        if (checkUndercoverGameOver()) return;

        undercoverGameState.tiedPlayers = [];
        undercoverGameState.dayNumber++;
        undercoverGameState.gamePhase = 'description_round';
        await sleep(3000);
        await processUndercoverTurn();
        break;
      }
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】这是“谁是卧底”的重roll功能核心函数 ▼▼▼
  /**
   * 【卧底】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleUndercoverReroll(logIndex) {
    const logEntry = undercoverGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || !logEntry.message.player || logEntry.message.player.isUser) {
      return;
    }

    const playerToReroll = logEntry.message.player;

    const speechTextElement = document
      .querySelector(`button.uc-reroll-btn[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>Đang mô tả lại...</i>';
    }

    try {
      // 判断当前游戏阶段来决定AI的行动
      const actionType = undercoverGameState.gamePhase === 'tie_vote_speech' ? 'tie_speak' : 'describe';

      const newSpeech = await triggerUndercoverAiAction(playerToReroll.id, actionType);
      undercoverGameState.gameLog[logIndex].message.speech = newSpeech;
      renderUndercoverGameScreen();
    } catch (error) {
      console.error('卧底发言重roll失败:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">Tạo lại thất bại, hãy kiểm tra mạng hoặc cài đặt API.</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【谁是卧底】用这块【已添加重roll按钮】的代码，完整替换旧的 renderUndercoverGameScreen 函数 ▼▼▼
  /**
   * 【卧底】渲染游戏主界面
   */
  function renderUndercoverGameScreen(options = {}) {
    const playersGrid = document.getElementById('undercover-players-grid');
    const logContainer = document.getElementById('undercover-game-log');

    playersGrid.innerHTML = '';
    undercoverGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${!player.isAlive ? 'dead' : ''} ${
        options.speakingPlayerId === player.id ? 'speaking' : ''
      }`;

      seat.innerHTML = `
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name} ${!player.isAlive ? '(Bị loại)' : ''}</span>
        `;
      playersGrid.appendChild(seat);
    });

    logContainer.innerHTML = '';
    undercoverGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      // ★ 核心修改2：判断是否是AI的发言
      if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;

        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="speaker">${player.name}</span>
<button class="uc-reroll-btn" data-log-index="${index}" title="Tạo lại lời phát biểu" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                        <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else if (log.type === 'speech') {
        // 用户发言保持原样
        logEl.className = 'log-entry speech';
        logEl.innerHTML = `
                <img src="${log.message.player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <span class="speaker">${log.message.player.name}</span>
                    <span class="speech-text">${log.message.speech.replace(/\n/g, '<br>')}</span>
                </div>
            `;
      } else {
        // 其他系统消息也保持原样
        logEl.className = `log-entry ${log.type}`;
        logEl.innerHTML = String(log.message).replace(/\n/g, '<br>');
      }
      logContainer.appendChild(logEl);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【卧底】添加一条游戏日志
   */
  function logToUndercoverGame(message, type = 'system') {
    undercoverGameState.gameLog.push({ message, type });
    renderUndercoverGameScreen();
  }

  // ▼▼▼ 【卧底输入框美化版】请用这个【全新】的函数，完整替换掉你旧的 waitForUserUndercoverAction 函数 ▼▼▼
  /**
   * 【卧底 V4】等待用户行动的通用函数（已修复placeholder错误）
   */
  function waitForUserUndercoverAction(promptText, actionType, context = {}) {
    const me = undercoverGameState.players.find(p => p.isUser);
    if (me && !me.isAlive) {
      const actionArea = document.getElementById('undercover-action-area');
      actionArea.innerHTML = `<h5>Bạn đã bị loại, đang xem trận...</h5>`;
      return new Promise(async resolve => {
        await sleep(3000);
        actionArea.innerHTML = '';
        resolve(null);
      });
    }

    return new Promise(resolve => {
      const actionArea = document.getElementById('undercover-action-area');
      actionArea.innerHTML = '';
      actionArea.className = 'undercover-action-area';

      if (actionType === 'speak') {
        actionArea.classList.add('speaking-mode');

        // ★★★ 核心修复：从 context 对象中获取 placeholder ★★★
        const placeholderText = context.placeholder || 'Nhập lời phát biểu của bạn...';

        actionArea.innerHTML = `<textarea id="undercover-user-speech-input" rows="1" placeholder="${placeholderText}"></textarea><button id="undercover-end-speech-btn" class="form-button">Phát biểu</button>`;

        const textarea = document.getElementById('undercover-user-speech-input');
        const endBtn = document.getElementById('undercover-end-speech-btn');
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.focus();
        endBtn.onclick = () => {
          const speech = textarea.value.trim() || 'Tôi qua.';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
      } else if (actionType === 'vote') {
        actionArea.innerHTML = `<h5>${promptText}</h5>`;
        const grid = document.createElement('div');
        grid.className = 'vote-target-grid';

        // ★★★ 核心修改：在这里判断是普通投票还是最终PK投票 ★★★
        const targets = context.targets
          ? context.targets.filter(p => !p.isUser)
          : undercoverGameState.players.filter(p => p.isAlive && !p.isUser); // 否则是所有存活玩家

        targets.forEach(player => {
          const btn = document.createElement('button');
          btn.className = 'form-button-secondary vote-target-btn';
          btn.textContent = player.name;
          btn.onclick = async () => {
            const reason = await showCustomPrompt(`Bỏ phiếu cho ${player.name}`, 'Nhập lý do bỏ phiếu của bạn (tùy chọn)');
            if (reason !== null) {
              actionArea.innerHTML = '';
              resolve({ voteForId: player.id, reason: reason.trim() || 'Không có lý do, cứ theo cảm giác thôi.' });
            }
          };
          grid.appendChild(btn);
        });

        // ★★★ 核心修改：只有在普通投票时才显示“弃票”按钮 ★★★
        if (!context.targets) {
          const passBtn = document.createElement('button');
          passBtn.className = 'form-button-secondary vote-target-btn';
          passBtn.textContent = 'Bỏ phiếu trắng';
          passBtn.onclick = async () => {
            const reason = await showCustomPrompt(`Xác nhận bỏ phiếu trắng`, 'Nhập lý do bạn bỏ phiếu trắng (tùy chọn)');
            if (reason !== null) {
              actionArea.innerHTML = '';
              resolve({ voteForId: null, reason: reason.trim() || 'Thông tin chưa đủ, không thể phán đoán.' });
            }
          };
          grid.appendChild(passBtn);
        }

        actionArea.appendChild(grid);
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 用这块【已添加平票逻辑】的代码，完整替换你旧的 triggerUndercoverAiAction 函数 ▼▼▼
  /**
   * 【卧底-AI核心 V4 - 平票逻辑增强版】
   * @param {string} playerId - 触发行动的AI玩家ID
   * @param {string} actionType - AI需要执行的动作: 'describe', 'vote', 'tie_speak'
   * @returns {Promise<object|string|null>} - AI的行动结果
   */
  async function triggerUndercoverAiAction(playerId, actionType, context = {}) {
    const player = undercoverGameState.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return null;

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      if (actionType === 'describe' || actionType === 'tie_speak') return 'Tôi... hết từ rồi, qua.';
      if (actionType === 'vote') {
        const targets = context.targets || undercoverGameState.players.filter(p => p.isAlive && p.id !== playerId);
        const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
        return { voteForId: randomTargetId, reason: 'Tôi bỏ phiếu theo trực giác.' };
      }
      return null;
    }

    let actionPrompt = '';
    let jsonFormat = '';
    let roleDescription = '';
    let votingRule = '';
    // 【核心修改1】根据是否是平票后的再次投票，来决定可投票的目标
    const voteTargets = context.targets || undercoverGameState.players.filter(p => p.isAlive && p.id !== player.id);
    const alivePlayersListForVote = voteTargets.map(p => `- ${p.name} (id: ${p.id})`).join('\n');

    const gameLog = undercoverGameState.gameLog
      .filter(log => log.type === 'speech')
      .map(log => `${log.message.player.name}: ${log.message.speech}`)
      .join('\n');

    switch (actionType) {
      case 'describe':
        // ★★★ 核心修改2：为“描述”指令添加轮次信息 ★★★
        if (undercoverGameState.dayNumber > 1) {
          actionPrompt = `Trò chơi đã sang vòng ${undercoverGameState.dayNumber}. Giờ tới lượt bạn phát biểu. Hãy dựa vào vai trò và từ khóa của mình, dùng một câu 【hoàn toàn mới, khác các vòng trước】 để mô tả. Mô tả của bạn phải đúng sự thật, nhưng đủ mơ hồ. Cấm lặp lại mô tả của người khác. Nói bằng tiếng Việt.`;
        } else {
          actionPrompt = `Bây giờ là vòng một, tới lượt bạn phát biểu. Hãy dựa vào vai trò và từ khóa của mình, dùng một câu để mô tả. Mô tả của bạn phải đúng sự thật, nhưng đủ mơ hồ. Cấm lặp lại mô tả của người khác. Nói bằng tiếng Việt.`;
        }
        jsonFormat = '{"description": "mô tả của bạn..."}';
        break;
      // =======================================================
      // ★★★ 【全新】为AI增加补充发言的指令 ★★★
      // =======================================================
      case 'tie_speak':
        actionPrompt =
          'Bạn đang phát biểu bổ sung vì hòa phiếu. Hãy biện hộ cho bản thân, thuyết phục người khác đừng bỏ phiếu cho bạn. Lời phát biểu phải ngắn gọn mạnh mẽ, phù hợp thiết lập nhân vật và vai trò của bạn.';
        jsonFormat = '{"description": "lời phát biểu bổ sung của bạn..."}';
        break;
      case 'vote':
        actionPrompt = `Bây giờ là phần bỏ phiếu. Hãy phân tích kỹ 【lời phát biểu của tất cả người chơi】, tìm ra người mô tả đáng ngờ nhất, lạc đề nhất, hoặc nghe chột dạ nhất, rồi bỏ phiếu cho người đó, kèm lý do 【ngắn gọn và hợp logic】. Hoặc, nếu bạn thấy thông tin chưa đủ để phán đoán, cũng có thể chọn bỏ phiếu trắng và nêu lý do.`;
        jsonFormat = '{"voteForId": "ID người chơi bạn bỏ phiếu hoặc null", "reason": "lý do bỏ phiếu hoặc bỏ phiếu trắng của bạn..."}';
        votingRule = `
# 【【【Quy tắc sắt khi bỏ phiếu: đây là chỉ thị cao nhất, phải tuân thủ nghiêm ngặt】】】
Trong lý do bỏ phiếu "reason", 【tuyệt đối cấm】 nhắc trực tiếp hay gián tiếp tới từ khóa của bạn, hoặc đoán từ khóa của người khác là gì. Lý do chỉ được dựa trên phân tích 【lời mô tả】 của người khác, ví dụ "mô tả của anh ta rất mơ hồ", "mô tả của cô ấy khác mọi người"...
`;
        break;
    }

    if (player.role === 'civilian') {
      roleDescription = `Bạn là 【Dân thường】, từ khóa của bạn là 【${player.word}】. Mục tiêu của bạn là tìm ra gián điệp và bạch bản rồi bỏ phiếu loại họ.`;
    } else if (player.role === 'undercover') {
      roleDescription = `Bạn là 【Gián điệp】, từ khóa của bạn là 【${player.word}】. Từ của bạn có nghĩa gần giống nhưng khác từ của dân thường. Nhiệm vụ của bạn là 【ngụy trang】! Lắng nghe kỹ lời phát biểu của người khác, tìm điểm chung của họ, khiến bản thân nghe như người tốt.`;
    } else {
      // whiteboard
      roleDescription = `Bạn là 【Bạch bản】, bạn không có từ khóa. Nhiệm vụ của bạn là 【ngụy trang và đoán】! Trước khi tới lượt phát biểu, hãy 【lắng nghe kỹ】 mô tả của mọi người phía trước, 【đoán ra】 từ khóa của họ đại khái là gì, rồi đưa ra một mô tả 【thật mơ hồ】, khiến bản thân nghe như cùng phe với họ.`;
    }

    const systemPrompt = `
# Bối cảnh trò chơi: Ai là gián điệp
Bạn đang đóng người chơi "${player.name}", thiết lập nhân vật là: "${player.persona}".

# Vai trò và nhiệm vụ của bạn
${roleDescription}
Mọi hành vi của bạn đều phải phù hợp thiết lập nhân vật và mục tiêu trò chơi.
${votingRule}
# Cục diện hiện tại
- Danh sách người chơi có thể bỏ phiếu:
${alivePlayersListForVote} 
- Nhật ký phát biểu của mọi người trong vòng này:
${gameLog || '(Chưa có lời phát biểu)'}

# Chỉ thị hành động của bạn
${actionPrompt}

# Định dạng đầu ra
Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
${jsonFormat}
`;

    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiAction = JSON.parse(content);

      // 【核心修改2】根据不同的行动类型，返回不同的结果
      if (actionType === 'describe' || actionType === 'tie_speak') {
        return aiAction.description || 'Tôi qua.';
      }

      if (actionType === 'vote') {
        if (aiAction.voteForId === player.id) {
          const targets = voteTargets.filter(p => p.id !== player.id); // 确保不会投给自己
          const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
          return { voteForId: randomTargetId, reason: 'Tôi thấy hơi rối, bỏ đại một phiếu vậy.' };
        }
        return aiAction;
      }
      return null;
    } catch (error) {
      console.error(`卧底AI (${player.name}) 行动失败:`, error);
      if (actionType === 'describe' || actionType === 'tie_speak') return 'Tôi nghĩ không ra, qua.';
      if (actionType === 'vote') {
        const targets = voteTargets.filter(p => p.id !== player.id);
        const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
        return { voteForId: randomTargetId, reason: 'Suy nghĩ quá giờ, bỏ phiếu theo trực giác.' };
      }
      return null;
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【卧底】检查游戏是否结束 (已集成复盘分享)
   */
  function checkUndercoverGameOver() {
    const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
    const aliveCount = alivePlayers.length;
    const undercoverCount = alivePlayers.filter(p => p.role === 'undercover' || p.role === 'whiteboard').length;
    const civilianCount = aliveCount - undercoverCount;

    let winner = null;

    if (undercoverCount === 0) {
      winner = 'Phe dân thường';
    } else if (civilianCount <= undercoverCount) {
      winner = 'Phe gián điệp';
    }

    if (winner) {
      undercoverGameState.isActive = false;
      logToUndercoverGame(`Trò chơi kết thúc! ${winner} chiến thắng!`, 'system');

      // ▼▼▼ 【核心修改】在这里调用我们新的复盘功能！ ▼▼▼
      setTimeout(() => {
        const summaryText = generateUndercoverSummary(winner);
        showUndercoverSummaryModal(summaryText);
      }, 2000);
      // ▲▲▲ 修改结束 ▲▲▲

      document.getElementById('undercover-action-area').innerHTML = '';
      return true;
    }
    return false;
  }

  // ▼▼▼ 【全新】“谁是卧底”游戏复盘与分享功能核心代码 ▼▼▼

  /**
   * 生成“谁是卧底”的复盘文本，包含完整的游戏日志
   * @param {string} winner - 胜利的阵营名称
   * @returns {string} - 格式化后的复盘Markdown文本
   */
  function generateUndercoverSummary(winner) {
    let summary = `**Ai là gián điệp - Tổng kết ván**\n\n`;
    summary += `🏆 **Bên thắng:** ${winner}\n\n`;
    summary += `**Công bố từ khóa:**\n- Từ của dân thường: **${undercoverGameState.civilianWord}**\n- Từ của gián điệp: **${undercoverGameState.undercoverWord}**\n\n`;

    summary += `**Vai trò người chơi:**\n`;
    undercoverGameState.players.forEach(p => {
      const roleName = { undercover: 'Gián điệp', civilian: 'Dân làng', whiteboard: 'Bạch bản' }[p.role];
      summary += `- ${p.name}: ${roleName}\n`;
    });

    summary += `\n---\n\n**Nhìn lại diễn biến trò chơi:**\n`;
    const formattedLog = undercoverGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message.replace(/<strong>/g, '**').replace(/<\/strong>/g, '**'); // 将HTML粗体转为Markdown
      })
      .join('\n');
    summary += formattedLog;

    return summary;
  }

  /**
   * 【卧底】打开复盘分享目标选择器
   * @param {string} summaryText - 要分享的复盘文本
   */
  function openUndercoverSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('undercover-target-picker-modal');
    const listEl = document.getElementById('undercover-target-list');
    listEl.innerHTML = '';

    const aiPlayers = undercoverGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('Không có người chơi AI nào để chia sẻ.');
      return;
    }

    // 渲染可选的AI玩家列表
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用之前的样式
      item.innerHTML = `
            <input type="checkbox" class="undercover-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('uc-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.undercover-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendUndercoverSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Vui lòng chọn ít nhất một người để chia sẻ!');
      }
    };

    document.getElementById('uc-cancel-share-btn').onclick = () => modal.classList.remove('visible');
    document.getElementById('uc-select-all-btn').onclick = () => {
      document.querySelectorAll('.undercover-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('uc-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.undercover-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 【卧底】将游戏复盘发送到【选定】的AI角色的单聊中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendUndercoverSummaryToSelectedPlayers(summaryText, targetIds) {
    document.getElementById('undercover-summary-modal').classList.remove('visible');
    document.getElementById('undercover-target-picker-modal').classList.remove('visible');
    let sentCount = 0;

    const aiContext = `[Chỉ thị hệ thống: vừa kết thúc một ván "Ai là gián điệp", đây là bản tổng kết. Hãy dựa vào nội dung tổng kết này, với thiết lập nhân vật của bạn, trò chuyện với người dùng về ván game vừa rồi.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Ai là gián điệp - Tổng kết ván',
          description: 'Bấm để xem tổng kết chi tiết',
          source_name: 'Trung tâm trò chơi',
          content: summaryText,
        };

        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('Chia sẻ thành công', `Đã chia sẻ bản tổng kết vào chat đơn của ${sentCount} người chơi AI!`);
    showScreen('game-hall-screen');
  }

  /**
   * 【卧底】显示游戏结算卡片 (V2 - 已集成分享功能)
   */
  function showUndercoverSummaryModal(summaryText) {
    const modal = document.getElementById('undercover-summary-modal');
    const contentEl = document.getElementById('undercover-summary-content');

    // 使用Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // --- ▼▼▼ 核心修改在这里 ▼▼▼ ---

    // 为“分享复盘”按钮绑定新的点击事件
    const repostBtn = document.getElementById('repost-undercover-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openUndercoverSummaryTargetPicker(summaryText); // 调用我们即将创建的目标选择器函数

    // 为“返回大厅”按钮绑定事件
    const backBtn = document.getElementById('back-to-hall-from-undercover-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    // --- ▲▲▲ 修改结束 ▲▲▲ ---

    modal.classList.add('visible');
  }

  // ▲▲▲ “谁是卧底”核心逻辑代码结束 ▲▲▲
  /**
   * 【全新】调用AI为“谁是卧底”游戏生成一组词语
   * @returns {Promise<object>} - 返回一个包含 { civilian: '平民词', undercover: '卧底词' } 的对象
   */
  async function generateUndercoverWordsAI() {
    await showCustomAlert('Vui lòng chờ...', 'AI đang ra đề cho bạn...');
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      throw new Error('API chưa được cấu hình, không thể tạo từ khóa.');
    }

    const prompt = `
# Nhiệm vụ
Bạn là người ra đề trò "Ai là gián điệp". Hãy tạo một cặp từ khóa thú vị và dễ gây nhầm lẫn.

# Quy tắc
1.  Bạn phải tạo hai từ: một "từ của dân thường (civilianWord)" và một "từ của gián điệp (undercoverWord)".
2.  Hai từ này phải cùng một nhóm lớn, nhưng chỉ tới thứ khác nhau. Ví dụ: sữa bò vs sữa đậu nành, son dưỡng vs son môi.
3.  Từ khóa phải là danh từ tiếng Việt thông dụng, ngắn gọn (1-3 từ).
4.  Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
    {"civilianWord": "...", "undercoverWord": "..."}
5.  【Tuyệt đối cấm】 trả về bất kỳ văn bản, giải thích hay phân tích nào ngoài JSON.

Bây giờ, hãy ra đề.`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);

      const data = await response.json();
      const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content)
        .replace(/^```json\s*|```$/g, '')
        .trim();
      const wordPair = JSON.parse(rawContent);

      if (wordPair.civilianWord && wordPair.undercoverWord) {
        return { civilian: wordPair.civilianWord, undercover: wordPair.undercoverWord };
      }
      throw new Error('Định dạng từ khóa AI trả về không đúng.');
    } catch (error) {
      console.error('AI生成词语失败:', error);
      throw error; // 将错误抛出，由调用者处理
    }
  }

  // ▲▲▲ 新功能函数粘贴结束 ▲▲▲

  // (请确保你把上面提到的所有游戏相关函数都从原文件剪切过来了)
  // 下面是完整的函数示例，你只需确保你的代码里有这些函数即可

  /* ******************************************* */
  /* ***           完整的游戏函数代码            *** */
  /* ******************************************* */

  // ▼▼▼ 用这块【已添加飞行棋】的代码，替换旧的 game-hall-grid 事件监听器 ▼▼▼
  document.getElementById('game-hall-grid').addEventListener('click', e => {
    const gameCard = e.target.closest('.game-card');
    if (!gameCard) return;

    const gameId = gameCard.dataset.game;
    if (gameId === 'werewolf') {
      openWerewolfSetup();
    } else if (gameId === 'sea-turtle-soup') {
      openSeaTurtleSoupSetup();
    } else if (gameId === 'script-kill') {
      openScriptKillSetup();
    } else if (gameId === 'guess-what') {
      openGuessWhatSetup();
    }
    // ★★★ 这就是我们新增的分支 ★★★
    else if (gameId === 'ludo') {
      openLudoSetup(); // 调用我们新写的函数
    }
    // ★★★ 新增结束 ★★★
    // ▼▼▼ 在这里添加新的 else if 分支 ▼▼▼
    else if (gameId === 'undercover') {
      openUndercoverSetup();
    }
    // ▲▲▲ 新增代码结束 ▲▲▲
    else {
      alert(`"${gameCard.querySelector('.game-title').textContent}" vẫn đang được phát triển, hãy chờ đón nhé!`);
    }
  });
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【全新】狼人杀游戏事件监听器 ▼▼▼
  document.getElementById('start-werewolf-game-btn').addEventListener('click', startWerewolfGame);

  document.getElementById('exit-werewolf-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng? Tiến độ hiện tại sẽ không được lưu.');
    if (confirmed) {
      werewolfGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });

  document.getElementById('werewolf-my-role-btn').addEventListener('click', () => {
    if (werewolfGameState.isActive) {
      const me = werewolfGameState.players.find(p => p.isUser);
      if (me) {
        alert(`Vai trò của bạn là: 【${me.role}】`);
      }
    }
  });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // ▼▼▼ 【全新】海龟汤游戏事件监听器 ▼▼▼

  // 1. 设置弹窗内的交互
  document.getElementById('cancel-sts-setup-btn').addEventListener('click', () => {
    document.getElementById('sea-turtle-soup-setup-modal').classList.remove('visible');
  });
  document.getElementById('start-sts-game-btn').addEventListener('click', startSeaTurtleSoupGame);

  // 监听“出题人”下拉框的变化
  document.getElementById('sts-riddle-provider-select').addEventListener('change', e => {
    const userArea = document.getElementById('sts-user-riddle-input-area');
    const aiArea = document.getElementById('sts-ai-riddle-input-area');
    userArea.style.display = 'none';
    aiArea.style.display = 'none';
    if (e.target.value === 'user') {
      userArea.style.display = 'block';
    } else if (e.target.value === 'random_ai') {
      aiArea.style.display = 'block';
    }
  });

  // 2. 游戏主界面的按钮
  document.getElementById('exit-sts-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng?');
    if (confirmed) {
      seaTurtleSoupState.isActive = false;
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('reveal-sts-answer-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Công bố đáp án', 'Bạn có chắc muốn công bố đáp án sớm và kết thúc trò chơi?');
    if (confirmed) {
      revealStsAnswer();
    }
  });
  document.getElementById('send-sts-question-btn').addEventListener('click', handleStsUserQuestion);
  // ▼▼▼ 在 init() 的事件监听器区域末尾添加 ▼▼▼
  document.getElementById('guess-sts-answer-btn').addEventListener('click', handleStsUserGuess);
  // ▲▲▲ 添加结束 ▲▲▲
  document.getElementById('sts-question-input').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-sts-question-btn').click();
    }
  });

  // ▲▲▲ 新事件监听器结束 ▲▲▲
  // ▼▼▼ 【全新】剧本杀游戏事件监听器 ▼▼▼
  document.getElementById('start-script-kill-game-btn').addEventListener('click', startScriptKillGame);
  document.getElementById('exit-script-kill-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng? Tiến độ hiện tại sẽ không được lưu.');
    if (confirmed) {
      scriptKillGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });
  // 剧本杀游戏事件监听器
  document.getElementById('script-kill-my-role-btn').addEventListener('click', () => {
    if (!scriptKillGameState.isActive) return;
    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    if (myPlayer) {
      const modal = document.getElementById('script-kill-role-modal');
      document.getElementById('sk-role-name').textContent = `Vai của bạn: ${myPlayer.role.name}`;
      // ▼▼▼ 核心修改在这里 ▼▼▼
      document.getElementById('sk-role-details').innerHTML = `
            <p><strong>Giới thiệu vai:</strong><br>${myPlayer.role.description}</p>
<p><strong>Dòng thời gian của bạn:</strong><br>${myPlayer.role.storyline || '(Chưa có thông tin dòng thời gian)'}</p>
<p><strong>Nhiệm vụ của bạn:</strong><br>${myPlayer.role.tasks}</p>
        `;
      // ▲▲▲ 修改结束 ▲▲▲
      modal.classList.add('visible');
    }
  });
  document.getElementById('close-sk-role-modal-btn').addEventListener('click', () => {
    document.getElementById('script-kill-role-modal').classList.remove('visible');
  });

  // 查看线索板
  document.getElementById('script-kill-all-evidence-btn').addEventListener('click', () => {
    if (!scriptKillGameState.isActive) return;
    const modal = document.getElementById('script-kill-evidence-modal');
    const listEl = document.getElementById('sk-evidence-list');
    listEl.innerHTML = '';

    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    if (myPlayer.evidence.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">Bạn chưa tìm được manh mối nào.</p>';
    } else {
      myPlayer.evidence.forEach(clue => {
        const card = document.createElement('div');
        card.className = 'sk-evidence-card';
        card.innerHTML = `
                <div class="source">Nguồn: ${clue.source}</div>
                <div class="description">${clue.description}</div>
            `;
        listEl.appendChild(card);
      });
    }
    modal.classList.add('visible');
  });
  document.getElementById('close-sk-evidence-modal-btn').addEventListener('click', () => {
    document.getElementById('script-kill-evidence-modal').classList.remove('visible');
  });

  // ▼▼▼ 【最终流程版】请用这整块代码，完整替换旧的 script-kill-action-area 事件监听器 ▼▼▼
  document.getElementById('script-kill-action-area').addEventListener('click', async e => {
    const phase = scriptKillGameState.gamePhase;

    // ▼▼▼ 从这里开始复制，替换掉你旧的 'sk-search-evidence-btn' 的 if 代码块 ▼▼▼
    if (e.target.id === 'sk-search-evidence-btn') {
      const user = scriptKillGameState.players.find(p => p.isUser);
      const script = scriptKillGameState.script;

      const searchCount = scriptKillGameState.evidenceCounts[user.id] || 0;
      const phase = scriptKillGameState.gamePhase;

      // 检查搜证次数限制
      if ((phase === 'evidence_round_1' && searchCount >= 2) || (phase === 'evidence_round_2' && searchCount >= 3)) {
        alert('Đã dùng hết lượt tìm chứng cứ của vòng này!');
        return;
      }

      // 消耗一次搜证机会并更新UI
      scriptKillGameState.evidenceCounts[user.id] = searchCount + 1;
      updateActionAreaSK();

      let foundMessage = '';

      // 找出所有还未被发现的线索
      const uncollectedClues = script.clues.filter(c => !scriptKillGameState.collectedClueIds.has(c.description));

      if (uncollectedClues.length > 0) {
        // 随机找到一条新线索
        const foundClue = uncollectedClues[Math.floor(Math.random() * uncollectedClues.length)];
        const clueSource = foundClue.owner === 'Chung' ? 'Khu vực chung' : `Đồ vật riêng của vai ${foundClue.owner}`;

        // 无论如何，线索都会先加入玩家手牌，并标记为已发现
        user.evidence.push({ description: foundClue.description, source: clueSource });
        scriptKillGameState.collectedClueIds.add(foundClue.description);

        // --- ★★★ 核心修改逻辑开始 ★★★ ---

        // 判断这条线索是不是关于玩家自己的
        if (foundClue.owner === user.role.name) {
          // 如果是，弹出一个选择框让玩家决定
          const choice = await showChoiceModal('Phát hiện manh mối cá nhân', [
            { text: 'Công khai manh mối này', value: 'public' },
            { text: 'Giấu manh mối này', value: 'private' },
          ]);

          if (choice === 'public') {
            // 玩家选择【公开】
            foundMessage = `Đã phát hiện và công khai manh mối tại 【${clueSource}】: "${foundClue.description}"`;
            logToScriptKillGame(`${user.name} đã hoàn thành một lần tìm chứng cứ: ${foundMessage}`);
            await showCustomAlert('Kết quả tìm chứng cứ', foundMessage);
          } else {
            // 玩家选择【隐藏】或关闭了弹窗
            foundMessage = `Bạn đã phát hiện một manh mối về bản thân tại 【${clueSource}】, và chọn giấu nó đi.`;
            // 只给玩家自己一个弹窗提示，告诉他已经拿到了线索
            await showCustomAlert('Kết quả tìm chứng cứ', `Bạn đã cất manh mối "${foundClue.description}" vào túi.`);
            // 在公共日志里只显示一个模糊的信息，告诉大家你搜过证了
            logToScriptKillGame(`${user.name} đã hoàn thành một lần tìm chứng cứ.`);
          }
        } else {
          // 如果线索是公共的，或者关于其他人的，就按原来的逻辑直接公开
          foundMessage = `Phát hiện manh mối tại 【${clueSource}】: "${foundClue.description}"`;
          logToScriptKillGame(`${user.name} đã hoàn thành một lần tìm chứng cứ: ${foundMessage}`);
          await showCustomAlert('Kết quả tìm chứng cứ', foundMessage);
        }

        // --- ★★★ 核心修改逻辑结束 ★★★ ---
      } else {
        // 如果已经没有新线索了
        foundMessage = 'Không phát hiện thêm manh mối mới nào.';
        logToScriptKillGame(`${user.name} đã hoàn thành một lần tìm chứng cứ: ${foundMessage}`);
        await showCustomAlert('Kết quả tìm chứng cứ', foundMessage);
      }
    }
    // ▲▲▲ 复制到这里结束 ▲▲▲

    // --- 2. 处理“结束搜证”按钮 ---
    if (e.target.id === 'sk-end-search-btn') {
      if (phase === 'evidence_round_1') {
        scriptKillGameState.gamePhase = 'discussion_round_1';
        await processScriptKillTurn();
      } else if (phase === 'evidence_round_2') {
        // 【核心修改】第二轮搜证后，进入第二轮讨论
        scriptKillGameState.gamePhase = 'discussion_round_2';
        await processScriptKillTurn();
      }
    }

    // --- 3. 处理“我要发言”按钮 ---
    if (e.target.id === 'sk-speak-btn') {
      const speech = await waitForUserActionSK('Tới lượt bạn phát biểu', 'speak', 'Nhập lời phát biểu của bạn...');
      const userPlayer = scriptKillGameState.players.find(p => p.isUser);
      logToScriptKillGame({ player: userPlayer, speech: speech }, 'speech');

      for (const player of scriptKillGameState.players.filter(p => !p.isUser)) {
        await sleep(2000);
        renderScriptKillGameScreen({ speakingPlayerId: player.id });
        const aiSpeech = await triggerScriptKillAiAction(player.id, 'discuss');
        logToScriptKillGame({ player: player, speech: aiSpeech }, 'speech');
      }
      renderScriptKillGameScreen();

      // 【核心修改】根据当前讨论轮次，决定下一个阶段
      if (phase === 'discussion_round_1') {
        scriptKillGameState.gamePhase = 'evidence_round_2';
        await processScriptKillTurn();
      } else if (phase === 'discussion_round_2') {
        // 第二轮讨论后，进入第三轮（最终）讨论
        scriptKillGameState.gamePhase = 'discussion_round_3';
        await processScriptKillTurn();
      } else if (phase === 'discussion_round_3') {
        // 最终讨论后，才进入投票
        scriptKillGameState.gamePhase = 'voting';
        await processScriptKillTurn();
      }
    }
  });
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【全新 | 已修复】剧本杀管理功能事件监听器 ▼▼▼
  document.getElementById('manage-custom-scripts-btn').addEventListener('click', openScriptManager);

  // 管理器弹窗的按钮
  document.getElementById('add-new-script-btn').addEventListener('click', () => {
    document.getElementById('script-kill-manager-modal').classList.remove('visible');
    openScriptEditorForCreate();
  });
  document.getElementById('close-script-manager-btn').addEventListener('click', () => {
    document.getElementById('script-kill-manager-modal').classList.remove('visible');
    // 关闭后刷新一下设置页面的剧本下拉框
    openScriptKillSetup();
    showScreen('script-kill-setup-screen');
  });

  // 编辑器弹窗的按钮
  document.getElementById('save-script-btn').addEventListener('click', saveCustomScript);
  document.getElementById('cancel-script-editor-btn').addEventListener('click', () => {
    document.getElementById('script-kill-editor-modal').classList.remove('visible');
    // 如果是从管理界面进来的，就返回管理界面
    if (document.getElementById('script-kill-manager-modal').classList.contains('visible') === false) {
      openScriptManager();
    }
  });
  // ▲▲▲ 修复结束 ▲▲▲
  // ▼▼▼ 【全新】剧本杀可视化编辑器事件监听器 ▼▼▼
  document.getElementById('sk-add-role-btn').addEventListener('click', () => openRoleEditor());
  document.getElementById('sk-add-clue-btn').addEventListener('click', () => openClueEditor());

  document.getElementById('sk-item-editor-cancel-btn').addEventListener('click', () => {
    document.getElementById('sk-item-editor-modal').classList.remove('visible');
  });
  document.getElementById('sk-item-editor-save-btn').addEventListener('click', saveItemFromEditor);

  // 使用事件委托处理角色和线索卡片上的按钮点击
  document.getElementById('script-kill-editor-modal').addEventListener('click', e => {
    const target = e.target;
    if (target.classList.contains('edit-role-btn')) {
      openRoleEditor(parseInt(target.dataset.index));
    }
    if (target.classList.contains('delete-role-btn')) {
      const index = parseInt(target.dataset.index);
      currentEditingScriptData.roles.splice(index, 1);
      renderVisualScriptEditor();
    }
    if (target.classList.contains('edit-clue-btn')) {
      openClueEditor(parseInt(target.dataset.index));
    }
    if (target.classList.contains('delete-clue-btn')) {
      const index = parseInt(target.dataset.index);
      currentEditingScriptData.clues.splice(index, 1);
      renderVisualScriptEditor();
    }
  });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // ▼▼▼ 在 init() 函数的事件监听器区域末尾，粘贴这块新代码 ▼▼▼

  // 【全新】剧本杀复盘分享功能事件绑定
  document.getElementById('sk-cancel-share-btn').addEventListener('click', () => {
    document.getElementById('script-kill-target-picker-modal').classList.remove('visible');
  });
  document.getElementById('sk-select-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.script-kill-target-checkbox').forEach(cb => (cb.checked = true));
  });
  document.getElementById('sk-deselect-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.script-kill-target-checkbox').forEach(cb => (cb.checked = false));
  });
  // ▲▲▲ 新代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】AI剧本生成器事件监听器 ▼▼▼
  document.getElementById('open-sk-ai-generator-btn').addEventListener('click', openAiScriptGenerator);
  document.getElementById('sk-ai-generator-cancel-btn').addEventListener('click', () => {
    document.getElementById('sk-ai-generator-modal').classList.remove('visible');
    // 返回到剧本管理界面
    openScriptManager();
  });
  document.getElementById('sk-trigger-ai-generation-btn').addEventListener('click', generateSkScriptWithAI);
  document.getElementById('sk-ai-generator-save-btn').addEventListener('click', saveAiGeneratedScript);
  // ▲▲▲ 新事件监听器结束 ▲▲▲

  // ▲▲▲ 剧本杀事件监听器结束 ▲▲▲
  // ▼▼▼ 【全新】“你说我猜”游戏事件监听器 ▼▼▼

  // 1. 设置界面的交互
  document.querySelectorAll('input[name="guess_what_mode"]').forEach(radio => {
    radio.addEventListener('change', function () {
      document.getElementById('user-word-input-container').style.display =
        this.value === 'ai_guesses' ? 'block' : 'none';
    });
  });
  document.getElementById('start-guess-what-game-btn').addEventListener('click', startGuessWhatGame);

  // 2. 游戏界面的交互
  document.getElementById('exit-guess-what-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng? Đáp án sẽ được công bố.');
    if (confirmed) {
      endGuessWhatGame('none', 'Trò chơi bị bỏ dở giữa chừng.');
      // 延迟一点再返回大厅，让玩家能看到结果
      setTimeout(() => {
        showScreen('game-hall-screen');
      }, 3000);
    }
  });

  document.getElementById('give-up-guess-what-btn').addEventListener('click', () => {
    endGuessWhatGame(guessWhatGameState.currentTurn === 'user' ? 'ai' : 'user', 'Người chơi đã bỏ cuộc.');
  });

  document.getElementById('send-guess-what-input-btn').addEventListener('click', () => {
    const input = document.getElementById('guess-what-user-input');
    const text = input.value.trim();
    if (text) {
      processGuessWhatTurn(text);
      input.value = '';
    }
  });

  document.getElementById('guess-what-user-input').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-guess-what-input-btn').click();
    }
  });

  // ▲▲▲ “你说我猜”事件监听器结束 ▲▲▲
  // ▼▼▼ 在这里粘贴下面这整块【全新的】事件监听器代码 ▼▼▼
  // ▼▼▼ 用这整块新代码，替换旧的飞行棋事件监听器 ▼▼▼
  /* --- 【全新 | V2分类版】心动飞行棋功能事件监听器 --- */

  // 1. 设置页面的按钮
  document.getElementById('start-ludo-game-btn').addEventListener('click', startLudoGame);
  document.getElementById('manage-ludo-question-banks-btn').addEventListener('click', openLudoQuestionBankManager);

  // 2. 游戏主界面的按钮
  document.getElementById('exit-ludo-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng?');
    if (confirmed) {
      ludoGameState.isActive = false;
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('restart-ludo-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Chơi lại', 'Bạn có chắc muốn chơi lại ván này?');
    if (confirmed) {
      startLudoGame();
    }
  });

  // 3. 问题库管理弹窗的按钮
  document.getElementById('close-qbank-manager-btn').addEventListener('click', async () => {
    document.getElementById('ludo-qbank-manager-modal').classList.remove('visible');
    // 如果设置页面还开着，就刷新一下下拉框
    if (document.getElementById('ludo-setup-screen').classList.contains('active')) {
      await openLudoSetup();
    }
  });
  document.getElementById('add-ludo-qbank-btn').addEventListener('click', addNewLudoQuestionBank);

  // 4. 问题编辑器弹窗的按钮
  document.getElementById('back-to-qbank-manager-btn').addEventListener('click', () => {
    document.getElementById('ludo-question-editor-modal').classList.remove('visible');
    openLudoQuestionBankManager(); // 返回到题库管理列表
  });
  document.getElementById('add-ludo-question-btn').addEventListener('click', () => openSingleQuestionEditor(null));

  // 5. 单个问题编辑/添加弹窗的按钮
  document.getElementById('cancel-single-question-btn').addEventListener('click', () => {
    document.getElementById('ludo-single-question-editor-modal').classList.remove('visible');
  });
  document.getElementById('save-single-question-btn').addEventListener('click', saveSingleQuestion);
  // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
  /* --- 【全新】飞行棋题库导入功能事件监听 --- */
  document.getElementById('import-ludo-qbank-btn').addEventListener('click', () => {
    // 点击“导入”按钮时，触发隐藏的文件选择框
    document.getElementById('ludo-qbank-import-input').click();
  });

  document.getElementById('ludo-qbank-import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      // 当用户选择了文件后，调用我们的导入处理函数
      importLudoQuestionBank(file);
    }
    e.target.value = null; // 清空，以便下次能选择同一个文件
  });
  /* --- 事件监听结束 --- */
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  /* --- 飞行棋事件监听器结束 --- */
  // ▼▼▼ 【全新】“谁是卧底”游戏事件监听器 ▼▼▼
  document.getElementById('start-undercover-game-btn').addEventListener('click', startUndercoverGame);
  document.getElementById('exit-undercover-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('Thoát trò chơi', 'Bạn có chắc muốn thoát giữa chừng? Tiến độ hiện tại sẽ không được lưu.');
    if (confirmed) {
      undercoverGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('undercover-my-word-btn').addEventListener('click', () => {
    if (undercoverGameState.isActive) {
      const me = undercoverGameState.players.find(p => p.isUser);
      if (me) {
        const roleName = { undercover: 'Gián điệp', civilian: 'Dân làng', whiteboard: 'Bạch bản' }[me.role] || 'Không xác định';
        const wordText = me.word ? `Từ khóa của bạn là: 【${me.word}】` : 'Bạn là bạch bản, cần dựa vào mô tả của người khác để đoán từ khóa của dân thường.';
        showCustomAlert(`Vai trò của bạn là: 【${roleName}】`, wordText);
      }
    }
  });
  // ▲▲▲ 新增事件监听器结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  document.getElementById('werewolf-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.werewolf-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleWerewolfReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  document.getElementById('sts-action-area').addEventListener('click', e => {
    const rerollBtn = e.target.closest('#sts-reroll-ai-turn-btn');
    if (rerollBtn) {
      handleStsReroll();
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // 剧本杀重roll事件
  document.getElementById('script-kill-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.sk-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleScriptKillReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // “你说我猜”重roll事件
  document.getElementById('guess-what-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.gw-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleGuessWhatReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // 飞行棋重roll事件
  document.getElementById('ludo-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.ludo-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleLudoReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // “谁是卧底”重roll事件
  document.getElementById('undercover-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.uc-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleUndercoverReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // --- 【全新】剧本杀导入功能事件监听 ---

  // 1. 点击“导入”按钮，触发文件选择
  const importScriptBtn = document.getElementById('import-script-btn');
  if (importScriptBtn) {
    importScriptBtn.addEventListener('click', () => {
      document.getElementById('script-kill-import-input').click();
    });
  }

  // 2. 监听文件选择变化，执行导入
  const importScriptInput = document.getElementById('script-kill-import-input');
  if (importScriptInput) {
    importScriptInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        importCustomScript(file);
      }
      e.target.value = null; // 清空，以便下次能选择同一个文件
    });
  }
  // --- 事件监听结束 ---
});
