let activeKkCharId = null; // 用于追踪正在查看哪个角色的房屋

/**
 * 【总入口】打开“查岗”功能，显示角色选择列表
 */
async function openKkCheckin() {
  const listEl = document.getElementById("kk-char-selection-list");
  listEl.innerHTML = "";
  const characters = Object.values(state.chats).filter((chat) => !chat.isGroup);

  if (characters.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Chưa có nhân vật nào để kiểm tra</p>';
  } else {
    characters.forEach((char) => {
      const item = document.createElement("div");
      item.className = "character-select-item"; // 复用“查手机”的样式
      item.dataset.chatId = char.id;
      item.innerHTML = `
                                <img src="${char.settings.aiAvatar || defaultAvatar}" alt="${char.name}">
                                <span class="name">${char.name}</span>
                            `;
      listEl.appendChild(item);
    });
  }
  showScreen("kk-char-selection-screen");
}

/**
 * 选择一个角色后，打开他/她的房屋视图
 * @param {string} charId - 被选择角色的ID
 */
async function openKkHouseView(charId) {
  activeKkCharId = charId;
  const chat = state.chats[charId];
  if (!chat) return;

  // 检查是否已经生成过房屋数据
  if (!chat.houseData) {
    // 【修改点】询问用户是否生成电脑
    const includeComputer = await showCustomConfirm(
      "Tùy chọn tạo",
      "Có cần tạo nội dung máy tính không?\n(gồm lịch sử trình duyệt, tài liệu riêng tư, game Steam...)",
      { confirmText: "Bắt buộc tạo", cancelText: "Không cần" },
    );

    // 将用户的选择传给生成函数
    const generatedData = await generateHouseData(charId, includeComputer);

    if (!generatedData) return; // 如果生成失败，则中止
    chat.houseData = generatedData;
    await db.chats.put(chat); // 保存到数据库
  }

  // 渲染房屋视图
  renderKkHouseView(chat.houseData);
  showScreen("kk-house-view-screen");
}

/**
 * 【AI核心 V3】为指定角色一次性生成所有房屋、区域和物品数据
 * @param {string} charId - 角色ID
 * @param {boolean} includeComputer - 【新增】是否包含电脑数据
 * @returns {Promise<object|null>} - 返回生成的房屋数据对象，或在失败时返回null
 */
