// studio.js

document.addEventListener('DOMContentLoaded', () => {
  // ===================================================================
  // 1. 全局变量
  // ===================================================================
  let activeStudioScriptId = null; // 记录当前正在编辑或查看的剧本ID
  let activeStudioPlay = null; // 记录当前正在进行的演绎会话 { script, userRole, aiRole, aiChatId, history }

  // ===================================================================
  // 2. DOM 元素获取 (为提高性能，一次性获取)
  // ===================================================================
  const studioAppIcon = document.getElementById('studio-app-icon');
  const addScriptBtn = document.getElementById('add-studio-script-btn');
  const backFromEditorBtn = document.getElementById('back-from-studio-editor');
  const saveScriptBtn = document.getElementById('save-studio-script-btn');
  const scriptListEl = document.getElementById('studio-script-list');
  const editorScreen = document.getElementById('studio-editor-screen');
  const editorTitle = document.getElementById('studio-editor-title');
  const nameInput = document.getElementById('studio-name-input');
  const bgInput = document.getElementById('studio-background-input');
  const goalInput = document.getElementById('studio-goal-input');
  const char1Input = document.getElementById('studio-char1-identity-input');
  const char2Input = document.getElementById('studio-char2-identity-input');
  const roleSelectionModal = document.getElementById('studio-role-selection-modal');
  const playScreen = document.getElementById('studio-play-screen');
  const playMessagesEl = document.getElementById('studio-play-messages');
  const playInput = document.getElementById('studio-play-input');
  const sendPlayActionBtn = document.getElementById('send-studio-play-action-btn');
  const exitPlayBtn = document.getElementById('exit-studio-play-btn');
  const rerollPlayBtn = document.getElementById('reroll-studio-play-btn');
  const summaryModal = document.getElementById('studio-summary-modal');
  const novelModal = document.getElementById('studio-novel-share-modal');
  const aiGenerateScriptBtn = document.getElementById('ai-generate-script-btn');
  const importScriptBtn = document.getElementById('import-studio-script-btn');
  const importInput = document.getElementById('studio-import-input');
  const exportScriptBtn = document.getElementById('export-studio-script-btn');
  // ===================================================================
  // 3. 核心功能函数
  // ===================================================================

  /**
   * 显示小剧场主屏幕并渲染剧本列表
   */
  async function showStudioScreen() {
    await renderStudioScriptList();
    showScreen('studio-screen');
  }

  /**
   * 从数据库读取剧本并渲染到主列表
   */
  async function renderStudioScriptList() {
    if (!scriptListEl) return;
    const scripts = await db.studioScripts.toArray();
    scriptListEl.innerHTML = '';

    if (scripts.length === 0) {
      scriptListEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa có kịch bản nào, bấm góc trên bên phải để tạo một kịch bản nhé!</p>';
      return;
    }

    scripts.forEach(script => {
      const item = document.createElement('div');
      item.className = 'studio-script-item';
      item.innerHTML = `
                <div class="title">${script.name || 'Kịch bản chưa đặt tên'}</div>
                <div class="goal">🎯 ${script.storyGoal || 'Chưa có mục tiêu'}</div>
            `;
      item.addEventListener('click', () => openRoleSelection(script.id));

      // 添加长按删除功能
      addLongPressListener(item, () => {
        openStudioEditor(script.id);
      });

      scriptListEl.appendChild(item);
    });
  }

  /**
   * 打开剧本编辑器（新建或编辑）
   * @param {number|null} scriptId - 如果是编辑则传入ID，新建则为null
   */
  async function openStudioEditor(scriptId = null) {
    activeStudioScriptId = scriptId;
    const deleteBtn = document.getElementById('delete-studio-script-btn');
    // ▼▼▼ 新增获取导出按钮 ▼▼▼
    const exportBtn = document.getElementById('export-studio-script-btn');
    const openingRemarkInput = document.getElementById('studio-opening-remark-input');

    if (scriptId) {
      editorTitle.textContent = 'Sửa kịch bản';
      const script = await db.studioScripts.get(scriptId);
      nameInput.value = script.name || '';
      bgInput.value = script.storyBackground || '';
      goalInput.value = script.storyGoal || '';
      openingRemarkInput.value = script.openingRemark || '';
      char1Input.value = script.character1_identity || '';
      char2Input.value = script.character2_identity || '';
      deleteBtn.style.display = 'block';
      // ▼▼▼ 新增：编辑模式显示导出按钮 ▼▼▼
      if (exportBtn) exportBtn.style.display = 'block';
    } else {
      editorTitle.textContent = 'Thêm kịch bản';
      [nameInput, bgInput, goalInput, openingRemarkInput, char1Input, char2Input].forEach(input => (input.value = ''));
      deleteBtn.style.display = 'none';
      // ▼▼▼ 新增：新建模式隐藏导出按钮 ▼▼▼
      if (exportBtn) exportBtn.style.display = 'none';
    }

    showScreen('studio-editor-screen');
  }

  /**
   * [全新] 使用AI辅助生成或补完剧本内容
   */
  async function generateScriptWithAI() {
    await showCustomAlert('Vui lòng chờ', 'Cô nàng biên kịch AI đang miệt mài viết...');

    // 1. 收集所有已填写的信息
    const existingData = {
      name: document.getElementById('studio-name-input').value.trim(),
      background: document.getElementById('studio-background-input').value.trim(),
      goal: document.getElementById('studio-goal-input').value.trim(),
      openingRemark: document.getElementById('studio-opening-remark-input').value.trim(),
      char1: document.getElementById('studio-char1-identity-input').value.trim(),
      char2: document.getElementById('studio-char2-identity-input').value.trim(),
    };

    // 2. 构建给AI的详细指令 (Prompt)
    const systemPrompt = `
    # Vai trò của bạn
Bạn là một bậc thầy sáng tác kịch bản tài hoa, giàu trí tưởng tượng.

# Nhiệm vụ của bạn
Dựa vào 【thông tin đã có】 người dùng cung cấp bên dưới, sáng tác hoặc hoàn thiện một kịch bản kịch hấp dẫn bằng tiếng Việt.
Bạn cần lên ý tưởng trên nền 【thông tin đã có】, và tạo nội dung cho mọi phần trống được đánh dấu 【(chờ tạo)】.

# Thông tin đã có
- Tên kịch bản: ${existingData.name || '(chờ tạo)'}
- Bối cảnh câu chuyện: ${existingData.background || '(chờ tạo)'}
- Mục tiêu câu chuyện: ${existingData.goal || '(chờ tạo)'}
- Lời mở đầu: ${existingData.openingRemark || '(chờ tạo)'}
- Thân phận & bối cảnh nhân vật 1: ${existingData.char1 || '(chờ tạo)'}
- Thân phận & bối cảnh nhân vật 2: ${existingData.char2 || '(chờ tạo)'}

# Yêu cầu đầu ra (【【【chỉ thị cao nhất, phải tuân thủ nghiêm ngặt】】】)
1.  Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON hoàn chỉnh, nghiêm ngặt, tuyệt đối không có chữ giải thích hay ký hiệu Markdown nào.
2.  Đối tượng JSON này phải có sáu khóa sau: "name", "background", "goal", "openingRemark", "char1", "char2".
3.  Bạn cần tạo nội dung cho mọi trường được đánh dấu 【(chờ tạo)】, và giữ tính nhất quán, logic với thông tin đã có.
4.  Nội dung tạo ra cần sáng tạo, giàu kịch tính, đáp ứng yêu cầu cơ bản của sáng tác kịch bản. Nhân vật và bối cảnh phải rõ nét, có động cơ và bí mật tiềm ẩn.
5.  Không được đặt tên cho nhân vật 1 và nhân vật 2, toàn bộ nội dung tạo ra, như bối cảnh, mục tiêu..., đều không được xuất hiện tên nhân vật, có thể dùng thân phận để gọi.
6.  Khi tạo nhân vật, trọng tâm là thân phận và bối cảnh, cố gắng đừng đưa tính cách nhân vật vào.

# Ví dụ định dạng đầu ra JSON:
    {
"name": "Tấm bản đồ sao thất lạc",
"background": "Trong một thế giới nơi steampunk và phép thuật cùng tồn tại, tấm bản đồ sao huyền thoại bị đánh cắp, món thần khí được cho là có thể chỉ đường tới thành phố trên trời đã thất lạc.",
"goal": "Trước khi phi thuyền hoàng gia cất cánh, tìm lại bản đồ sao, và vạch trần thân phận thật của kẻ trộm.",
"openingRemark": "Những bánh răng hoen gỉ rên rỉ trong đêm mưa, một lá mật thư dính máu trượt qua khe cửa văn phòng thám tử...",
"char1": "Một thám tử tư nợ nần chồng chất nhưng óc quan sát nhạy bén, từng là thành viên đội cận vệ hoàng gia, bị đuổi việc vì một tai nạn.",
"char2": "Một tiểu thư quý tộc bí ẩn, người ủy thác vụ trộm bản đồ sao, nhưng cô dường như quan tâm tới bản thân tấm bản đồ hơn là việc tìm lại nó."
    }

Bây giờ, hãy bắt đầu sáng tác.`;

    try {
      const responseText = await getApiResponse(systemPrompt);

      // 3. 解析AI返回的JSON数据
      const sanitizedText = responseText.replace(/^```json\s*|```$/g, '').trim();
      const parsedData = JSON.parse(sanitizedText);

      // 4. 将生成的内容填充回输入框 (只填充原本为空的)
      if (!existingData.name && parsedData.name) {
        document.getElementById('studio-name-input').value = parsedData.name;
      }
      if (!existingData.background && parsedData.background) {
        document.getElementById('studio-background-input').value = parsedData.background;
      }
      if (!existingData.goal && parsedData.goal) {
        document.getElementById('studio-goal-input').value = parsedData.goal;
      }
      if (!existingData.openingRemark && parsedData.openingRemark) {
        document.getElementById('studio-opening-remark-input').value = parsedData.openingRemark;
      }
      if (!existingData.char1 && parsedData.char1) {
        document.getElementById('studio-char1-identity-input').value = parsedData.char1;
      }
      if (!existingData.char2 && parsedData.char2) {
        document.getElementById('studio-char2-identity-input').value = parsedData.char2;
      }

      await showCustomAlert('Xong!', 'AI đã điền xong kịch bản!');
    } catch (error) {
      console.error('AI生成剧本失败:', error);
      await showCustomAlert(
        'Tạo thất bại',
        `Có lỗi: ${error.message}\n\nDữ liệu gốc AI trả về có thể không phải JSON hợp lệ, xem chi tiết trong console.`,
      );
      console.error('AI原始返回内容:', error.rawResponse || 'Không'); // 假设错误对象可能包含原始响应
    }
  }

  /**
   * 保存当前编辑的剧本到数据库
   */
  async function saveStudioScript() {
    const scriptData = {
      name: nameInput.value.trim() || 'Kịch bản chưa đặt tên',
      storyBackground: bgInput.value.trim(),
      storyGoal: goalInput.value.trim(),
      openingRemark: document.getElementById('studio-opening-remark-input').value.trim(), // 新增
      character1_identity: char1Input.value.trim(),
      character2_identity: char2Input.value.trim(),
    };

    if (
      !scriptData.name ||
      !scriptData.storyBackground ||
      !scriptData.storyGoal ||
      !scriptData.character1_identity ||
      !scriptData.character2_identity
    ) {
      alert('Ngoài lời mở đầu, mọi trường đều bắt buộc nhé!');
      return;
    }

    if (activeStudioScriptId) {
      await db.studioScripts.update(activeStudioScriptId, scriptData);
    } else {
      await db.studioScripts.add(scriptData);
    }

    alert('Đã lưu kịch bản!');
    showStudioScreen();
  }
  /**
   * [全新] 导出当前正在编辑的剧本
   */
  async function exportCurrentScript() {
    if (!activeStudioScriptId) {
      alert('Hãy lưu kịch bản trước rồi mới xuất!');
      return;
    }

    const script = await db.studioScripts.get(activeStudioScriptId);
    if (!script) {
      alert('Không tìm thấy dữ liệu kịch bản.');
      return;
    }

    // 1. 准备数据
    const exportData = {
      type: 'EPhone_Studio_Script', // 标记文件类型
      version: 1,
      data: script,
    };

    // 2. 创建文件并下载
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 文件名: [剧本]剧本名.json
    link.download = `[Kich-ban]${script.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // await showCustomAlert("导出成功", "剧本已开始下载！"); // 如果你有这个全局函数可以使用，没有就用 alert
    alert('Xuất kịch bản thành công!');
  }

  /**
   * [全新] 导入剧本文件
   */
  function handleScriptImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const json = JSON.parse(text);

        // 简单的格式验证
        if (json.type !== 'EPhone_Studio_Script' || !json.data) {
          // 尝试兼容纯对象格式（如果用户手动复制了内容）
          if (!json.name || !json.storyBackground) {
            throw new Error('Định dạng file không đúng, thiếu trường cần thiết.');
          }
          // 如果是纯对象，就直接用
          json.data = json;
        }

        const scriptData = json.data;

        // 生成一个新的ID，防止ID冲突
        scriptData.id = Date.now();
        // 如果名字重复，加个(导入)后缀
        scriptData.name = scriptData.name + ' (đã nhập)';

        await db.studioScripts.add(scriptData);

        await renderStudioScriptList();
        alert(`Đã nhập kịch bản 《${scriptData.name}》 thành công!`);
      } catch (error) {
        console.error('导入失败:', error);
        alert(`Nhập thất bại: ${error.message}`);
      } finally {
        // 清空 input，允许重复导入同一个文件
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  /**
   * 打开角色选择模态框
   * @param {number} scriptId - 被选中的剧本ID
   */
  async function openRoleSelection(scriptId) {
    const script = await db.studioScripts.get(scriptId);
    if (!script) return;

    activeStudioScriptId = scriptId;

    const role1Desc = document.getElementById('studio-role1-desc');
    const role2Desc = document.getElementById('studio-role2-desc');
    const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
    const role2IdentitySelect = document.getElementById('studio-role2-identity-select');

    role1Desc.textContent = script.character1_identity || 'Chưa có mô tả';
    role2Desc.textContent = script.character2_identity || 'Chưa có mô tả';

    // 1. 获取用户（你）的微博昵称和人设
    if (!window.state || !window.state.qzoneSettings) {
      alert('Lỗi: không tải được thông tin người dùng. Hãy đảm bảo ứng dụng chính đã tải đúng.');
      return;
    }
    const userNickname = window.state.qzoneSettings.nickname || 'Tôi';
    const userPersona = window.state.qzoneSettings.weiboUserPersona || 'Một người dùng bình thường.';

    // 2. 填充下拉框选项（现在是身份列表）
    const characters = Object.values(window.state.chats).filter(chat => !chat.isGroup);
    let optionsHtml = `<option value="user" data-persona="${escape(userPersona)}">${userNickname}</option>`;
    optionsHtml += characters
      .map(char => {
        const persona = char.settings.aiPersona || '';
        return `<option value="${char.id}" data-persona="${escape(persona)}">${char.name}</option>`;
      })
      .join('');

    role1IdentitySelect.innerHTML = optionsHtml;
    role2IdentitySelect.innerHTML = optionsHtml;

    // 3. 设置默认的【身份】分配
    role1IdentitySelect.value = 'user'; // 人物1默认使用你的身份
    if (characters.length > 0) {
      role2IdentitySelect.value = characters[0].id; // 人物2默认使用第一个AI的身份
    } else {
      // 如果没有AI，需要禁用另一个下拉框或给出提示
      role2IdentitySelect.innerHTML = '<option value="">Không có thân phận nhân vật AI khả dụng</option>';
    }

    // 4. 设置默认的【扮演者】分配
    const radiosRole1 = document.querySelectorAll('input[name="player-role1"]');
    const radiosRole2 = document.querySelectorAll('input[name="player-role2"]');
    radiosRole1.forEach(r => {
      if (r.value === 'user') r.checked = true;
    }); // 人物1默认由你扮演
    radiosRole2.forEach(r => {
      if (r.value === 'ai') r.checked = true;
    }); // 人物2默认由AI扮演

    // 5. 绑定单选框的联动事件
    const playerSelectionGroups = document.querySelectorAll('.player-selection-group');
    playerSelectionGroups.forEach((group, index) => {
      group.addEventListener('change', e => {
        const selectedPlayer = e.target.value;
        const otherIndex = index === 0 ? 1 : 0; // 找到另一个角色组
        const otherGroupRadios = playerSelectionGroups[otherIndex].querySelectorAll('input[type="radio"]');

        if (selectedPlayer === 'user') {
          // 如果当前角色选了“我扮演”，另一个角色必须是“AI扮演”
          otherGroupRadios.forEach(radio => {
            if (radio.value === 'ai') radio.checked = true;
          });
        } else {
          // selectedPlayer === 'ai'
          // 如果当前角色选了“AI扮演”，另一个角色必须是“我扮演”
          otherGroupRadios.forEach(radio => {
            if (radio.value === 'user') radio.checked = true;
          });
        }
      });
    });

    roleSelectionModal.classList.add('visible');
  }

  /**
   * 开始演绎
   */
  async function startStudioPlay() {
    const script = await db.studioScripts.get(activeStudioScriptId);

    // 1. 获取【扮演者】信息
    const role1Player = document.querySelector('input[name="player-role1"]:checked').value;
    const role2Player = document.querySelector('input[name="player-role2"]:checked').value;

    // 2. 获取【身份】信息
    const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
    const role2IdentitySelect = document.getElementById('studio-role2-identity-select');
    const role1IdentityValue = role1IdentitySelect.value;
    const role2IdentityValue = role2IdentitySelect.value;

    // 从<option>的data属性获取人设
    const role1Persona = unescape(role1IdentitySelect.options[role1IdentitySelect.selectedIndex].dataset.persona);
    const role2Persona = unescape(role2IdentitySelect.options[role2IdentitySelect.selectedIndex].dataset.persona);

    // 3. 验证
    if (role1Player === 'ai' && role2Player === 'ai') {
      alert('Phải có một vai do bạn đóng!');
      return;
    }
    if (role1IdentityValue === role2IdentityValue) {
      alert('Thân phận của hai vai không được là cùng một người!');
      return;
    }

    const userRoleNumber = role1Player === 'user' ? 1 : 2;
    const aiRoleNumber = role1Player === 'ai' ? 1 : 2;

    const aiIdentityValue = aiRoleNumber === 1 ? role1IdentityValue : role2IdentityValue;
    const aiChatId =
      aiIdentityValue !== 'user' ? aiIdentityValue : userRoleNumber === 1 ? role2IdentityValue : role1IdentityValue;

    // ★★★ 核心新增：获取名字 ★★★
    const userNickname = window.state.qzoneSettings.nickname || 'Tôi';

    // 辅助函数：根据下拉框的值获取名字
    const getNameFromIdentityValue = val => {
      if (val === 'user') return userNickname;
      if (window.state.chats[val]) return window.state.chats[val].name;
      return 'Nhân vật không xác định';
    };

    const role1Name = getNameFromIdentityValue(role1IdentityValue);
    const role2Name = getNameFromIdentityValue(role2IdentityValue);
    // ★★★ 新增结束 ★★★

    // 4. 初始化演绎会话
    activeStudioPlay = {
      script: script,
      userRole: userRoleNumber,
      aiRole: aiRoleNumber,
      aiChatId: aiChatId,
      // 存储身份
      aiIdentity: aiRoleNumber === 1 ? script.character1_identity : script.character2_identity,
      userPersona: userRoleNumber === 1 ? script.character1_identity : script.character2_identity,
      // ★★★ 核心新增：存储名字，供小说生成使用 ★★★
      role1Name: role1Name,
      role2Name: role2Name,
      history: [],
    };

    const backgroundMessage = {
      role: 'system',
      content: `【Bối cảnh câu chuyện】\n${script.storyBackground}`,
    };
    activeStudioPlay.history.push(backgroundMessage);

    if (script.openingRemark) {
      const openingMessage = {
        role: 'system',
        content: `【Lời mở đầu】\n${script.openingRemark}`,
      };
      activeStudioPlay.history.push(openingMessage);
    }

    roleSelectionModal.classList.remove('visible');
    renderStudioPlayScreen();
    showScreen('studio-play-screen');
  }

  /**
   * 渲染演绎界面
   */
  function renderStudioPlayScreen() {
    if (!activeStudioPlay) return;

    document.getElementById('studio-play-title').textContent = activeStudioPlay.script.name;
    playMessagesEl.innerHTML = '';

    activeStudioPlay.history.forEach(msg => {
      const bubble = createPlayMessageElement(msg);
      playMessagesEl.appendChild(bubble);
    });

    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
  }

  /**
   * 创建一条演绎消息气泡 (已修复AI气泡的class名)
   * @param {object} msg - 消息对象
   */
  function createPlayMessageElement(msg) {
    const wrapper = document.createElement('div');

    // ★★★ 核心修复：在这里判断角色并使用正确的class名 ★★★
    const roleClass = msg.role === 'assistant' ? 'ai' : msg.role;

    if (msg.role === 'system') {
      wrapper.className = 'message-wrapper studio-system';
      wrapper.innerHTML = `<div class="message-bubble studio-system-bubble">${msg.content.replace(
        /\n/g,
        '<br>',
      )}</div>`;
    } else {
      // ★★★ 使用我们新定义的 roleClass，它会将 'assistant' 转换为 'ai' ★★★
      wrapper.className = `message-wrapper ${roleClass}`;
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${roleClass}`;

      const chat = window.state.chats[activeStudioPlay.aiChatId];
      let avatarSrc = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg'; // 默认头像

      // 根据角色获取正确的头像
      if (msg.role === 'user') {
        const userNickname = window.state.qzoneSettings.weiboNickname || 'Tôi';
        const userIdentityValue =
          activeStudioPlay.userRole === 1
            ? document.getElementById('studio-role1-identity-select').value
            : document.getElementById('studio-role2-identity-select').value;
        if (userIdentityValue !== 'user' && window.state.chats[userIdentityValue]) {
          avatarSrc = window.state.chats[userIdentityValue].settings.aiAvatar;
        } else {
          avatarSrc = window.state.qzoneSettings.avatar || avatarSrc;
        }
      } else {
        // assistant
        avatarSrc = chat?.settings?.aiAvatar || avatarSrc;
      }

      bubble.innerHTML = `<img src="${avatarSrc}" class="avatar"><div class="content">${msg.content.replace(
        /\n/g,
        '<br>',
      )}</div>`;
      wrapper.appendChild(bubble);
    }

    return wrapper;
  }

  /**
   * [全新] 处理用户点击“刷新”按钮，重新生成AI的上一轮回应
   */
  async function handleRerollPlay() {
    if (!activeStudioPlay || activeStudioPlay.history.length < 2) {
      alert('Chưa đủ nội dung để làm mới đâu.');
      return;
    }

    // 撤销上一步操作
    // 通常，最后一条是旁白(system)，倒数第二条是AI的回复(assistant)
    const lastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
    if (lastMsg && lastMsg.role === 'system' && lastMsg.content.includes('【Dẫn truyện】')) {
      activeStudioPlay.history.pop();
    }

    const secondLastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
    if (secondLastMsg && secondLastMsg.role === 'assistant') {
      activeStudioPlay.history.pop();
    } else {
      // 如果AI回复后，旁白生成失败，这里可能只有AI的回复
      if (lastMsg && lastMsg.role === 'assistant') {
        activeStudioPlay.history.pop();
      }
    }

    // 重新渲染界面，移除被撤销的消息
    renderStudioPlayScreen();

    // 重新触发AI回应
    await triggerAiStudioResponse();
  }

  /**
   * 处理用户在演绎中发送行动
   */
  async function handleUserPlayAction() {
    const content = playInput.value.trim();
    if (!content) return;

    const userMessage = { role: 'user', content: content };
    activeStudioPlay.history.push(userMessage);

    // 清空输入框并刷新界面
    playInput.value = '';
    playInput.style.height = 'auto';
    playMessagesEl.appendChild(createPlayMessageElement(userMessage));
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    // 触发AI回应
    await triggerAiStudioResponse();
  }

  /**
   * 触发AI在演绎中的回应
   */
  async function triggerAiStudioResponse() {
    // ★★★ 核心修改：解构出名字变量 ★★★
    const { script, aiRole, aiChatId, history, aiIdentity, userPersona, role1Name, role2Name } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    // 如果AI扮演角色1，它就是role1Name，对手是role2Name；反之亦然。
    const aiActingName = aiRole === 1 ? role1Name : role2Name;
    const userActingName = aiRole === 1 ? role2Name : role1Name;

    // 1. 显示“角色正在行动”的提示
    const actionTypingIndicator = createTypingIndicator(`${chat.name} đang hành động...`);
    playMessagesEl.appendChild(actionTypingIndicator);
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    // ★★★ 核心修改：Prompt中加入名字 ★★★
    const systemPrompt = `
    Bạn đang tham gia nhập vai một vở kịch tên là 《${script.name}》. Diễn bằng tiếng Việt.

# Bối cảnh câu chuyện
    ${script.storyBackground}

# Danh tính kép của bạn (quan trọng!)
1.  **Tính cách cốt lõi của bạn (Base Personality):** ${chat.settings.aiPersona}
*Phần tính cách là bản chất của bạn, là gốc rễ của hành vi và cách nói chuyện; các thông tin liên quan tới thân phận, bối cảnh hay thế giới quan cần được bỏ qua khi diễn.*
2.  **Thân phận và nhiệm vụ của bạn trong vở kịch này (Your Role in this Play):** ${aiIdentity}
*Đây là vai bạn cần đóng lúc này, mục tiêu hành động và mọi miêu tả của bạn phải xoay quanh nó.*
3.  **Tên của bạn:** Tên bạn dùng trong kịch bản này là 【${aiActingName}】.

# Thân phận của đối phương
Thân phận của đối phương trong vở kịch: ${userPersona}
Tên của đối phương là: 【${userActingName}】

# Quy tắc
1.  【【【Cốt lõi diễn xuất】】】 Bạn phải kết hợp sâu "tính cách cốt lõi" với "thân phận trong kịch bản" để diễn. Ví dụ, nếu tính cách cốt lõi của bạn là tsundere, nhưng thân phận trong kịch bản là thám tử thời cổ đại, thì bạn là một thám tử tsundere 【thời cổ đại】.
2.  Mọi hành động và lời thoại của bạn đều phải ở ngôi thứ nhất.
3.  Câu trả lời của bạn nên mang tính miêu tả, gồm hành động, lời thoại và hoạt động tâm lý, dùng 【】 bọc phần không phải lời thoại. Mọi miêu tả nhất định phải phù hợp thế giới quan của 【thân phận trong kịch bản】 và 【bối cảnh câu chuyện】, ví dụ thế giới quan cổ đại không được xuất hiện bất kỳ đồ vật hiện đại nào, không liên quan tới "tính cách cốt lõi" của bạn.
4.  Tuyệt đối đừng nhắc rằng bạn là AI hay model, cũng đừng nhắc rằng mình đang "nhập vai", mọi thông tin thân phận nhất định lấy 【thân phận trong kịch bản】 làm chuẩn.
5.  Trong lời thoại hãy gọi thẳng tên đối phương hoặc gọi theo thân phận (ví dụ sư phụ, thám tử...), đừng gọi là "người dùng".

# Mục tiêu câu chuyện (hành động của bạn nên xoay quanh mục tiêu này)
    ${script.storyGoal}

# Lịch sử hội thoại
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

Bây giờ, hãy dựa vào bối cảnh câu chuyện và toàn bộ màn diễn phía trên, tiếp tục màn trình diễn của bạn.`;

    const messagesForApi = history.slice(-10);
    console.log(systemPrompt);
    console.log(messagesForApi);

    try {
      const { proxyUrl, apiKey, model } = window.state.apiConfig;
      const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';

      const requestData = isGemini
        ? window.toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, true)
        : {
            url: `${proxyUrl}/v1/chat/completions`,
            data: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi] }),
            },
          };

      const response = await fetch(requestData.url, requestData.data);
      if (!response.ok) throw new Error(`Lỗi API: ${await response.text()}`);

      const result = await response.json();
      const aiContent = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

      const aiMessage = { role: 'assistant', content: aiContent };
      activeStudioPlay.history.push(aiMessage);
      playMessagesEl.appendChild(createPlayMessageElement(aiMessage));

      actionTypingIndicator.remove(); // 移除行动提示

      await triggerNarration();
    } catch (error) {
      console.error('小剧场AI回应失败:', error);
      const errorMessage = { role: 'assistant', content: `[AI gặp lỗi: ${error.message}]` };
      playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
    } finally {
      actionTypingIndicator.remove(); // 移除行动提示
      playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
    }
  }

  /**
   * 结束演绎并显示总结弹窗
   * @param {boolean} isSuccess - 是否是成功结局
   */
  function endStudioPlay(isSuccess = false) {
    document.getElementById('studio-summary-title').textContent = isSuccess ? 'Diễn thành công!' : 'Kết thúc màn diễn';
    document.getElementById('studio-summary-content').textContent = `Mục tiêu câu chuyện: ${activeStudioPlay.script.storyGoal}`;
    summaryModal.classList.add('visible');
  }

  /**
   * 根据演绎历史生成一篇小说
   */
  async function generateNovelFromPlay() {
    await showCustomAlert('Vui lòng chờ', 'Đang biến quá trình diễn của hai bạn thành tiểu thuyết...');

    // ★★★ 核心修改：解构出名字 ★★★
    const { script, history, userRole, aiChatId, role1Name, role2Name } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    const systemPrompt = `
    # Nhiệm vụ của bạn
Bạn là một tiểu thuyết gia xuất sắc. Hãy dựa vào thiết lập kịch bản và lịch sử hội thoại dưới đây, chuyển thể quá trình nhập vai này thành một truyện ngắn hấp dẫn bằng tiếng Việt.

# Thiết lập kịch bản
- Tên kịch bản: ${script.name}
- Bối cảnh câu chuyện: ${script.storyBackground}
- Vai 1 (do ${role1Name} đóng): ${script.character1_identity}
- Vai 2 (do ${role2Name} đóng): ${script.character2_identity}
- Mục tiêu câu chuyện: ${script.storyGoal}

# Lịch sử hội thoại
    ${history
      .map(h => {
        // 这里稍微处理一下role显示，让AI更容易分辨
        let roleName =
          h.role === 'user' ? (userRole === 1 ? role1Name : role2Name) : userRole === 1 ? role2Name : role1Name;
        // 如果是system旁白
        if (h.role === 'system') return `【Dẫn truyện/Hệ thống】: ${h.content}`;
        return `${roleName}: ${h.content}`;
      })
      .join('\n')}

# Yêu cầu viết
1. Dùng lối tự sự ngôi thứ ba.
2. **Quan trọng**: Trong tiểu thuyết hãy dùng tên cụ thể của nhân vật (${role1Name} và ${role2Name}) để gọi họ, chứ không dùng "nhân vật 1" hay "người dùng".
3. Giữ câu chuyện liền mạch và logic.
4. Làm phong phú hoạt động tâm lý của nhân vật và miêu tả môi trường, lồng ghép lời thoại vào tự sự một cách liền mạch.
5. Cuối cùng phải có một kết cục rõ ràng, và chỉ ra mục tiêu câu chuyện có đạt được hay không.
6. Nội dung tiểu thuyết phải hoàn chỉnh, hấp dẫn, độ dài trên 1000 từ.
    `;

    try {
      const { proxyUrl, apiKey, model } = window.state.apiConfig;
      const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';
      const requestData = isGemini
        ? window.toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: 'Hãy bắt đầu sáng tác' }], true)
        : {
            url: `${proxyUrl}/v1/chat/completions`,
            data: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages: [{ role: 'user', content: systemPrompt }], temperature: 0.7 }),
            },
          };

      const response = await fetch(requestData.url, requestData.data);
      if (!response.ok) throw new Error(`Lỗi API: ${await response.text()}`);

      const result = await response.json();
      const novelText = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

      // 保存故事记录
      const myNickname = window.state.qzoneSettings.nickname || 'Tôi';
      const historyRecord = {
        scriptName: script.name,
        storyGoal: script.storyGoal,
        novelContent: novelText,
        timestamp: Date.now(),
        participants: {
          role1: role1Name, // 使用真实名字
          role2: role2Name, // 使用真实名字
        },
      };
      await db.studioHistory.add(historyRecord);
      console.log('故事记录已成功保存到数据库！');

      document.getElementById('studio-novel-content').textContent = novelText;
      novelModal.classList.add('visible');
      summaryModal.classList.remove('visible');
    } catch (error) {
      console.error('生成小说失败:', error);
      await showCustomAlert('Tạo thất bại', `Có lỗi: ${error.message}`);
    }
  }

  /**
   * 将生成的小说分享给参与的角色
   */
  async function shareNovel() {
    const novelText = document.getElementById('studio-novel-content').textContent;
    if (!novelText) return;

    const { aiChatId } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    const confirmed = await showCustomConfirm('Xác nhận chia sẻ', `Bạn có chắc muốn chia sẻ tiểu thuyết này cho "${chat.name}"?`);

    if (confirmed) {
      const shareMessage = {
        role: 'user',
        type: 'share_link',
        title: `Tiểu thuyết chúng ta cùng diễn: 《${activeStudioPlay.script.name}》`,
        description: 'Bấm để xem câu chuyện chúng ta cùng sáng tác!',
        source_name: 'Tiểu kịch trường',
        content: novelText,
        timestamp: Date.now(),
      };

      chat.history.push(shareMessage);
      await db.chats.put(chat);

      novelModal.classList.remove('visible');
      alert('Chia sẻ thành công!');
      // 可以选择跳转回聊天界面
      openChat(aiChatId);
    }
  }

  // ===================================================================
  // 4. 事件监听器
  // ===================================================================
  if (studioAppIcon) {
    studioAppIcon.addEventListener('click', showStudioScreen);
  }

  const studioHistoryBtn = document.getElementById('studio-history-btn');
  if (studioHistoryBtn) {
    studioHistoryBtn.addEventListener('click', openStudioHistoryScreen);
  }

  const backFromHistoryBtn = document.getElementById('back-from-studio-history');
  if (backFromHistoryBtn) {
    backFromHistoryBtn.addEventListener('click', showStudioScreen);
  }

  if (addScriptBtn) {
    addScriptBtn.addEventListener('click', () => openStudioEditor(null));
  }

  if (addScriptBtn) {
    addScriptBtn.addEventListener('click', () => openStudioEditor(null));
  }

  if (backFromEditorBtn) {
    backFromEditorBtn.addEventListener('click', showStudioScreen);
  }

  if (saveScriptBtn) {
    saveScriptBtn.addEventListener('click', saveStudioScript);
  }

  if (aiGenerateScriptBtn) {
    aiGenerateScriptBtn.addEventListener('click', generateScriptWithAI);
  }

  if (roleSelectionModal) {
    document.getElementById('cancel-role-selection-btn').addEventListener('click', () => {
      roleSelectionModal.classList.remove('visible');
    });
    document.getElementById('confirm-role-selection-btn').addEventListener('click', startStudioPlay);
  }

  if (exitPlayBtn) {
    exitPlayBtn.addEventListener('click', async () => {
      const confirmed = await showCustomConfirm('Xác nhận thoát', 'Bạn có chắc muốn thoát giữa chừng màn diễn này?', {
        confirmButtonClass: 'btn-danger',
      });
      if (confirmed) {
        endStudioPlay(false);
      }
    });
  }

  if (rerollPlayBtn) {
    rerollPlayBtn.addEventListener('click', handleRerollPlay);
  }

  if (sendPlayActionBtn) {
    sendPlayActionBtn.addEventListener('click', handleUserPlayAction);
    playInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserPlayAction();
      }
    });
  }

  if (summaryModal) {
    document.getElementById('generate-novel-btn').addEventListener('click', generateNovelFromPlay);
    document.getElementById('close-studio-summary-btn').addEventListener('click', () => {
      summaryModal.classList.remove('visible');
      showStudioScreen(); // 返回剧本列表
    });
  }

  if (novelModal) {
    document.getElementById('share-novel-btn').addEventListener('click', shareNovel);
    document.getElementById('close-novel-share-btn').addEventListener('click', () => {
      novelModal.classList.remove('visible');
      showStudioScreen();
    });
  }
  // ▼▼▼ 新增：导入导出事件绑定 ▼▼▼

  // 1. 导入按钮点击 -> 触发文件选择
  if (importScriptBtn) {
    importScriptBtn.addEventListener('click', () => {
      importInput.click();
    });
  }

  // 2. 文件选择改变 -> 执行导入逻辑
  if (importInput) {
    importInput.addEventListener('change', handleScriptImport);
  }

  // 3. 导出按钮点击
  if (exportScriptBtn) {
    exportScriptBtn.addEventListener('click', exportCurrentScript);
  }

  // ▲▲▲ 新增结束 ▲▲▲
  /**
   * 打开故事记录屏幕
   */
  async function openStudioHistoryScreen() {
    await renderStudioHistoryList();
    showScreen('studio-history-screen');
  }

  /**
   * 渲染故事记录列表
   */
  async function renderStudioHistoryList() {
    const listEl = document.getElementById('studio-history-list');
    if (!listEl) return;

    // 按时间倒序获取所有记录
    const records = await db.studioHistory.orderBy('timestamp').reverse().toArray();
    listEl.innerHTML = '';

    if (records.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa hoàn thành câu chuyện nào cả.</p>';
      return;
    }

    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'studio-script-item'; // 复用剧本列表的样式
      const recordDate = new Date(record.timestamp);

      item.innerHTML = `
                <div class="title">${record.scriptName}</div>
<div class="goal" style="margin-top: 5px;">🎭 Người tham gia: ${record.participants.role1}, ${record.participants.role2}</div>
<div class="goal" style="font-size: 12px; margin-top: 8px;">Ghi lúc: ${recordDate.toLocaleString()}</div>
            `;

      item.addEventListener('click', () => viewStudioHistoryDetail(record.id));

      // 添加长按删除
      addLongPressListener(item, async () => {
        const confirmed = await showCustomConfirm('Xóa bản ghi', 'Bạn có chắc muốn xóa bản ghi câu chuyện này? Thao tác này không thể hoàn tác.', {
          confirmButtonClass: 'btn-danger',
        });
        if (confirmed) {
          await deleteStudioHistory(record.id);
        }
      });
      listEl.appendChild(item);
    });
  }

  /**
   * 查看指定的故事记录详情（小说内容）
   * @param {number} recordId - 记录的ID
   */
  async function viewStudioHistoryDetail(recordId) {
    const record = await db.studioHistory.get(recordId);
    if (!record) {
      alert('Không tìm thấy bản ghi này!');
      return;
    }

    // 复用小说分享弹窗来显示内容
    const novelContentEl = document.getElementById('studio-novel-content');
    novelContentEl.textContent = record.novelContent;

    // 修改弹窗按钮，只保留“关闭”
    const footer = novelModal.querySelector('.modal-footer');
    footer.innerHTML = `<button class="save" id="close-history-view-btn" style="width:100%">Đóng</button>`;
    document.getElementById('close-history-view-btn').addEventListener('click', () => {
      novelModal.classList.remove('visible');
    });

    novelModal.classList.add('visible');
  }

  /**
   * 删除一条故事记录
   * @param {number} recordId - 记录的ID
   */
  async function deleteStudioHistory(recordId) {
    await db.studioHistory.delete(recordId);
    await renderStudioHistoryList(); // 刷新列表
    alert('Đã xóa bản ghi câu chuyện.');
  }

  const deleteScriptBtn = document.getElementById('delete-studio-script-btn');
  if (deleteScriptBtn) {
    deleteScriptBtn.addEventListener('click', async () => {
      if (!activeStudioScriptId) return;

      const script = await db.studioScripts.get(activeStudioScriptId);
      const scriptName = script ? script.name : 'Kịch bản này';

      const confirmed = await showCustomConfirm('Xác nhận xóa', `Bạn có chắc muốn xóa vĩnh viễn kịch bản 《${scriptName}》? Thao tác này không thể khôi phục.`, {
        confirmButtonClass: 'btn-danger',
      });

      if (confirmed) {
        await db.studioScripts.delete(activeStudioScriptId);
        activeStudioScriptId = null; // 清空当前编辑ID
        alert('Đã xóa kịch bản.');
        showStudioScreen(); // 返回剧本列表界面
      }
    });
  }

  /**
   * [新] 创建一个通用的“正在输入”提示元素 (已添加专属class)
   * @param {string} text - 要显示的提示文本
   * @returns {HTMLElement}
   */
  function createTypingIndicator(text) {
    const indicator = document.createElement('div');
    // ★★★ 核心修改：使用专属的 'studio-indicator' 类名，方便CSS精确定位 ★★★
    indicator.className = 'message-wrapper studio-indicator';
    // 同时，为了外观统一，我们让它使用和旁白一样的气泡样式
    indicator.innerHTML = `<div class="message-bubble studio-system-bubble" style="opacity: 0.8;">${text}</div>`;
    return indicator;
  }

  /**
   * [新] 触发旁白生成 (已集成结局判定功能)
   */
  async function triggerNarration() {
    const { script, history } = activeStudioPlay;

    const narrationTypingIndicator = createTypingIndicator('Câu chuyện đang phát triển...');
    playMessagesEl.appendChild(narrationTypingIndicator);
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    // ★★★ 核心修改：为旁白Prompt增加结局判定的最高优先级任务 ★★★
    const narrationPrompt = `
    # Nhiệm vụ của bạn
Bạn là "chủ ngục tối" (DM) hoặc "người dẫn truyện" nắm giữ nhịp câu chuyện. Nhiệm vụ chính của bạn là dựa vào thiết lập kịch bản và cuộc hội thoại đã diễn ra để thúc đẩy tình tiết phát triển. Viết bằng tiếng Việt.

# Thiết lập kịch bản
- Tên kịch bản: ${script.name}
- Bối cảnh câu chuyện: ${script.storyBackground}
- Mục tiêu câu chuyện: ${script.storyGoal}

# Lịch sử hội thoại đã diễn ra
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

# 【Nhiệm vụ thứ nhất: phán định kết cục (ưu tiên cao nhất)】
1.  Trước tiên, hãy đọc kỹ 【Mục tiêu câu chuyện】 ở trên.
2.  Sau đó, xem xét 【Lịch sử hội thoại đã diễn ra】, phán đoán hành động và lời thoại của các nhân vật đã đạt được rõ ràng 【Mục tiêu câu chuyện】 hay chưa.
3.  Nếu 【mục tiêu câu chuyện đã đạt】 và cốt truyện đã trọn vẹn, câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON, định dạng như sau:
{"isEnd": true, "narration": "viết lời dẫn truyện kết thúc mang tính tổng kết ở đây, ví dụ: khi sự thật được phơi bày, sóng gió này cuối cùng cũng hạ màn..."}
4.  Nếu 【mục tiêu câu chuyện chưa đạt】 hoặc cốt truyện vẫn đang phát triển, hãy tiếp tục thực hiện nhiệm vụ thứ hai.

# 【Nhiệm vụ thứ hai: tạo lời dẫn truyện (thực hiện khi chưa tới kết cục)】
1.  **Giữ trung lập**: Miêu tả ở góc nhìn khách quan ngôi thứ ba, không mang cảm xúc chủ quan của bất kỳ nhân vật nào, cũng không được có hành động hay cảm nhận của bất kỳ nhân vật nào.
2.  **Thúc đẩy cốt truyện**: Lời dẫn truyện của bạn nên đưa vào sự kiện mới, manh mối mới, thay đổi của môi trường hoặc bước ngoặt bất ngờ.
3.  **Kiểm soát nhịp**: Đừng để nhân vật đạt mục tiêu cuối cùng quá nhanh. Nhiệm vụ của bạn là tạo trắc trở và hồi hộp, để câu chuyện thú vị hơn.
4.  **Ngắn gọn súc tích**: Nội dung lời dẫn truyện không nên quá dài, vài câu là được.
5.  **Cấm lời thoại**: Câu trả lời của bạn 【chỉ được là lời dẫn truyện】, tuyệt đối không được có lời thoại của bất kỳ nhân vật nào.

Bây giờ, hãy dựa vào toàn bộ thông tin trên để bắt đầu công việc.`;

    try {
      const responseText = await getApiResponse(narrationPrompt);

      // ★★★ 核心修改：尝试解析AI的回复，判断是否为结束信号 ★★★
      try {
        const parsedResponse = JSON.parse(responseText);
        if (parsedResponse.isEnd === true && parsedResponse.narration) {
          // AI确认结局已达成
          const finalNarration = { role: 'system', content: `【Kết cục】\n${parsedResponse.narration}` };
          activeStudioPlay.history.push(finalNarration);
          playMessagesEl.appendChild(createPlayMessageElement(finalNarration));

          // 延迟一小会儿，然后弹出成功结算窗口
          setTimeout(() => {
            endStudioPlay(true);
          }, 1500);

          return; // 结束函数，不再执行后续逻辑
        }
      } catch (e) {
        // 解析失败，说明AI返回的是普通的旁白文本，不是JSON结束信号
        // 我们什么都不做，让程序继续往下走
      }

      // 如果程序能走到这里，说明结局未达成，正常处理旁白
      if (responseText) {
        const narrationMessage = { role: 'system', content: `【Dẫn truyện】\n${responseText}` };
        activeStudioPlay.history.push(narrationMessage);
        playMessagesEl.appendChild(createPlayMessageElement(narrationMessage));
      }
    } catch (error) {
      console.error('旁白生成失败:', error);
      const errorMessage = { role: 'system', content: `[Tạo lời dẫn truyện thất bại: ${error.message}]` };
      playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
    } finally {
      narrationTypingIndicator.remove();
      playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
    }
  }

  /**
   * [新] 通用的AI API请求函数
   * @param {string} systemPrompt - 发送给AI的系统指令
   * @returns {Promise<string>} AI返回的文本内容
   */
  async function getApiResponse(systemPrompt) {
    const { proxyUrl, apiKey, model } = window.state.apiConfig;
    const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';

    const temperature = parseFloat(window.state.apiConfig.temperature) || 0.8;

    // ★★★ 核心修改：为OpenAI兼容的API请求体中增加一个 user 角色消息，构成合法对话 ★★★
    const messagesForApi = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Hãy bắt đầu màn trình diễn của bạn.' }, // Gemini API也需要一个用户消息，所以我们统一添加
    ];

    const requestData = isGemini
      ? window.toGeminiRequestData(
          model,
          apiKey,
          systemPrompt,
          [{ role: 'user', content: 'Hãy bắt đầu màn trình diễn của bạn.' }],
          true,
          temperature,
        )
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          data: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            // ★★★ 使用我们新创建的、包含user角色的 messagesForApi 变量 ★★★
            body: JSON.stringify({ model, messages: messagesForApi, temperature }),
          },
        };

    const response = await fetch(requestData.url, requestData.data);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Yêu cầu API thất bại: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    // 增加对返回结果的健壮性检查
    const aiContent = isGemini
      ? result?.candidates?.[0]?.content?.parts?.[0]?.text
      : result?.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('API trả về nội dung rỗng, có thể do đã kích hoạt chính sách an toàn.');
    }

    return aiContent.trim();
  }
});