async function generateHouseData(charId, includeComputer = true) {
  // 默认为true兼容旧代码
  const chat = state.chats[charId];
  showGenerationOverlay("Đang cố gắng lục tìm...");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    let worldBookContext = "";
    if (
      chat.settings.linkedWorldBookIds &&
      chat.settings.linkedWorldBookIds.length > 0
    ) {
      worldBookContext =
        "--- Thiết lập thế giới quan (phải tuân thủ nghiêm ngặt) ---\n" +
        chat.settings.linkedWorldBookIds
          .map((id) => {
            const book = state.worldBooks.find((b) => b.id === id);
            return book ? `[${book.name}]: ${book.content}` : "";
          })
          .join("\n\n");
    }
    const userNickname = chat.settings.myNickname || "Tôi";

    const recentHistory = chat.history
      .slice(-chat.settings.maxMemory || 20)
      .map((msg) => {
        const sender = msg.role === "user" ? userNickname : chat.name;
        return `${sender}: ${msg.content}`;
      })
      .join("\n");

    let linkedMemoryContext = "";
    if (
      chat.settings.linkedMemories &&
      chat.settings.linkedMemories.length > 0
    ) {
      // ... (保持原有的记忆互通逻辑不变) ...
      const contextPromises = chat.settings.linkedMemories.map(async (link) => {
        const linkedChat = state.chats[link.chatId];
        if (!linkedChat) return "";
        const freshLinkedChat = await db.chats.get(link.chatId);
        if (!freshLinkedChat) return "";
        const recentHistory = freshLinkedChat.history
          .filter((msg) => !msg.isHidden)
          .slice(-link.depth);
        if (recentHistory.length === 0) return "";
        const formattedMessages = recentHistory
          .map((msg) => `  - ${formatMessageForContext(msg, freshLinkedChat)}`)
          .join("\n");
        return `\n## Ngữ cảnh bổ sung: nội dung trò chuyện gần đây với "${linkedChat.name}" (chỉ bạn thấy)\n${formattedMessages}`;
      });
      const allContexts = await Promise.all(contextPromises);
      linkedMemoryContext = allContexts.filter(Boolean).join("\n");
    }

    const npcLibrary = chat.npcLibrary || [];
    let npcContext = "";
    if (npcLibrary.length > 0) {
      npcContext =
        "# Danh sách bạn bè NPC riêng của bạn" +
        npcLibrary.map((npc) => `- **${npc.name}**: ${npc.persona}`).join("\n");
    }

    let computerRulesPrompt = "";
    let computerJsonExample = "";

    if (includeComputer) {
      computerRulesPrompt = `
            4.  **【【【Quy tắc sắt kép khi tạo máy tính (nội dung phải cực kỳ chi tiết)】】】**:
-   **Chỉ thị 1 (tầng dữ liệu - không qua loa)**: Trong JSON **bắt buộc** có đối tượng "computer", và nội dung phải phong phú:
-   "browser_history": tạo 3-5 lịch sử tìm kiếm **rất cụ thể**. Đừng chỉ ghi từ khóa, hãy ghi câu tìm kiếm hoàn chỉnh hoặc tiêu đề trang web. Phải phản ánh nỗi phiền muộn, sở thích hoặc bí mật gần đây của nhân vật (ví dụ: "cách níu kéo người yêu cũ", "hướng dẫn thu thập toàn bộ game xx", "cách chữa mất ngủ", "stt buồn lúc nửa đêm").
-   "movies": hư cấu 2-3 tên file video trong ổ D của máy tính. **Bắt buộc có đuôi file** (.mp4, .mkv, .avi). Tên file phải hợp khẩu vị nhân vật (ví dụ: anime 18+, bom tấn Hollywood, phim nghệ thuật, bản quay concert thần tượng).
-   "steam_games": hư cấu 3 game Steam. Gồm tên game và thời gian chơi. Thời gian nên hơi phóng đại, thể hiện độ "nghiện" hoặc sở thích.
-   "local_files": hư cấu 2-4 file cục bộ. **Bắt buộc có trường "content"**. Nội dung không được là chỗ trống đơn giản, **bắt buộc phải cụ thể** như đoạn nhật ký, lá thư chưa gửi, bản nháp công việc hay đoạn code, thể hiện được tâm lý hiện tại của nhân vật.
-   "secret_folder": **bắt buộc có**. Đây là "chiếc hộp Pandora" của nhân vật.
-   "fileName": phải là tên file ngụy trang rất khéo (ví dụ: "Tài liệu học tập.zip", "Sao lưu hệ thống", "Thư mục mới (2)").
-   "content": **trọng tâm cốt lõi**. Dựa vào thiết lập nhân vật (${chat.settings.aiPersona}) để tạo mô tả nội dung riêng tư cụ thể.
-   Nếu nhân vật là người bình thường: có thể là nhật ký "trẻ trâu" đáng xấu hổ, ảnh chụp lén người thầm thương, tiểu thuyết Mary Sue viết dở.
-   Nếu nhân vật là "tay lái lụa"/có sở thích đặc biệt: **bắt buộc tạo tên file phim người lớn cụ thể (kèm mã số)**, tên họa sĩ doujinshi hoặc file save Galgame.
-   Nếu nhân vật là phản diện/đặc vụ: có thể là kế hoạch phạm tội, hồ sơ mục tiêu, dữ liệu mật.
-   **Yêu cầu: phải cụ thể! Đừng chỉ ghi "một số file riêng tư"! Phải ghi rõ tên file và nội dung đại khái!**
-   **Chỉ thị 2 (tầng vật lý)**: Để người dùng tìm được chiếc máy tính này, bạn **bắt buộc** phải **thêm rõ ràng** vào danh sách \`items\` của 【Phòng ngủ】 hoặc 【Phòng khách】 một món đồ có \`name\` là **"máy tính"** (hoặc "laptop").
        `;

      computerJsonExample = `,
          "computer": {
"browser_history": [ "lịch sử tìm kiếm A", "lịch sử tìm kiếm B" ],
            "local_files": [
{"fileName": "Nhật ký.txt", "content": "..."}
            ],
"movies": ["Phim A.mkv"],
"secret_folder": { "fileName": "Tài liệu học tập.zip", "content": "..." },
            "steam_games": [ {"name": "Elden Ring", "playtime": "300 h"} ]
          }`;
    } else {
      computerRulesPrompt = `4. **【Chỉ thị】**: Lần này **không cần** tạo dữ liệu máy tính, trong JSON đừng có trường "computer".`;
    }

    const systemPrompt = `
            # Nhiệm vụ
Bạn là nhà thiết kế bối cảnh hàng đầu, giàu trí tưởng tượng. Hãy dựa vào thiết lập nhân vật và lịch sử chat gần đây để thiết kế cho nhân vật "${chat.name}" một nơi ở đầy chi tiết, phù hợp thân phận. Nhiệm vụ của bạn là tạo 【toàn bộ】 dữ liệu trong một lần. Mọi nội dung chữ (trừ prompt ảnh) viết bằng tiếng Việt.

# Thông tin nhân vật
- Tên nhân vật: ${chat.name}
- Thiết lập nhân vật: ${chat.settings.aiPersona}
            ${worldBookContext}
- Lịch sử chat gần đây (để bạn tham khảo tình huống):
            ${recentHistory}
            ${linkedMemoryContext}
            ${npcContext}

# Quy tắc cốt lõi (phải tuân thủ nghiêm ngặt)
1.  **Nhất quán tình huống**: Thiết kế nơi ở và đồ vật tìm được đều phải phù hợp nghiêm ngặt với thiết lập nhân vật, thế giới quan và tình huống chat gần đây. Ví dụ, nhân vật nghèo không nên ở biệt thự, nhân vật vừa thất tình có thể tìm thấy đồ vật liên quan.
2.  **Phân khu**: Nơi ở phải có ít nhất 【Phòng khách】 và 【Phòng ngủ】. Bạn có thể thêm các khu thú vị khác tùy thiết lập (như thư phòng, bếp, ban công, tầng hầm...).
3.  **Đồ vật có thể lục (quan trọng nhất!)**:
-   Mỗi khu phải có 3-5 vị trí cụ thể đặc trưng của khu đó và có thể "lục tìm". Ví dụ: phòng khách có "gầm sofa", "ngăn kéo bàn trà", "sau kệ TV", "thùng rác"; phòng ngủ có "dưới gối", "sâu trong tủ quần áo", "ngăn kéo tủ đầu giường".
-   Bạn 【bắt buộc】 đặt sẵn nội dung tìm được ("content") sau khi lục cho 【từng】 đồ vật có thể lục.
-   Nội dung tìm được phải đầy chi tiết và trí tưởng tượng, có thể là đồ vật bình thường, cũng có thể là manh mối then chốt kích hoạt cốt truyện. **Đừng lúc nào cũng "chẳng tìm thấy gì"**.
            ${computerRulesPrompt}
5.  **Prompt ảnh**: Bạn phải tạo cho 【toàn cảnh bên ngoài】 nơi ở và 【từng khu riêng】 một mô tả 【chỉ phong cảnh hoặc tĩnh vật】 chi tiết, hoàn toàn bằng tiếng Anh, dùng để tạo ảnh từ chữ. **Tuyệt đối không được có người**. Phong cách ảnh phải là 【phong cách anime đẹp đẽ (beautiful anime style art, cinematic lighting, masterpiece)】.

# Định dạng đầu ra JSON (phải tuân thủ nghiêm ngặt, không thêm bất kỳ giải thích nào)
            {
"location": "【ví dụ: tầng thượng căn hộ cao cấp ở trung tâm thành phố】",
"description": "【mô tả ngắn không khí và phong cách tổng thể của nơi ở】",
"locationImagePrompt": "【prompt ảnh tiếng Anh cho toàn cảnh bên ngoài nơi ở】",
              "areas": {
"Phòng khách": {
"description": "【mô tả chi tiết phòng khách】",
"imagePrompt": "【prompt ảnh tiếng Anh cho phòng khách】",
                  "items": [
{"name": "Gầm sofa", "content": "Tìm thấy ít vụn đồ ăn vặt và một đồng xu bị rơi."},
{"name": "máy tính", "content": "Đây là một chiếc laptop cấu hình khá, màn hình vẫn còn sáng."}
                  ]
                },
"Phòng ngủ": { ... }
              }${computerJsonExample}
            }
            `;

    // ... (后续的API调用请求代码保持不变) ...
    const messagesForApi = [{ role: "user", content: systemPrompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      systemPrompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.8,
          }),
        });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).replace(/^```json\s*|```$/g, "");
    const houseData = JSON.parse(rawContent);

    // ▼▼▼ 逐张生成图片逻辑 (保持不变) ▼▼▼
    (async () => {
      // ... (这里保留你原本的图片生成逻辑，不用动) ...
      const generateWithRetry = async (prompt, description) => {
        let attempt = 1;
        while (true) {
          try {
            console.log(`[${attempt}次尝试] 正在为“${description}”生成图片...`);
            const url = await generateAndLoadImage(prompt);
            if (url && url.length > 100) {
              console.log(`✅ “${description}”生成成功！`);
              return url;
            } else {
              throw new Error("URL ảnh được tạo không hợp lệ");
            }
          } catch (e) {
            console.warn(
              `❌ “${description}”生成失败: ${e.message}。3秒后自动重试...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
            attempt++;
          }
        }
      };

      try {
        const currentChat = state.chats[charId];
        console.log("🚀 开始队列式生成房屋图片...");

        if (houseData.locationImagePrompt) {
          const locationUrl = await generateWithRetry(
            houseData.locationImagePrompt,
            "Toàn cảnh bên ngoài nơi ở",
          );
          const chatToUpdate = await db.chats.get(charId);
          if (chatToUpdate && chatToUpdate.houseData) {
            chatToUpdate.houseData.locationImageUrl = locationUrl;
            await db.chats.put(chatToUpdate);
          }
          if (currentChat && currentChat.houseData) {
            currentChat.houseData.locationImageUrl = locationUrl;
          }
          const houseScreen = document.getElementById("kk-house-view-screen");
          if (
            houseScreen &&
            houseScreen.classList.contains("active") &&
            activeKkCharId === charId
          ) {
            document.getElementById(
              "kk-house-background",
            ).style.backgroundImage = `url(${locationUrl})`;
          }
        }

        const areaNames = Object.keys(houseData.areas);
        for (const areaName of areaNames) {
          const area = houseData.areas[areaName];
          if (area.imagePrompt) {
            const areaUrl = await generateWithRetry(
              area.imagePrompt,
              `Khu: ${areaName}`,
            );
            const chatToUpdate = await db.chats.get(charId);
            if (
              chatToUpdate &&
              chatToUpdate.houseData &&
              chatToUpdate.houseData.areas[areaName]
            ) {
              chatToUpdate.houseData.areas[areaName].imageUrl = areaUrl;
              await db.chats.put(chatToUpdate);
            }
            if (
              currentChat &&
              currentChat.houseData &&
              currentChat.houseData.areas[areaName]
            ) {
              currentChat.houseData.areas[areaName].imageUrl = areaUrl;
            }
            const areaScreen = document.getElementById("kk-area-view-screen");
            const currentAreaNameTitle =
              document.getElementById("kk-area-name").textContent;
            if (
              areaScreen &&
              areaScreen.classList.contains("active") &&
              activeKkCharId === charId &&
              currentAreaNameTitle === areaName
            ) {
              document.getElementById(
                "kk-area-background",
              ).style.backgroundImage = `url(${areaUrl})`;
            }
          }
        }
      } catch (imgError) {
        console.error("后台图片生成流程发生不可恢复的错误:", imgError);
      }
    })();
    // ▲▲▲ 图片生成逻辑结束 ▲▲▲

    return houseData;
  } catch (error) {
    console.error("生成房屋数据失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
    return null;
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}

/**
 * 渲染房屋总览视图
 * @param {object} houseData - 角色的房屋数据
 */
function renderKkHouseView(houseData) {
  document.getElementById("kk-house-owner-name").textContent =
    `Nhà của ${state.chats[activeKkCharId].name}`;
  document.getElementById("kk-house-background").style.backgroundImage =
    `url(${houseData.locationImageUrl})`;
  document.getElementById("kk-house-location").textContent = houseData.location;
  document.getElementById("kk-house-description").textContent =
    houseData.description;

  const areasContainer = document.getElementById("kk-house-areas");
  areasContainer.innerHTML = "";
  for (const areaName in houseData.areas) {
    const areaBtn = document.createElement("button");
    areaBtn.className = "kk-area-button";
    areaBtn.textContent = areaName;
    areaBtn.onclick = () => openKkAreaView(areaName);
    areasContainer.appendChild(areaBtn);
  }
}

// ▼▼▼ 用这块【修复后】的代码，完整替换旧的 openKkAreaView 函数 ▼▼▼
/**
 * 打开并渲染指定区域的探索视图
 * @param {string} areaName - 区域名称, e.g., "客厅"
 */
function openKkAreaView(areaName) {
  const chat = state.chats[activeKkCharId];
  const areaData = chat.houseData.areas[areaName];
  if (!areaData) return;

  document.getElementById("kk-area-name").textContent = areaName;
  document.getElementById("kk-area-background").style.backgroundImage =
    `url(${areaData.imageUrl})`;
  document.getElementById("kk-area-description").textContent =
    areaData.description;

  const itemsGrid = document.getElementById("kk-area-items-grid");
  itemsGrid.innerHTML = "";

  // ★★★★★ 核心修复在这里 ★★★★★
  // 我们现在遍历的是对象数组，所以要使用 item.name
  areaData.items.forEach((item) => {
    const itemBtn = document.createElement("button");
    itemBtn.className = "kk-item-button";
    // 1. 修复：按钮上显示的文字应该是对象的 name 属性
    itemBtn.textContent = item.name;

    // 2. 修复：点击时传递给 handleRummage 的也应该是 name 字符串
    itemBtn.onclick = () => handleRummage(areaName, item.name);

    itemsGrid.appendChild(itemBtn);
  });
  // ★★★★★ 修复结束 ★★★★★

  showScreen("kk-area-view-screen");
}
/**
 * 处理“翻找”动作 (修复版：模糊匹配电脑，支持物品分享)
 */
function handleRummage(areaName, itemName) {
  // 1. 【核心修复】电脑特殊处理
  // 改用 includes，只要名字里包含“电脑”、“笔记本”或“computer”就打开电脑界面
  const lowerName = itemName.toLowerCase();
  if (
    lowerName.includes("máy tính") ||
    lowerName.includes("computer") ||
    lowerName.includes("laptop")
  ) {
    openComputer();
    return;
  }

  const chat = state.chats[activeKkCharId];
  const area = chat.houseData.areas[areaName];
  const item = area.items.find((i) => i.name === itemName);

  if (item && item.content) {
    // 2. 获取专用弹窗元素
    const modal = document.getElementById("kk-item-share-modal");
    const title = document.getElementById("kk-item-share-title");
    const contentDiv = document.getElementById("kk-item-share-content");
    const shareBtn = document.getElementById("kk-item-share-confirm-btn");

    // 3. 填充数据
    title.textContent = `Phát hiện trong "${itemName}"`;
    contentDiv.textContent = item.content;

    // 4. 清除旧监听器防止重复绑定
    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

    // 5. 绑定分享事件
    newShareBtn.addEventListener("click", () => {
      shareKkItemToChat(areaName, itemName, item.content);
      modal.classList.remove("visible");
    });

    // 6. 显示弹窗
    modal.classList.add("visible");
  } else {
    showCustomAlert(
      `Trong "${itemName}"`,
      "Lục kỹ một hồi, nhưng chẳng phát hiện thứ gì đặc biệt...",
    );
  }
}

/**
 * 将翻找到的物品以卡片形式分享给当前角色
 * (不触发AI自动回复)
 */
async function shareKkItemToChat(areaName, itemName, content) {
  if (!activeKkCharId) return;
  const chat = state.chats[activeKkCharId];
  if (!chat) return;

  const msg = {
    role: "user", // 这是用户发出的
    type: "kk_item_share",
    timestamp: Date.now(),
    payload: {
      areaName: areaName,
      itemName: itemName,
      content: content,
    },
    content: `[Tìm thấy trong nhà bạn] Đã phát hiện trong ${itemName} của ${areaName}: ${content}`,
  };

  chat.history.push(msg);
  await db.chats.put(chat);

  showNotification(activeKkCharId, "Đã gửi manh mối vào chat");
}

/**
 * 【核心功能】处理“重新翻找”按钮的点击事件
 * 这会清空旧数据，并调用AI重新生成一个全新的家。
 */
async function handleResetKkHouse() {
  if (!activeKkCharId) return;

  const confirmed = await showCustomConfirm(
    "Xác nhận tạo lại",
    "Bạn có chắc muốn tạo lại ngôi nhà này? Mọi khu vực và đồ vật hiện có sẽ bị ghi đè, thao tác này không thể hoàn tác.",
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    // 【修改点】询问用户是否生成电脑
    const includeComputer = await showCustomConfirm(
      "Tùy chọn tạo",
      "Lần tạo này có cần kèm máy tính không?",
      {
        confirmText: "Bắt buộc tạo",
        cancelText: "Không cần",
      },
    );

    const chat = state.chats[activeKkCharId];
    // 将用户的选择传给生成函数
    const generatedData = await generateHouseData(
      activeKkCharId,
      includeComputer,
    );

    if (generatedData) {
      chat.houseData = generatedData; // 用新数据覆盖旧数据
      await db.chats.put(chat); // 保存到数据库
      renderKkHouseView(chat.houseData); // 重新渲染界面
      alert("Đã tạo một ngôi nhà hoàn toàn mới!");
    }
  }
}

/**
 * 【核心功能 V2 - 已支持B站】处理“继续翻找”按钮的点击事件
 * 这会保留现有房屋结构，只让AI为每个区域或电脑添加新的可翻找物品/发现。
 */
async function handleContinueKkSearch() {
  if (!activeKkCharId) return;
  const chat = state.chats[activeKkCharId];
  if (!chat || !chat.houseData) {
    alert("Chưa tạo nhà cho nhân vật này, hãy \"Lục lại từ đầu\" một lần trước.");
    return;
  }

  showGenerationOverlay("Đang cố gắng lục tìm...");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    // 准备一个只包含现有物品名的上下文，告诉AI不要重复
    let existingItemsContext = "# Đồ vật đã có (hãy tạo đồ vật hoặc phát hiện mới khác với những thứ này)\n";
    for (const areaName in chat.houseData.areas) {
      const area = chat.houseData.areas[areaName];
      existingItemsContext += `## ${areaName}:\n`;
      existingItemsContext +=
        area.items.map((item) => `- ${item.name}`).join("\n") + "\n";
    }

    const systemPrompt = `
			# Nhiệm vụ
Bạn là nhà thiết kế bổ sung bối cảnh. Người dùng đang 【lục tìm bổ sung】 nơi ở của nhân vật "${chat.name}".
Nhiệm vụ của bạn là, trên cơ sở 【không thay đổi cấu trúc hiện có】, thêm 2-3 đồ vật có thể lục hoặc phát hiện mới hoàn toàn, thú vị, phù hợp thiết lập nhân vật cho 【khu được chỉ định】 hoặc 【máy tính】. Viết bằng tiếng Việt.

# Thông tin nhân vật
- Thiết lập: ${chat.settings.aiPersona}
- Dữ liệu nhà hiện có:
			${JSON.stringify(chat.houseData, null, 2)}
			${existingItemsContext}

# Quy tắc cốt lõi
1.  **Chỉ thêm, không sửa**: Bạn chỉ được thêm đồ vật/phát hiện mới, tuyệt đối không được sửa hay xóa dữ liệu sẵn có.
2.  **Nội dung phong phú**: "content" của đồ vật/file/bản ghi mới phát hiện phải đầy chi tiết và trí tưởng tượng, đừng lúc nào cũng "chẳng tìm thấy gì".
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON, cấu trúc giống hệt ví dụ bên dưới. Khóa là tên khu hoặc "computer", giá trị là một mảng hoặc đối tượng chứa đồ vật/phát hiện mới.

# Ví dụ định dạng đầu ra JSON (chỉ trả về đồ vật/phát hiện 【mới thêm】)
			{
"Phòng khách": [
{"name": "Tầng trên cùng kệ sách", "content": "Phát hiện một cuốn album ảnh cũ bị lãng quên."}
			  ],
			  "computer": {
"local_files": [{"fileName": "Một email chưa gửi.eml", "content": "nội dung email..."}],
"browser_history": ["Pixiv - ngắm tranh minh họa"],
"movies": ["Phim kinh điển C.rmvb"],
			    "steam_games": [
{"name": "Cyberpunk 2077", "playtime": "150 giờ"},
{"name": "Elden Ring", "playtime": "300 giờ"},
{"name": "Baldur's Gate 3", "playtime": "200 giờ"}
			    ]
			  }
			}
			`;
    const messagesForApi = [{ role: "user", content: systemPrompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      systemPrompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.9,
          }),
        });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).replace(/^```json\s*|```$/g, "");
    const newItemsData = JSON.parse(rawContent);

    // 将AI返回的新物品/发现合并到旧数据中
    for (const key in newItemsData) {
      // 如果是电脑数据
      if (key === "computer") {
        const computerUpdates = newItemsData.computer;
        for (const subKey in computerUpdates) {
          // ★★★ 这里是核心合并逻辑 ★★★
          // 确保原始数据里有这个数组，如果没有就创建一个
          if (!chat.houseData.computer[subKey]) {
            chat.houseData.computer[subKey] = [];
          }
          // 确保两个都是数组再合并
          if (
            Array.isArray(chat.houseData.computer[subKey]) &&
            Array.isArray(computerUpdates[subKey])
          ) {
            chat.houseData.computer[subKey].push(...computerUpdates[subKey]);
          }
        }
      }
      // 如果是区域物品数据
      else if (chat.houseData.areas[key] && Array.isArray(newItemsData[key])) {
        chat.houseData.areas[key].items.push(...newItemsData[key]);
      }
    }

    await db.chats.put(chat);
    alert("Đã lục ra thêm nhiều thứ mới! Giờ có thể vào khu vực hoặc máy tính để xem.");
  } catch (error) {
    console.error("继续翻找失败:", error);
    await showCustomAlert("Thao tác thất bại", `Có lỗi: ${error.message}`);
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}
/**
 * 【新增】打开电脑物品的分享确认弹窗
 * @param {string} itemName - 物品名称（如“浏览器搜索记录”、“Elden Ring”）
 * @param {string} content - 具体内容（如“搜索了xxx”、“游玩时长xxx”）
 * @param {string} sourceCategory - 来源分类（如“电脑浏览器”、“Steam库”）
 */
function openComputerItemShareModal(itemName, content, sourceCategory) {
  const modal = document.getElementById("kk-item-share-modal");
  const title = document.getElementById("kk-item-share-title");
  const contentDiv = document.getElementById("kk-item-share-content");
  const shareBtn = document.getElementById("kk-item-share-confirm-btn");

  // 1. 填充数据
  title.textContent = `Chia sẻ: ${itemName}`;
  contentDiv.textContent = content;

  // 2. 清除旧监听器防止重复绑定（克隆节点法）
  const newShareBtn = shareBtn.cloneNode(true);
  shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

  // 3. 绑定分享事件
  newShareBtn.addEventListener("click", () => {
    // 调用你已有的分享函数
    shareKkItemToChat("máy tính", `${sourceCategory} - ${itemName}`, content);
    modal.classList.remove("visible");
  });

  // 4. 显示弹窗
  modal.classList.add("visible");
}

/**
 * 【新增】通用列表展示函数 (用于浏览器历史和电影)
 * 复用 kk-file-explorer-modal 来显示列表
 */
function showComputerContentList(title, itemsArray, categoryName) {
  const listEl = document.getElementById("kk-file-list");
  const modal = document.getElementById("kk-file-explorer-modal");

  // 修改弹窗标题（临时修改，关闭时没关系）
  modal.querySelector(".modal-header span").textContent = title;

  listEl.innerHTML = ""; // 清空列表

  if (!itemsArray || itemsArray.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Trống trơn</p>';
  } else {
    itemsArray.forEach((itemStr) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "kk-file-item"; // 复用文件项样式
      itemDiv.style.cursor = "pointer";
      itemDiv.textContent = itemStr;

      // 点击列表项，弹出分享框
      itemDiv.addEventListener("click", () => {
        // 对于纯字符串列表，物品名简略显示，内容显示完整
        const shortName =
          itemStr.length > 10 ? itemStr.substring(0, 10) + "..." : itemStr;
        openComputerItemShareModal(shortName, itemStr, categoryName);
      });

      listEl.appendChild(itemDiv);
    });
  }

  modal.classList.add("visible");
}

function openComputer() {
  const chat = state.chats[activeKkCharId];
  document
    .getElementById("kk-computer-header")
    .querySelector("span").textContent = `Máy tính của ${chat.name}`;

  const desktop = document.getElementById("kk-computer-desktop");
  // 使用Flexbox布局来更好地排列图标
  desktop.style.display = "flex";
  desktop.style.flexWrap = "wrap";
  desktop.style.gap = "20px";
  desktop.style.padding = "20px";
  desktop.style.alignContent = "flex-start";

  // 获取电脑数据，用于动态显示文件名
  const computerData = chat.houseData?.computer || {};
  const secretFolderName = computerData.secret_folder?.fileName || "Thư mục mã hóa";

  desktop.innerHTML = `
			        <div class="kk-desktop-icon" id="kk-browser-icon" title="Trình duyệt">
<img src="https://i.postimg.cc/gc7tpbwp/浏览器图标.png" alt="Browser">
<span>Trình duyệt</span>
			        </div>

<div class="kk-desktop-icon" id="kk-movies-icon" title="Phim">
<img src="https://i.postimg.cc/gc7tpbwd/电影.png" alt="Movies">
<span>Phim</span>
			        </div>
<div class="kk-desktop-icon" id="kk-files-icon" title="Tài liệu riêng tư">
			            <img src="https://i.postimg.cc/9Xkg2H4h/48.png" alt="Files">
<span>Tài liệu riêng tư</span>
			        </div>
<div class="kk-desktop-icon" id="kk-secret-folder-icon" title="Thư mục bí mật">
			            <img src="https://i.postimg.cc/SQP14bXp/File_Dead_Big_Thumb.png" alt="Secret Folder">
			            <span>${secretFolderName}</span>
			        </div>
			        <div class="kk-desktop-icon" id="kk-steam-icon" title="Steam">
			            <img src="https://i.postimg.cc/xjZpQVkD/steam.png" alt="Steam">
			            <span>Steam</span>
			        </div>
			    `;

  document.getElementById("kk-computer-modal").classList.add("visible");
}

/**
 * 【V3 - 最终修复版】打开文件浏览器，为每个文件项添加data-*属性以便后续点击处理。
 */
function openFileExplorer() {
  const computerData = state.chats[activeKkCharId]?.houseData?.computer;
  const files = computerData?.local_files || [];
  const listEl = document.getElementById("kk-file-list");
  listEl.innerHTML = "";

  if (files.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Thư mục này trống</p>';
  } else {
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "kk-file-item";
      item.textContent = file.fileName;

      // --- ▼▼▼ 这就是本次修复的核心代码 ▼▼▼ ---

      // 1. 让鼠标悬浮时显示为可点击的手指形状
      item.style.cursor = "pointer";
      // 2. 将文件名和文件内容存储到元素的 data-* 属性中，方便之后读取
      item.dataset.fileName = file.fileName;
      item.dataset.fileContent = encodeURIComponent(
        file.content || "(Nội dung file trống)",
      );

      // --- ▲▲▲ 核心代码结束 ▲▲▲ ---

      listEl.appendChild(item);
    });
  }

  document.getElementById("kk-file-explorer-modal").classList.add("visible");
}

function openFileViewer(fileName, fileContent) {
  // 1. 填充标题和内容
  document.getElementById("kk-file-viewer-title").textContent = fileName;
  const decodedContent = decodeURIComponent(fileContent);

  const contentEl = document.getElementById("kk-file-viewer-content");
  contentEl.textContent = decodedContent;

  // ▼▼▼▼▼▼▼▼▼▼ 修改开始 ▼▼▼▼▼▼▼▼▼▼
  // 强制设置字体颜色为深灰色 (解决看不见的问题)
  contentEl.style.color = "#333333";
  // 建议加上这个，保留文本的换行和空格格式
  contentEl.style.whiteSpace = "pre-wrap";
  // ▲▲▲▲▲▲▲▲▲▲ 修改结束 ▲▲▲▲▲▲▲▲▲▲

  const modal = document.getElementById("kk-file-viewer-modal");
  const modalContent = modal.querySelector(".modal-content");

  // ★★★ 修复关键 1：强制弹窗容器使用 Flex 列布局 ★★★
  modalContent.style.display = "flex";
  modalContent.style.flexDirection = "column";
  modalContent.style.overflow = "hidden"; // 防止外层出现滚动条

  // 2. 检查是否已经有底部栏(footer)，如果没有就创建一个
  let footer = modalContent.querySelector(".modal-footer");
  if (!footer) {
    footer = document.createElement("div");
    footer.className = "modal-footer";

    // ★★★ 修复关键 2：移除 absolute 定位，使用标准流布局 ★★★
    // flex-shrink: 0 确保底部栏不会被压缩
    footer.style.cssText =
      "padding: 10px 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; background: #fff; flex-shrink: 0; border-radius: 0 0 12px 12px;";

    // ★★★ 修复关键 3：调整内容区域样式 ★★★
    const body = modalContent.querySelector(".modal-body");
    if (body) {
      // 移除旧的硬编码高度计算
      body.style.height = "auto";
      // 让内容区自动占据剩余空间
      body.style.flex = "1";
      // 确保内容区内部可以滚动
      body.style.overflowY = "auto";
      body.style.padding = "15px";
    }

    modalContent.appendChild(footer);
  }

  // 3. 清空旧按钮，重新生成
  footer.innerHTML = "";

  // -- 创建[关闭]按钮 --
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Tắt";
  closeBtn.className = "cancel";
  closeBtn.onclick = closeFileViewer;

  // -- 创建[分享]按钮 --
  const shareBtn = document.createElement("button");
  shareBtn.textContent = "Chia sẻ cho người ấy";
  shareBtn.className = "save";
  shareBtn.onclick = () => {
    openComputerItemShareModal(fileName, decodedContent, "Tài liệu riêng tư trên máy tính");
  };

  // 4. 添加到底部栏
  footer.appendChild(closeBtn);
  footer.appendChild(shareBtn);

  modal.classList.add("visible");
}

/**
 * 【全新】关闭文件内容查看器
 */
function closeFileViewer() {
  document.getElementById("kk-file-viewer-modal").classList.remove("visible");
}
// ▼▼▼ 【全新】kk查岗-Steam功能核心函数 ▼▼▼

/**
 * 打开Steam游戏库弹窗并渲染内容
 */
function openSteamScreen() {
  renderSteamScreen();
  document.getElementById("kk-steam-modal").classList.add("visible");
}

/**
 * 渲染Steam游戏库列表
 */
function renderSteamScreen() {
  if (!activeKkCharId) return;
  const computerData = state.chats[activeKkCharId]?.houseData?.computer;
  const games = computerData?.steam_games || [];
  const listEl = document.getElementById("kk-steam-games-list");
  listEl.innerHTML = "";

  if (games.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Thư viện game trống, thử bấm "+" ở góc trên bên phải để tạo vài game nhé!</p>';
  } else {
    // 让游戏按时长倒序排列
    games.sort((a, b) => {
      const timeA = parseFloat(a.playtime) || 0;
      const timeB = parseFloat(b.playtime) || 0;
      return timeB - timeA;
    });

    // ... 前面的代码不变 ...
    games.forEach((game, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "character-data-item";
      // 增加点击手势
      itemEl.style.cursor = "pointer";

      itemEl.innerHTML = `
                <div class="title">${game.name}</div>
<div class="content">Tổng thời gian chơi: ${game.playtime}</div>
<button class="item-delete-btn" data-type="computer.steam_games" data-index="${index}" title="Xóa bản ghi game này">×</button>
            `;

      // 【新增】绑定点击事件：点击卡片本身触发分享
      itemEl.addEventListener("click", (e) => {
        // 如果点击的是删除按钮，不要触发分享
        if (e.target.classList.contains("item-delete-btn")) return;

        openComputerItemShareModal(
          game.name,
          `Thời gian chơi: ${game.playtime}`,
          "Thư viện game Steam",
        );
      });

      listEl.appendChild(itemEl);
    });
  }
}

/**
 * 【AI核心】为Steam游戏库生成更多游戏
 */
async function generateMoreSteamGames() {
  if (!activeKkCharId) return;
  const chat = state.chats[activeKkCharId];
  if (!chat.houseData?.computer) {
    alert("Hãy tạo dữ liệu nhà đầy đủ cho nhân vật một lần trước.");
    return;
  }

  document.getElementById("generation-overlay").classList.add("visible");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    const existingGames = (chat.houseData.computer.steam_games || [])
      .map((g) => g.name)
      .join(", ");
    const prompt = `
			# Nhiệm vụ
Bạn là trình tạo dữ liệu game. Hãy dựa vào thiết lập nhân vật của "${chat.name}" để tạo 2-3 bản ghi game PC 【hoàn toàn mới】 cho thư viện game Steam của người đó.

# Thiết lập nhân vật
			${chat.settings.aiPersona}

# Game đã có (đừng tạo trùng các game sau)
			${existingGames || "Không"}

# Định dạng đầu ra JSON (phải tuân thủ nghiêm ngặt)
			{
			  "steam_games": [
{"name": "【tên game mới 1】", "playtime": "【thời gian chơi, ví dụ: 50 giờ】"},
{"name": "【tên game mới 2】", "playtime": "【thời gian chơi】"}
			  ]
			}
			`;
    const messagesForApi = [{ role: "user", content: prompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.9,
          }),
        });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).replace(/^```json\s*|```$/g, "");
    const newData = JSON.parse(rawContent);

    if (newData.steam_games && Array.isArray(newData.steam_games)) {
      if (!chat.houseData.computer.steam_games) {
        chat.houseData.computer.steam_games = [];
      }
      chat.houseData.computer.steam_games.push(...newData.steam_games);
      await db.chats.put(chat);
      renderSteamScreen();
      alert("Đã thêm bản ghi game mới!");
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng.");
    }
  } catch (error) {
    console.error("生成更多游戏失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}
// ▲▲▲ 新增函数结束 ▲▲▲
/**
 * 【总入口 V2】打开监控视图，并处理数据获取和渲染
 * @param {string} charId - 当前查看的角色ID
 */
async function openSurveillanceView(charId) {
  if (!charId) return;
  const chat = state.chats[charId];
  if (!chat || !chat.houseData) {
    alert("Không tìm thấy dữ liệu nhà của nhân vật, hãy tạo nhà trước.");
    return;
  }

  document.getElementById("kk-monitor-title").textContent =
    `Trung tâm giám sát của ${chat.name}`;

  const fiveMinutes = 5 * 60 * 1000;
  const surveillance = chat.houseData.surveillanceData;

  if (
    !surveillance ||
    !surveillance.feeds ||
    Date.now() - (surveillance.timestamp || 0) > fiveMinutes
  ) {
    try {
      const newSurveillanceData =
        await generateInitialSurveillanceFeeds(charId);
      if (newSurveillanceData) {
        // ★★★ 核心修改：保存完整的对象，包含时间戳、位置和画面数据 ★★★
        chat.houseData.surveillanceData = {
          timestamp: Date.now(),
          characterLocation: newSurveillanceData.characterLocation,
          feeds: newSurveillanceData.feeds,
        };
        await db.chats.put(chat);
        renderSurveillanceView(chat.houseData.surveillanceData); // 渲染新数据
      } else {
        document.getElementById("kk-monitor-grid").innerHTML =
          '<p style="text-align:center; color: #8a8a8a;">Không thể tạo hình ảnh camera.</p>';
      }
    } catch (error) {
      await showCustomAlert("Tạo thất bại", `Có lỗi khi tạo hình ảnh camera: ${error.message}`);
      return;
    }
  } else {
    console.log("从缓存加载监控画面。");
    // ★★★ 核心修改：直接将保存的完整对象传给渲染函数 ★★★
    renderSurveillanceView(surveillance);
  }

  showScreen("kk-monitor-screen");
}

/**
 * 【AI核心 V2 - 结构化数据】调用AI为指定角色生成所有区域的初次监控画面
 * @param {string} charId - 角色ID
 * @returns {Promise<object|null>} - 包含角色位置和各区域画面的对象，或在失败时返回null
 */
async function generateInitialSurveillanceFeeds(charId) {
  const chat = state.chats[charId];
  showGenerationOverlay("Đang kết nối tín hiệu camera...");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    // 提取世界书、聊天记录和用户人设作为上下文
    const worldBookContext = (
      await Promise.all(
        (chat.settings.linkedWorldBookIds || []).map(async (id) => {
          const book = await db.worldBooks.get(id);
          return book ? `\n## Sách thế giới: ${book.name}\n${book.content}` : "";
        }),
      )
    ).join("");

    const recentHistory = chat.history
      .slice(-10)
      .map((msg) => {
        const sender =
          msg.role === "user" ? chat.settings.myNickname || "Tôi" : chat.name;
        return `${sender}: ${msg.content}`;
      })
      .join("\n");

    const userPersona =
      state.chats[charId]?.settings?.myPersona || "Một người quan sát bình thường.";

    const areaNames = Object.keys(chat.houseData.areas);

    const systemPrompt = `
			# Nhiệm vụ
Bạn là AI hệ thống giám sát toàn tri. Nhiệm vụ của bạn là dựa vào thiết lập nhân vật và hoạt động gần đây, tạo mô tả hình ảnh camera thời gian thực cho 【từng khu】 trong nhà nhân vật, và chỉ rõ khu nhân vật 【đang ở】. Viết mô tả bằng tiếng Việt.

# Thông tin nhân vật và người quan sát
- Tên nhân vật: ${chat.name}
- Thiết lập nhân vật: ${chat.settings.aiPersona}
- Thiết lập người quan sát (người dùng): ${userPersona}
			${worldBookContext || ""}
- Lịch sử chat gần đây (để bạn tham khảo tình huống):
			${recentHistory}

# Bố cục nơi ở
Nơi ở hiện tại của nhân vật gồm các khu sau: ${areaNames.join("、 ")}

# Quy tắc cốt lõi
1.  **Góc nhìn**: Mô tả của bạn phải ở 【góc nhìn ngôi thứ ba khách quan, bình tĩnh】, như hình ảnh một chiếc camera giám sát thật ghi lại.
2.  **Nội dung**: Mô tả nhân vật 【lúc này】 có thể đang làm gì ở mỗi khu. Nếu nhân vật không ở khu nào đó, thì mô tả môi trường tĩnh của khu đó.
3.  **Tính thời gian thực**: Mô tả phải thể hiện cảm giác "đang diễn ra ngay lúc này".
4.  **【【【Quy tắc sắt về định dạng】】】**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt.
-   Đối tượng JSON này phải có khóa cấp cao nhất \`characterLocation\`, giá trị phải là chuỗi tên khu nhân vật đang ở (ví dụ: "Phòng ngủ").
-   Đối tượng JSON này còn phải có khóa cấp cao nhất \`feeds\`, giá trị là một đối tượng JSON, trong đó mỗi khóa là tên khu, mỗi giá trị là **một** đối tượng JSON **khác**, gồm hai trường sau:
-   \`"description"\`: (chuỗi) mô tả hình ảnh camera của khu đó.
-   \`"isCharacterPresent"\`: (boolean) nhân vật hiện có ở trong khu đó không (true hoặc false).

# Ví dụ định dạng đầu ra JSON (phải tuân thủ nghiêm ngặt):
			{
"characterLocation": "Phòng ngủ",
			  "feeds": {
"Phòng khách": {
"description": "Phòng khách rất yên tĩnh, nhân vật không ở đây. Màn hình TV tối đen, trên sofa vắt hờ một chiếc áo khoác.",
			      "isCharacterPresent": false
			    },
"Phòng ngủ": {
"description": "Nhân vật đang ngồi bên mép giường, cúi đầu nhìn điện thoại, ngón tay lướt nhanh trên màn hình, khóe miệng dường như phảng phất nụ cười.",
			      "isCharacterPresent": true
			    }
			  }
			}
			`;

    const messagesForApi = [{ role: "user", content: systemPrompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      systemPrompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.8,
          }),
        });

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).replace(/^```json\s*|```$/g, "");
    const surveillanceData = JSON.parse(rawContent);

    return surveillanceData;
  } catch (error) {
    console.error("生成监控画面失败:", error);
    throw error;
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}

/**
 * 【渲染函数 V2 - 全功能交互版】将监控数据渲染到屏幕上
 * @param {object} surveillanceData - 包含角色位置和画面的完整对象
 */
function renderSurveillanceView(surveillanceData) {
  const gridEl = document.getElementById("kk-monitor-grid");
  gridEl.innerHTML = "";
  const chat = state.chats[activeKkCharId];
  if (!chat) return;

  const { characterLocation, feeds } = surveillanceData;

  if (!feeds || Object.keys(feeds).length === 0) {
    gridEl.innerHTML =
      '<p style="text-align:center; color: #8a8a8a;">Không tải được hình ảnh camera.</p>';
    return;
  }

  for (const areaName in feeds) {
    const feedData = feeds[areaName];
    const area = chat.houseData.areas[areaName];
    const isCharacterPresent = feedData.isCharacterPresent;

    const feedEl = document.createElement("div");
    feedEl.className = "kk-monitor-item";
    // 将区域名存到 data-* 属性中，方便事件委托时获取
    feedEl.dataset.areaName = areaName;

    if (area && area.imageUrl) {
      feedEl.style.backgroundImage = `url(${area.imageUrl})`;
    } else {
      feedEl.style.backgroundColor = "#333";
    }

    if (areaName === characterLocation) {
      feedEl.classList.add("active-character-location");
    }

    // 只有当角色在该区域时，才显示互动按钮
    const interactionControlsHtml = isCharacterPresent
      ? `
			            <div class="monitor-interaction-controls">
<button class="monitor-btn" data-action="reroll" title="Roll lại">🔄</button>
<button class="monitor-btn" data-action="continue" title="Tiếp tục theo dõi">➡️</button>
<button class="monitor-btn" data-action="speak" title="Nói chuyện">🎤</button>
			            </div>`
      : "";

    feedEl.innerHTML = `
			            <div class="monitor-header">
			                <span>${areaName}</span>
			                <div class="rec-dot"></div>
			            </div>
			            <div class="frosted-glass-panel">
			                <div class="monitor-content-text">${feedData.description}</div>
			                ${interactionControlsHtml}
			            </div>
			        `;

    gridEl.appendChild(feedEl);
  }
}

/**
 * 【全新升级】处理监控画面中所有互动按钮点击的事件委托
 * 增加了变声器设置面板
 */
async function handleMonitorInteraction(areaName, action, feedElement) {
  const contentTextElement = feedElement.querySelector(".monitor-content-text");
  const currentContent = contentTextElement.textContent; // 获取当前画面内容

  if (action === "speak") {
    // ... (变声器HTML定义部分保持不变) ...
    const extraHtml = `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
<span style="font-size: 14px; color: #333; font-weight: 500;">🕵️ Dùng máy đổi giọng</span>
                <label class="toggle-switch" style="transform: scale(0.8);">
                    <input type="checkbox" id="monitor-voice-toggle">
                    <span class="slider"></span>
                </label>
            </div>
            <div id="monitor-voice-input-container" style="display: none; animation: fadeIn 0.3s;">
<label style="font-size: 12px; color: #666;">Thân phận ngụy trang:</label>
<input type="text" id="monitor-voice-identity" placeholder="Ví dụ: shipper, hồn ma (để trống mặc định là người lạ)"
                       style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; font-size: 13px;">
            </div>
        </div>
        `;

    let tempVoiceSettings = { enabled: false, identity: "" };

    const promptPromise = showCustomPrompt(
      `Gọi vọng tới 【${areaName}】`,
      "Nhập điều bạn muốn nói:",
      "",
      "text",
      extraHtml,
    );

    setTimeout(() => {
      const toggle = document.getElementById("monitor-voice-toggle");
      const container = document.getElementById(
        "monitor-voice-input-container",
      );
      const identityInput = document.getElementById("monitor-voice-identity");

      if (toggle && container && identityInput) {
        toggle.addEventListener("change", (e) => {
          tempVoiceSettings.enabled = e.target.checked;
          container.style.display = e.target.checked ? "block" : "none";
          if (e.target.checked) identityInput.focus();
        });
        identityInput.addEventListener("input", (e) => {
          tempVoiceSettings.identity = e.target.value;
        });
      }
    }, 50);

    const userInput = await promptPromise;

    if (userInput && userInput.trim()) {
      // ★★★ 核心修改点：在最后增加传入 currentContent ★★★
      await generateMonitorDialogue(
        areaName,
        userInput,
        contentTextElement,
        tempVoiceSettings,
        currentContent,
      );
    }
  } else {
    // Reroll 和 Continue 逻辑
    const newContent = await generateMonitorUpdate(
      areaName,
      action === "continue" ? currentContent : null, // Continue会传入当前内容
      contentTextElement,
    );
    if (newContent) {
      contentTextElement.innerHTML = newContent;
    }
  }
}

/**
 * 【AI核心】生成监控画面的“下一帧”或“重Roll”
 * @param {string} areaName - 区域名
 * @param {string|null} context - 上一帧的内容（如果是重Roll则为null）
 * @param {HTMLElement} textElement - 用于显示加载状态的文本元素
 * @returns {Promise<string|null>} - 新的画面描述
 */
async function generateMonitorUpdate(areaName, context, textElement) {
  const chat = state.chats[activeKkCharId];
  if (!chat) return null;

  textElement.innerHTML = "<i>Đang làm mới tín hiệu...</i>";

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    textElement.innerHTML = '<i style="color: #ff8a80;">API chưa được cấu hình</i>';
    return null;
  }

  // ★★★ 核心修改：优化Prompt，区分“继续”和“重Roll” ★★★
  let promptInstructions = "";
  if (context) {
    // 这种情况是点击了“继续”箭头
    promptInstructions = `
        # Hình ảnh giây trước (Context)
        “${context}”

# Nhiệm vụ
Hãy dựa trên "Hình ảnh giây trước", **nối tiếp dòng thời gian** để mô tả giây tiếp theo đã xảy ra gì.
Hành vi phải liền mạch. Ví dụ: nếu vừa cầm cốc lên, giờ có thể đang uống nước; nếu vừa xem điện thoại, giờ có thể đã thấy tin nhắn buồn cười.
Đừng nhảy sang hành động hoàn toàn không liên quan.
    `;
  } else {
    // 这种情况是点击了“重Roll”刷新
    promptInstructions = `
        # Nhiệm vụ
Hãy bỏ qua trạng thái trước đó, **tạo lại** một trạng thái/sự kiện ngẫu nhiên hoàn toàn mới của nhân vật này trong 【${areaName}】.
    `;
  }

  const prompt = `
			Bạn là AI hệ thống giám sát, đang quan sát hoạt động của nhân vật "${chat.name}" ở khu 【${areaName}】.
Thiết lập nhân vật: ${chat.settings.aiPersona}

            ${promptInstructions}

Mô tả của bạn phải ở góc nhìn ngôi thứ ba khách quan, như camera ghi lại, và viết bằng tiếng Việt.
Nếu nhân vật nói, hãy bọc lời nói trong dấu ngoặc kép.
Câu trả lời của bạn chỉ được là văn bản thuần, không kèm JSON hay giải thích nào khác.
			`;

  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: prompt }];
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.9,
          }),
        });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).trim();
  } catch (error) {
    textElement.innerHTML = `<i style="color: #ff8a80;">Mất tín hiệu: ${error.message}</i>`;
    return null;
  }
}

/**
 * 【AI核心】处理通过监控进行的对话 (支持变声器 + 用户人设注入 + 上下文感知)
 * @param {string} areaName - 区域名
 * @param {string} userInput - 用户说的话
 * @param {HTMLElement} textElement - 用于显示加载状态的文本元素
 * @param {object} voiceSettings - 变声器设置
 * @param {string} currentContext - ★新增参数：对话发生前的画面描述
 */
async function generateMonitorDialogue(
  areaName,
  userInput,
  textElement,
  voiceSettings,
  currentContext,
) {
  const chat = state.chats[activeKkCharId];
  if (!chat) return;

  textElement.innerHTML = "<i>Đang chờ đối phương phản hồi...</i>";

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    textElement.innerHTML =
      '<i style="color: #ff8a80;">Micro hỏng: API chưa được cấu hình</i>';
    return;
  }

  const userNickname =
    chat.settings.myNickname || state.qzoneSettings.nickname || "Tôi";
  const userPersona = chat.settings.myPersona || "Không có thiết lập riêng, người dùng bình thường.";

  let soundSourceDescription = "";
  let uiSourceLabel = "";

  if (voiceSettings && voiceSettings.enabled) {
    const identity = voiceSettings.identity
      ? voiceSettings.identity.trim()
      : "Người lạ";
    soundSourceDescription = `Từ loa giám sát vọng ra một **giọng nói lạ đã qua xử lý đổi giọng**. Giọng nói này nghe như của một 【${identity}】. Giọng nói đó nói với bạn: "${userInput}".\n【Chỉ thị quan trọng】: Bạn hoàn toàn không nhận ra đây là giọng của ${userNickname}.`;
    uiSourceLabel = `(Ngụy trang thành: ${identity})`;
  } else {
    soundSourceDescription = `Từ loa giám sát vọng ra giọng nói rất quen thuộc với bạn, giọng của người dùng (${userNickname}). ${userNickname} nói với bạn qua camera: "${userInput}".\n# Thiết lập của người nói (${userNickname}): ${userPersona}\n【Chỉ thị quan trọng】: Bạn lập tức nhận ra đây là giọng của ${userNickname}, hãy tương tác tự nhiên.`;
    uiSourceLabel = `(Bạn)`;
  }

  // ★★★ 核心修改：在Prompt中加入当前上下文 ★★★
  const prompt = `
    # Nhiệm vụ nhập vai
Bây giờ bạn là nhân vật "${chat.name}", bạn đang ở trong 【${areaName}】.

# Trạng thái lúc này (ngữ cảnh)
Ngay vừa rồi, **${currentContext || "bạn đang ngồi ngẩn người trong phòng"}**.

# Sự việc bất ngờ
Đột nhiên, ${soundSourceDescription}

# Thiết lập nhân vật của bạn
    ${chat.settings.aiPersona}

# Nhiệm vụ của bạn
Hãy dùng 【ngôi thứ nhất】, **ngay tiếp nối trạng thái vừa rồi**, đưa ra 【phản ứng】 với câu nói bất ngờ này bằng tiếng Việt.
Nếu vừa rồi bạn đang ngủ, giờ có thể bị đánh thức; nếu vừa rồi bạn đang đọc sách, có thể sẽ đặt sách xuống.
Câu trả lời của bạn nên gồm 【hoạt động tâm lý, hành động, và lời nói ra】.
Câu trả lời của bạn chỉ được là văn bản thuần.
    `;

  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: prompt }];
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.8,
          }),
        });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const aiResponse = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).trim();

    textElement.innerHTML = `“${userInput}” <i style="font-size:12px; opacity:0.8;">${uiSourceLabel}</i><br><br>${aiResponse}`;
  } catch (error) {
    textElement.innerHTML = `<i style="color: #ff8a80;">Liên lạc thất bại: ${error.message}</i>`;
  }
}

/**
 * 【AI核心 V2 - 智能移动版】当用户点击“刷新”时，生成所有区域的新状态
 * @param {string} charId - 角色ID
 * @returns {Promise<object|null>} - 新的完整监控数据
 */
async function generateSurveillanceUpdate(charId) {
  const chat = state.chats[charId];
  if (!chat || !chat.houseData) return null;

  showGenerationOverlay("Đang làm mới mọi camera...");

  const lastSurveillance = chat.houseData.surveillanceData;

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    const systemPrompt = `
			# Nhiệm vụ
Bạn là AI hệ thống giám sát toàn tri. Nhiệm vụ của bạn là dựa trên 【trạng thái trước】 của nhân vật "${chat.name}", suy ra hành động người đó có thể làm ở 【giây tiếp theo】, và cập nhật hình ảnh của mọi khu được giám sát. Người đó có thể di chuyển từ phòng này sang phòng khác. Viết bằng tiếng Việt.

# Thông tin nhân vật
- Thiết lập: ${chat.settings.aiPersona}

# Trạng thái giám sát giây trước (tham khảo quan trọng)
			${JSON.stringify(lastSurveillance, null, 2)}

# Quy tắc cốt lõi
1.  **Logic liền mạch**: Cập nhật của bạn phải dựa trên trạng thái giây trước, đưa ra suy luận hợp logic. Ví dụ, nếu giây trước đang xem điện thoại trong phòng ngủ, giây sau có thể là xem tiếp, đặt điện thoại xuống chuẩn bị ngủ, hoặc đi ra phòng khách.
2.  **Nhân vật di chuyển**: Nhân vật 【có thể】 di chuyển sang khu mới. Bạn 【bắt buộc】 chỉ chính xác vị trí mới của người đó trong trường \`characterLocation\`.
3.  **Cập nhật trạng thái**: Mô tả hình ảnh của 【mọi】 khu đều phải được cập nhật. Nếu nhân vật vào khu mới, \`isCharacterPresent\` của khu đó phải thành \`true\`, của khu cũ phải thành \`false\`.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc】 tuân thủ nghiêm ngặt định dạng JSON giống hệt lúc tạo ban đầu.

Bây giờ, hãy tạo toàn bộ dữ liệu giám sát của giây tiếp theo.
			`;

    const messagesForApi = [{ role: "user", content: systemPrompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      systemPrompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.8,
          }),
        });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).replace(/^```json\s*|```$/g, "");
    return JSON.parse(rawContent);
  } catch (error) {
    console.error("刷新监控画面失败:", error);
    await showCustomAlert("Làm mới thất bại", `Có lỗi: ${error.message}`);
    return null;
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}
/**
 * 【全新】显示加载动画并设置指定的文字
 * @param {string} text - 要显示的加载提示文字
 */
function showGenerationOverlay(text) {
  const overlay = document.getElementById("generation-overlay");
  const textElement = document.getElementById("generation-text");
  if (textElement) {
    textElement.textContent = text;
  }
  overlay.classList.add("visible");
}
/* ================= KK查岗 - 沉浸式衣帽间 ================= */

// 当前选中的标签页
let activeWardrobeCategory = "Áo";

// 1. 更新搭配对象，增加新分类
let currentOutfit = {
  "Phụ kiện tóc": null, // 细分出的配饰
  "Áo": null,
  "Quần": null,
  "Giày": null, // 新增
  "Trang sức": null, // 细分出的配饰
  "Đặc biệt": null,
};

/**
 * 2. 替换 openKkWardrobe 函数 (最终修复版：独立工具栏，不遮挡任何东西)
 */
async function openKkWardrobe() {
  if (!activeKkCharId) return;
  const chat = state.chats[activeKkCharId];

  // 检查是否有房屋数据
  if (!chat || !chat.houseData) {
    alert("Hãy bấm \"Bắt đầu lục tìm\" để tạo dữ liệu nhà trước, rồi mới xem tủ quần áo.");
    return;
  }

  // 检查是否有衣柜数据，没有则生成
  if (!chat.houseData.wardrobe) {
    const confirmed = await showCustomConfirm(
      "Phát hiện tủ quần áo",
      `Bạn đẩy cửa tủ quần áo trong phòng ngủ ra...\n\nBên trong trống trơn, có muốn để AI tạo quần áo cho ${chat.name} không?`,
      { confirmText: "Tạo tủ quần áo" },
    );
    if (confirmed) {
      await generateWardrobeData(activeKkCharId);
    } else {
      return;
    }
  }

  // 初始化界面状态
  currentOutfit = {
    "Phụ kiện tóc": null,
    "Áo": null,
    "Quần": null,
    "Giày": null,
    "Trang sức": null,
    "Đặc biệt": null,
  };
  document.getElementById("wardrobe-reaction-bubble").style.display = "none";
  document.getElementById("wardrobe-try-on-btn").disabled = true;
  document.getElementById("wardrobe-try-on-btn").textContent = "Bắt người ấy mặc vào";

  // 设置头像
  document.getElementById("wardrobe-char-avatar").src =
    chat.settings.aiAvatar || defaultAvatar;

  // 1. 更新搭配槽位 (HTML)
  const displayContainer = document.getElementById("current-outfit-display");

  // 清除旧的悬浮按钮（如果之前生成过，防止残留）
  const oldFloatBtn = document.getElementById("wardrobe-history-floating-btn");
  if (oldFloatBtn) oldFloatBtn.remove();

  displayContainer.innerHTML = `
        <div class="outfit-slot" data-type="Phụ kiện tóc" data-placeholder="Phụ kiện tóc"></div>
<div class="outfit-slot" data-type="Áo" data-placeholder="Áo trên"></div>
<div class="outfit-slot" data-type="Quần" data-placeholder="Quần"></div>
<div class="outfit-slot" data-type="Giày" data-placeholder="Giày"></div>
<div class="outfit-slot" data-type="Trang sức" data-placeholder="Trang sức"></div>
<div class="outfit-slot" data-type="Đặc biệt" data-placeholder="Đặc biệt"></div>
    `;

  // 2. 更新分类标签页 (HTML)
  const tabsContainer = document.querySelector(
    "#wardrobe-inventory-area .wardrobe-tabs",
  );
  tabsContainer.innerHTML = `
        <div class="wardrobe-tab active" data-cat="Phụ kiện tóc">Phụ kiện tóc</div>
<div class="wardrobe-tab" data-cat="Áo">Áo</div>
<div class="wardrobe-tab" data-cat="Quần">Quần</div>
<div class="wardrobe-tab" data-cat="Giày">Giày</div>
<div class="wardrobe-tab" data-cat="Trang sức">Trang sức</div>
<div class="wardrobe-tab" data-cat="Đặc biệt">Đặc biệt</div>
    `;

  // ★★★★★ 修复重点：插入独立工具栏 ★★★★★
  // 我们找到 Inventory Area (库存区域)，把按钮插在 标签页(tabs) 的正上方
  const inventoryArea = document.getElementById("wardrobe-inventory-area");

  // 检查是否已经创建了工具栏容器
  let toolbar = document.getElementById("wardrobe-toolbar-row");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "wardrobe-toolbar-row";
    // 样式：右对齐，留一点内边距，放在标准流中
    toolbar.style.cssText = `
          display: flex; 
          justify-content: flex-end; 
          padding: 5px 15px 0 15px; 
          margin-bottom: 5px;
      `;

    // 把它插入到 tabsContainer 的前面 (即：搭配展示区 和 标签页 之间)
    inventoryArea.insertBefore(toolbar, tabsContainer);
  }

  // 清空工具栏并添加按钮
  toolbar.innerHTML = "";

  const historyBtn = document.createElement("button");
  historyBtn.innerHTML = "📜 Lịch sử phối đồ";
  // 按钮样式：小巧一点，不喧宾夺主
  historyBtn.style.cssText = `
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 12px;
      color: #555;
      cursor: pointer;
  `;
  historyBtn.onclick = openWardrobeHistory;

  toolbar.appendChild(historyBtn);
  // ★★★★★ 修复结束 ★★★★★

  // 重置当前标签页为“上装”
  activeWardrobeCategory = "Áo";

  // 渲染
  renderWardrobeUI();
  showScreen("kk-wardrobe-screen");
}

/**
 * 2. 核心渲染函数：渲染分类标签、网格和选中状态
 */
function renderWardrobeUI() {
  const chat = state.chats[activeKkCharId];
  const items = chat.houseData.wardrobe || [];

  // 1. 更新顶部搭配槽的显示
  const slots = document.querySelectorAll(".outfit-slot");
  slots.forEach((slot) => {
    const type = slot.dataset.type;
    const selectedItem = currentOutfit[type];

    if (selectedItem) {
      slot.classList.add("filled");
      slot.innerHTML = selectedItem.icon;
      // 点击槽位可以取消选择
      slot.onclick = () => selectCloth(type, null);
    } else {
      slot.classList.remove("filled");
      slot.innerHTML = "";
      slot.onclick = null;
    }
  });

  // 2. 更新“穿上”按钮状态 (至少选一件)
  const hasSelection = Object.values(currentOutfit).some((v) => v !== null);
  const btn = document.getElementById("wardrobe-try-on-btn");
  btn.disabled = !hasSelection;

  // 3. 渲染底部库存网格
  const grid = document.getElementById("wardrobe-grid");
  grid.innerHTML = "";

  // 筛选当前标签页的衣服
  const filteredItems = items.filter((item) => {
    if (activeWardrobeCategory === "Khác") {
      return !["Áo", "Quần", "Phụ kiện", "Đặc biệt"].includes(item.category);
    }
    return item.category === activeWardrobeCategory;
  });

  if (filteredItems.length === 0) {
    grid.innerHTML =
      '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:20px;">Phân loại này không có quần áo nào</p>';
  } else {
    filteredItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "cloth-card";

      // 检查是否被选中
      if (
        currentOutfit[item.category] &&
        currentOutfit[item.category].name === item.name
      ) {
        card.classList.add("selected");
      }

      card.innerHTML = `
                <div class="cloth-icon">${item.icon || "👕"}</div>
                <div class="cloth-name">${item.name}</div>
                <div class="cloth-desc">${item.description}</div>
            `;

      // 点击卡片：选中或取消
      card.addEventListener("click", () => {
        // 如果已经选中，则取消；否则选中
        if (
          currentOutfit[item.category] &&
          currentOutfit[item.category].name === item.name
        ) {
          selectCloth(item.category, null);
        } else {
          selectCloth(item.category, item);
        }
      });

      grid.appendChild(card);
    });
  }

  // 4. 更新标签页高亮
  document.querySelectorAll(".wardrobe-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.cat === activeWardrobeCategory);
  });
}

/**
 * 辅助：选择衣服
 */
function selectCloth(category, item) {
  currentOutfit[category] = item;
  // 隐藏之前的反应气泡，因为搭配变了
  document.getElementById("wardrobe-reaction-bubble").style.display = "none";
  document.getElementById("wardrobe-try-on-btn").textContent = "Bắt người ấy mặc vào";
  renderWardrobeUI();
}

/**
 * 3. 核心功能：试穿并触发AI反应 (修改版：增加历史记录保存功能)
 */
async function handleTryOn() {
  const chat = state.chats[activeKkCharId];
  if (!chat) return;

  // 1. 收集选中的衣服
  const selectedItems = Object.values(currentOutfit).filter((i) => i !== null);
  if (selectedItems.length === 0) return;

  // 2. 界面进入加载状态
  const btn = document.getElementById("wardrobe-try-on-btn");
  btn.disabled = true;
  btn.textContent = "Đang thay đồ...";
  document.getElementById("wardrobe-comment-bubble").style.display = "none";
  const bubble = document.getElementById("wardrobe-reaction-bubble");
  bubble.style.display = "none";

  try {
    // --- 构建搭配描述 ---
    const outfitNames = selectedItems.map((i) => i.name).join(" + ");
    const outfitDesc = selectedItems
      .map((i) => `【${i.category}】${i.name} (${i.description})`)
      .join(" + ");

    // --- 步骤 A: 更新心声 (保持原逻辑) ---
    if (!chat.latestInnerVoice) {
      chat.latestInnerVoice = {
        clothing: "",
        behavior: "",
        thoughts: "",
        naughtyThoughts: "",
      };
    }
    chat.latestInnerVoice.clothing = `Đang mặc ${outfitNames}`;
    if (!chat.innerVoiceHistory) chat.innerVoiceHistory = [];
    chat.innerVoiceHistory.push({
      ...chat.latestInnerVoice,
      timestamp: Date.now(),
    });

    const hiddenComments = selectedItems
      .map((i) =>
        i.charComment ? `(Suy nghĩ trong lòng về ${i.name}: ${i.charComment})` : "",
      )
      .join(" ");

    const prompt = `
        # Bối cảnh
Người dùng đã chọn một bộ quần áo trong tủ của bạn và yêu cầu bạn mặc vào.
# Nhân vật của bạn
        ${chat.settings.aiPersona}
# Bộ quần áo người dùng phối
        ${outfitDesc}
        ${hiddenComments}
# Nhiệm vụ
Hãy dùng ngôi thứ nhất, đưa ra phản ứng sau khi mặc bộ đồ này bằng tiếng Việt.
Bạn cần kết hợp thiết lập nhân vật, phong cách bộ đồ (xấu hổ, thường ngày hay lộng lẫy?) cùng hành động ép phối đồ của người dùng, để đưa ra một câu trả lời giàu hình ảnh.
Câu trả lời bắt buộc có miêu tả 【hành động】 hoặc 【thần thái】.
# Yêu cầu định dạng
Chỉ trả về văn bản thuần, không dùng JSON. Độ dài 30-60 từ.
        `;

    // 4. 调用API
    const { proxyUrl, apiKey, model } = state.apiConfig;
    let isGemini = proxyUrl === GEMINI_API_URL;
    const messagesForApi = [{ role: "user", content: prompt }];
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.9,
          }),
        });

    if (!response.ok) throw new Error("Yêu cầu API thất bại");
    const data = await response.json();
    const reactionText = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).trim();

    // ================== ★★★ 新增：保存历史搭配记录 ★★★ ==================
    if (!chat.houseData.wardrobeHistory) {
      chat.houseData.wardrobeHistory = [];
    }

    // 创建一条历史记录对象
    const historyEntry = {
      id: Date.now(), // 唯一ID
      timestamp: Date.now(), // 时间戳
      dateStr: new Date().toLocaleString(), // 可读时间
      items: selectedItems, // 具体的衣服对象数组
      summary: outfitNames, // 衣服名字组合字符串
      reaction: reactionText, // AI当时的评价
    };

    // 加到数组最前面
    chat.houseData.wardrobeHistory.unshift(historyEntry);

    // 为了防止记录无限膨胀，只保留最近50条
    if (chat.houseData.wardrobeHistory.length > 50) {
      chat.houseData.wardrobeHistory = chat.houseData.wardrobeHistory.slice(
        0,
        50,
      );
    }

    // 立即保存到数据库，确保记录不丢失
    await db.chats.put(chat);
    console.log("已保存搭配历史:", historyEntry);
    // ====================================================================

    // --- 步骤 B: 弹出确认框 (保持原逻辑) ---
    const now = Date.now();
    const wantToDiscuss = await showCustomConfirm(
      "Thay đồ xong",
      `${chat.name} đã thay sang 【${outfitNames}】 và nói:\n\n"${reactionText}"\n\nCó muốn vào giao diện chat để tiếp tục bàn với người ấy về bộ đồ này không?`,
      { confirmText: "Đi bàn luận", cancelText: "Xem ở đây thôi" },
    );

    if (wantToDiscuss) {
      const eventMsg = {
        role: "system",
        type: "pat_message",
        content: `[Bạn đã thay cho ${chat.name}: ${outfitNames}]`,
        timestamp: now,
      };
      const aiMsg = {
        role: "assistant",
        senderName: chat.name,
        content: reactionText,
        timestamp: now + 1,
      };
      const hiddenInstruction = {
        role: "system",
        content: `[Thông báo hệ thống: người dùng vừa thay cho bạn 【${outfitDesc}】 trong phòng thay đồ. Trang phục hiện tại của bạn đã được cập nhật. Hãy dựa vào tạo hình mới này để tiếp tục trò chuyện với người dùng.]`,
        timestamp: now + 2,
        isHidden: true,
      };
      chat.history.push(eventMsg, aiMsg, hiddenInstruction);
      await db.chats.put(chat);
      openChat(activeKkCharId);
    } else {
      bubble.querySelector(".content").textContent = reactionText;
      bubble.style.display = "block";
      btn.textContent = "Đã thay đồ";
    }
  } catch (error) {
    console.error("试穿失败:", error);
    alert("Thay đồ thất bại, có lẽ vì quần áo quá chật (lỗi API)...");
  } finally {
    btn.disabled = false;
  }
}

// ================= KK查岗 - 沉浸式衣帽间 (升级版) =================

// 辅助函数：生成衣服图片 (使用 Pollinations，因为它生成物品效果好且快，无需鉴权)
async function generateClothingImage(prompt) {
  // 强制加上白底、产品摄影等关键词
  const enhancedPrompt = `clothing product photography, ${prompt}, white background, flat lay style, studio lighting, high quality, 4k, realistic, no human`;
  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  // 使用随机数防止缓存
  const randomSeed = Math.floor(Math.random() * 10000);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${randomSeed}`;
}

/**
 * 核心渲染函数：渲染分类标签、网格和选中状态
 * (修改版：支持显示图片)
 */
function renderWardrobeUI() {
  const chat = state.chats[activeKkCharId];
  const items = chat.houseData.wardrobe || [];

  // 1. 更新顶部搭配槽的显示
  const slots = document.querySelectorAll(".outfit-slot");
  slots.forEach((slot) => {
    const type = slot.dataset.type;
    const selectedItem = currentOutfit[type];

    if (selectedItem) {
      slot.classList.add("filled");
      // 如果有图片，显示图片；否则显示 emoji
      if (selectedItem.imageUrl) {
        slot.innerHTML = `<img src="${selectedItem.imageUrl}" style="width:100%; height:100%; object-fit:contain;">`;
      } else {
        slot.innerHTML = selectedItem.icon || "👕";
      }
      slot.onclick = () => selectCloth(type, null);
    } else {
      slot.classList.remove("filled");
      slot.innerHTML = slot.dataset.placeholder; // 显示占位文字
      slot.onclick = null;
    }
  });

  // 2. 更新“穿上”按钮状态
  const hasSelection = Object.values(currentOutfit).some((v) => v !== null);
  const btn = document.getElementById("wardrobe-try-on-btn");
  if (btn) btn.disabled = !hasSelection;

  // 3. 渲染底部库存网格
  const grid = document.getElementById("wardrobe-grid");
  grid.innerHTML = "";

  const filteredItems = items.filter(
    (item) => item.category === activeWardrobeCategory,
  );

  if (filteredItems.length === 0) {
    grid.innerHTML =
      '<p style="grid-column:1/-1; text-align:center; color:#999; margin-top:20px;">Phân loại này không có quần áo nào</p>';
  } else {
    filteredItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "cloth-card";

      // 检查是否被选中
      if (
        currentOutfit[item.category] &&
        currentOutfit[item.category].name === item.name
      ) {
        card.classList.add("selected");
      }

      // 图片显示逻辑
      let visualContent;
      if (item.imageUrl) {
        visualContent = `<img src="${item.imageUrl}" class="cloth-img" style="width:100%; height:80px; object-fit:contain; border-radius:4px;" loading="lazy">`;
      } else {
        visualContent = `<div class="cloth-icon" style="font-size:40px;">${item.icon || "👕"}</div>`;
      }

      card.innerHTML = `
                ${visualContent}
                <div class="cloth-name" style="font-size:12px; margin-top:5px; font-weight:bold;">${item.name}</div>
            `;

      // 点击卡片：选中或取消
      card.addEventListener("click", () => {
        if (
          currentOutfit[item.category] &&
          currentOutfit[item.category].name === item.name
        ) {
          selectCloth(item.category, null);
        } else {
          selectCloth(item.category, item);
        }
      });

      grid.appendChild(card);
    });
  }

  // 4. 更新标签页高亮
  document.querySelectorAll(".wardrobe-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.cat === activeWardrobeCategory);
  });
}

/**
 * 辅助：选择衣服 (修改版：显示看法)
 */
function selectCloth(category, item) {
  currentOutfit[category] = item;

  const commentBubble = document.getElementById("wardrobe-comment-bubble");
  const reactionBubble = document.getElementById("wardrobe-reaction-bubble");
  const tryOnBtn = document.getElementById("wardrobe-try-on-btn");

  // 隐藏试穿反应，显示物品看法
  reactionBubble.style.display = "none";
  commentBubble.style.display = "block";

  if (item) {
    // 如果选中了衣服，显示该衣服的评论
    commentBubble.querySelector(".content").innerHTML =
      `<strong>${item.name}</strong><br>"${item.charComment}"`;
  } else {
    // 如果取消选择，显示默认提示
    commentBubble.querySelector(".content").textContent =
      "(ướm thử lên người...)";
  }

  tryOnBtn.textContent = "Bắt người ấy mặc vào";
  renderWardrobeUI();
}

/**
 * 【AI核心】生成衣柜数据 (修改版：包含新分类 + 逐个生成 + 实时保存)
 */
async function generateWardrobeData(charId) {
  const chat = state.chats[charId];
  showGenerationOverlay("Đang lén mở tủ quần áo...");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    const prompt = `
        # Nhiệm vụ
Bây giờ bạn là nhân vật "${chat.name}". Người dùng đang xem 【tủ quần áo riêng】 của bạn.
Hãy dựa vào thiết lập nhân vật để tạo nội dung tủ quần áo của bạn. Viết chữ bằng tiếng Việt.

# Thiết lập nhân vật
        ${chat.settings.aiPersona}

# Yêu cầu cốt lõi
1. **Tạo phân loại**: phải gồm các phân loại sau (ghi đúng chính xác tên): 【Phụ kiện tóc】, 【Áo】, 【Quần】, 【Giày】, 【Trang sức】, 【Đặc biệt】.
2. **Số lượng**: mỗi phân loại 1-2 món, tổng cộng 10-15 món.
3. **Chi tiết nội dung**:
- "category": phải là một trong các phân loại trên.
- "name": tên món đồ.
           - "icon": emoji。
- "description": mô tả ngắn.
- "imagePrompt": **Quan trọng!** Prompt tiếng Anh dùng để tạo ảnh món đồ. Phải mô tả kiểu dáng, màu sắc, chất liệu, **không có người**, nhấn mạnh là ảnh trưng bày sản phẩm (e.g., "a pair of red high heels, product photography, white background").
- "charComment": **Trọng tâm!** Viết bằng 【ngôi thứ nhất】 cảm nghĩ của bạn về món đồ này (cà khịa, kỷ niệm, cảm giác xấu hổ...).

# Định dạng đầu ra JSON
        {
          "wardrobe": [
            {
"category": "Giày",
"name": "Giày cao gót đỏ",
              "icon": "👠",
"description": "Giày cao gót da bóng đế đỏ.",
              "imagePrompt": "red patent leather high heels, side view, elegant, product photography, white background",
"charComment": "Chỉ dịp quan trọng mới mang thôi..."
            }
          ]
        }
        `;

    const messagesForApi = [{ role: "user", content: prompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.85,
          }),
        });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();

    const result = JSON.parse(rawContent);

    if (result && result.wardrobe) {
      // 1. 先保存文字数据，确保即使生图失败，物品也在
      chat.houseData.wardrobe = result.wardrobe;
      await db.chats.put(chat);

      // 2. --- 逐个生成图片并实时保存 (串行队列) ---
      const total = result.wardrobe.length;
      const overlayText = document.getElementById("generation-text");

      for (let i = 0; i < total; i++) {
        const item = chat.houseData.wardrobe[i]; // 直接操作 chat 对象里的数据引用

        // 更新UI提示
        if (overlayText) {
          overlayText.textContent = `Đang chụp ảnh quần áo (${i + 1}/${total}): ${item.name}...`;
        }

        if (item.imagePrompt) {
          try {
            // 生成图片
            const url = await generateClothingImage(item.imagePrompt);
            // 更新内存数据
            item.imageUrl = url;
            // ★★★ 核心：每生成一张，立刻保存一次数据库 ★★★
            await db.chats.put(chat);
            console.log(`✅ 已保存图片: ${item.name}`);
          } catch (e) {
            console.error(`❌ 图片生成失败: ${item.name}`, e);
          }
        }

        // 可选：稍微延迟一下，防止请求过快
        await new Promise((r) => setTimeout(r, 500));
      }

      alert("Đã sắp xếp xong tủ quần áo!");
      // 如果当前还在衣柜界面，刷新一下图片显示
      if (
        document
          .getElementById("kk-wardrobe-screen")
          .classList.contains("active")
      ) {
        renderWardrobeUI();
      }
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng");
    }
  } catch (error) {
    console.error("生成衣柜失败:", error);
    await showCustomAlert("Tạo thất bại", `Lỗi: ${error.message}`);
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}

/**
 * 【新增】添加更多衣服 (追加模式 - 包含新分类 + 逐个生成 + 实时保存)
 */
async function generateMoreWardrobeData() {
  if (!activeKkCharId) return;
  const chat = state.chats[activeKkCharId];

  showGenerationOverlay("Đang đi trung tâm thương mại nhập hàng...");

  try {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) throw new Error("API chưa được cấu hình");

    // 获取现有衣服名称，避免重复
    const existingClothes = (chat.houseData.wardrobe || [])
      .map((i) => i.name)
      .join(", ");

    const prompt = `
        # Nhiệm vụ
Bây giờ bạn là nhân vật "${chat.name}". Hãy 【sắm thêm】 3-5 món đồ mới cho tủ quần áo của bạn. Viết chữ bằng tiếng Việt.

# Thiết lập nhân vật
        ${chat.settings.aiPersona}

# Đồ đã có (đừng trùng lặp)
        ${existingClothes}

# Yêu cầu
1. Gồm các loại khác nhau (có thể là Phụ kiện tóc, Áo, Quần, Giày, Trang sức, Đặc biệt — ghi đúng chính xác tên phân loại).
2. Bắt buộc có "imagePrompt" (tiếng Anh, mô tả ảnh sản phẩm nền trắng) và "charComment" (cảm nghĩ ngôi thứ nhất).

# Định dạng đầu ra JSON
        {
          "new_items": [
{ "category": "Giày", "name": "...", "icon": "...", "description": "...", "imagePrompt": "...", "charComment": "..." }
          ]
        }
        `;

    const messagesForApi = [{ role: "user", content: prompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 0.9,
          }),
        });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();
    const result = JSON.parse(rawContent);

    if (result && result.new_items) {
      // 1. 先把新物品加入到数组并保存文字版
      if (!chat.houseData.wardrobe) chat.houseData.wardrobe = [];

      // 获取当前数组的起始索引，方便后面定位新物品
      const startIndex = chat.houseData.wardrobe.length;

      chat.houseData.wardrobe.push(...result.new_items);
      await db.chats.put(chat); // 保存文字数据

      // 2. --- 逐个生成图片并实时保存 ---
      const total = result.new_items.length;
      const overlayText = document.getElementById("generation-text");

      for (let i = 0; i < total; i++) {
        // 定位到刚刚添加进去的那个物品
        const itemIndex = startIndex + i;
        const item = chat.houseData.wardrobe[itemIndex];

        if (overlayText) {
          overlayText.textContent = `Đang chụp ảnh quần áo mới (${i + 1}/${total}): ${item.name}...`;
        }

        if (item.imagePrompt) {
          try {
            const url = await generateClothingImage(item.imagePrompt);
            item.imageUrl = url; // 更新内存引用
            await db.chats.put(chat); // ★★★ 实时保存 ★★★
          } catch (e) {
            console.error("图片生成失败", e);
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      // 刷新界面
      renderWardrobeUI();
      alert(`Đã thêm thành công ${result.new_items.length} món đồ mới!`);
    }
  } catch (error) {
    console.error("添加衣服失败:", error);
    await showCustomAlert("Thêm thất bại", error.message);
  } finally {
    document.getElementById("generation-overlay").classList.remove("visible");
  }
}

// =======================================================
// 绑定新按钮的事件 (请把这段加在 init() 的事件绑定区域)
// =======================================================
// 绑定“添加衣服”按钮
const addClothBtn = document.getElementById("kk-wardrobe-add-btn");
if (addClothBtn) {
  // 防止重复绑定，先移除旧的
  const newBtn = addClothBtn.cloneNode(true);
  addClothBtn.parentNode.replaceChild(newBtn, addClothBtn);
  newBtn.addEventListener("click", generateMoreWardrobeData);
}
/**
 * 【新增】打开历史搭配记录列表
 */
function openWardrobeHistory() {
  const chat = state.chats[activeKkCharId];
  if (!chat || !chat.houseData || !chat.houseData.wardrobeHistory) {
    showCustomAlert("Chưa có bản ghi", "Chưa phối đồ lần nào cả.");
    return;
  }

  const historyList = chat.houseData.wardrobeHistory;
  const listEl = document.getElementById("kk-file-list"); // 复用文件列表容器
  const modal = document.getElementById("kk-file-explorer-modal"); // 复用通用列表弹窗

  // 修改弹窗标题
  modal.querySelector(".modal-header span").textContent =
    `Nhật ký phối đồ của ${chat.name}`;
  listEl.innerHTML = "";

  if (historyList.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Chưa có bản ghi</p>';
  } else {
    historyList.forEach((entry) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "kk-file-item"; // 复用样式
      itemDiv.style.cssText =
        "cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 10px; border-bottom: 1px solid #eee;";

      // 格式化时间
      const timeStr = new Date(entry.timestamp).toLocaleString();

      itemDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#999;">
                    <span>${timeStr}</span>
                </div>
                <div style="font-weight:bold; color:#333;">${entry.summary}</div>
                <div style="font-size:13px; color:#666; font-style:italic;">“${entry.reaction.substring(0, 30)}${
                  entry.reaction.length > 30 ? "..." : ""
                }”</div>
            `;

      // 点击查看详情
      itemDiv.addEventListener("click", () => {
        showHistoryDetail(entry);
      });

      listEl.appendChild(itemDiv);
    });
  }

  modal.classList.add("visible");
}

/**
 * 【新增】查看某一条历史记录的详情
 */
function showHistoryDetail(entry) {
  // 这里我们复用“物品分享弹窗”来显示详情，简单快捷
  const modal = document.getElementById("kk-item-share-modal");
  const title = document.getElementById("kk-item-share-title");
  const contentDiv = document.getElementById("kk-item-share-content");
  const shareBtn = document.getElementById("kk-item-share-confirm-btn");

  title.textContent = "Chi tiết phối đồ";

  // 构建详情内容
  let detailHtml = `
        <div style="text-align:left; font-size:14px;">
<p><strong>📅 Thời gian:</strong> ${new Date(entry.timestamp).toLocaleString()}</p>
<p><strong>👗 Phương án phối:</strong><br>${entry.summary}</p>
            <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;">
<p><strong>🗣️ Nhận xét lúc đó:</strong><br>"${entry.reaction}"</p>
        </div>
    `;

  // 如果支持innerHTML，可以直接塞进去，如果你的contentDiv只支持text，则需要改一下结构
  // 假设 contentDiv 是个 div，我们先清空再塞 HTML
  contentDiv.innerHTML = detailHtml;

  // 修改按钮功能为“再次穿上” (高级功能，可选)
  const newShareBtn = shareBtn.cloneNode(true);
  shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);

  newShareBtn.textContent = "Chia sẻ/Nhìn lại";
  newShareBtn.onclick = () => {
    shareKkItemToChat(
      "Lịch sử",
      `Đã nhìn lại tạo hình trước đây: ${entry.summary}`,
      `Nhận xét lúc đó: ${entry.reaction}`,
    );
    modal.classList.remove("visible");
  };

  modal.classList.add("visible");
}
