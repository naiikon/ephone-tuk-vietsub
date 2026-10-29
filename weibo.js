// weibo.js

// ===================================================================
// 1. Global variables for Weibo functionality
// ===================================================================
let currentViewingWeiboProfileId = null; // Global variable, records which character's homepage is being viewed
let currentHotTopic = ""; // Used to store the currently viewed hot search topic
let hotTopicFeedCache = {}; // Used to cache generated content
let weiboHotSearchCache = [];
let currentWeiboActionTarget = {}; // Used to store information about the target being operated on

// Variables for user's own DMs
let currentUserDmFanIndex = null; // Used to track which fan's DM is being viewed

// Variables for character DMs
let currentViewingDmsFor = null; // Used to track which character's DMs are being viewed

// ===================================================================
// 2. Weibo Function Definitions
// ===================================================================

/**
 * 【微博】总入口：根据当前激活的视图，渲染对应的微博Feed
 */
async function renderWeiboFeeds(viewId) {
  if (viewId === "weibo-my-profile-view") {
    await renderMyWeiboFeed();
  } else if (viewId === "weibo-following-view") {
    await renderFollowingWeiboFeed();
  }
}
/**
 * 【核心】根据ID和名字解析头像
 * 优先级：用户 -> 角色 -> NPC -> 全局路人库
 */
function resolveWeiboAvatar(id, name) {
  // 1. 如果是用户
  if (id === "user" || name === state.qzoneSettings.nickname) {
    return (
      state.qzoneSettings.weiboAvatar ||
      state.qzoneSettings.avatar ||
      defaultAvatar
    );
  }

  // 2. 如果是已知角色 (Char)
  if (state.chats[id]) {
    return state.chats[id].settings.aiAvatar || defaultAvatar;
  }

  // 3. 尝试通过名字查找是否是已知角色 (兼容临时贴没有ID的情况)
  const foundChar = Object.values(state.chats).find((c) => c.name === name);
  if (foundChar) {
    return foundChar.settings.aiAvatar || defaultAvatar;
  }

  // 4. 尝试查找是否是某个角色的NPC
  for (const chat of Object.values(state.chats)) {
    if (chat.npcLibrary) {
      const foundNpc = chat.npcLibrary.find((n) => n.name === name);
      if (foundNpc) {
        return foundNpc.avatar || defaultGroupMemberAvatar;
      }
    }
  }

  // 5. 【核心】如果是路人，使用全局路人头像库 (根据名字哈希获取，保证同一人头像不变)
  // 确保 window.getAvatarForName 存在 (在你的 main-app.js 底部定义的)
  if (typeof window.getAvatarForName === "function") {
    return window.getAvatarForName(name);
  }

  // 6. 兜底默认
  return "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg";
}

/**
 * 【微博】渲染“我的主页”上的微博列表
 */
async function renderMyWeiboFeed() {
  const feedEl = document.getElementById("my-weibo-feed-list");
  const posts = await db.weiboPosts
    .where("authorId")
    .equals("user")
    .reverse()
    .toArray();
  feedEl.innerHTML = "";
  if (posts.length === 0) {
    feedEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Bạn chưa đăng Weibo nào cả, bấm "+" ở góc trên bên phải thử xem!</p>';
    return;
  }
  posts.forEach((post) => {
    // 【核心修改】调用我们新的专属函数！
    feedEl.appendChild(createWeiboPostElement(post));
  });
}

/**
 * 【微博】渲染“关注的人”的微博Feed (已修复卡顿问题)
 */
async function renderFollowingWeiboFeed() {
  const feedEl = document.getElementById("weibo-following-feed-list");

  // 【核心优化】我们不再一次性读取所有帖子，而是直接让数据库帮我们筛选和排序，速度会快很多！
  const posts = await db.weiboPosts
    .where("authorId")
    .notEqual("user") // 1. 直接在数据库层面，找出作者不是'user'的帖子
    .reverse() // 2. 让结果按倒序排列
    .sortBy("timestamp"); // 3. 根据时间戳排序

  // 后续的渲染逻辑保持不变
  feedEl.innerHTML = "";
  if (posts.length === 0) {
    feedEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Những người bạn theo dõi chưa đăng bài nào cả.</p>';
    return;
  }
  posts.forEach((post) => {
    feedEl.appendChild(createWeiboPostElement(post));
  });
}
/**
 * 【修复】保存微博/动态设置到数据库
 * (修复 ReferenceError: saveQzoneSettings is not defined)
 */
async function saveQzoneSettings() {
  // 确保 db 和 state.qzoneSettings 都存在
  if (typeof db !== "undefined" && state && state.qzoneSettings) {
    await db.qzoneSettings.put(state.qzoneSettings);
  }
}

function createWeiboPostElement(post) {
  const postEl = document.createElement("div");
  postEl.className = "weibo-post-item";

  postEl.dataset.postId = post.id;

  let contentHtml = "";
  if (post.content) {
    contentHtml += `<div class="weibo-post-content">${post.content.replace(/\n/g, "<br>")}</div>`;
  }

  if (post.imageUrl) {
    if (post.postType === "text_image") {
      contentHtml += `<img src="${post.imageUrl}" class="weibo-post-image" style="cursor: pointer;" data-hidden-text="${
        post.hiddenContent || ""
      }">`;
    } else {
      contentHtml += `<img src="${post.imageUrl}" class="weibo-post-image">`;
    }
  }

  let commentsHtml = "";
  if (
    post.comments &&
    Array.isArray(post.comments) &&
    post.comments.length > 0
  ) {
    commentsHtml += '<div class="weibo-comments-container">';
    post.comments.forEach((comment) => {
      if (typeof comment !== "object" || comment === null) return;

      // --- 新增：获取评论者头像 ---
      // 传入 authorId (如果有) 和 authorNickname
      const commentAvatarUrl = resolveWeiboAvatar(
        comment.authorId,
        comment.authorNickname,
      );

      let replyHtml = "";
      if (comment.replyToNickname) {
        replyHtml = `<span class="weibo-comment-reply-tag">trả lời</span><span class="reply-target-name" data-reply-to-name="${comment.replyToNickname}">${comment.replyToNickname}</span>`;
      }

      // --- 修改：HTML结构加入头像 ---
      commentsHtml += `
                <div class="weibo-comment-item" data-comment-id="${comment.commentId}" data-commenter-name="${comment.authorNickname}">
                    <img src="${commentAvatarUrl}" class="weibo-comment-avatar">
                    <div class="weibo-comment-content-wrapper">
                        <span class="weibo-commenter-name">${comment.authorNickname}</span>
                        ${replyHtml}:
                        <span class="weibo-comment-text">${comment.commentText}</span>
                    </div>
<button class="comment-delete-btn" title="Xóa bình luận này">×</button>
                </div>`;
    });
    commentsHtml += "</div>";
  }

  const myNickname =
    state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "Tôi";
  const isLiked = post.likes && post.likes.includes(myNickname);

  let finalAuthorAvatar, finalAuthorNickname, finalAuthorAvatarFrame;
  if (post.authorId === "user") {
    finalAuthorAvatar =
      state.qzoneSettings.weiboAvatar ||
      state.qzoneSettings.avatar ||
      defaultAvatar;
    finalAuthorNickname =
      state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "Tôi";
    finalAuthorAvatarFrame = state.qzoneSettings.weiboAvatarFrame || "";
  } else if (state.chats[post.authorId]) {
    const authorChat = state.chats[post.authorId];
    finalAuthorNickname = authorChat.settings.weiboNickname || authorChat.name;
    finalAuthorAvatar =
      authorChat.settings.weiboAvatar ||
      authorChat.settings.aiAvatar ||
      defaultAvatar;
    finalAuthorAvatarFrame =
      authorChat.settings.weiboAvatarFrame ||
      authorChat.settings.aiAvatarFrame ||
      "";
  } else {
    // --- 修改：如果是路人，使用路人库头像 ---
    finalAuthorNickname = post.authorNickname || "Người dùng không xác định";
    finalAuthorAvatar = resolveWeiboAvatar(post.authorId, finalAuthorNickname); // 使用我们的新函数
    finalAuthorAvatarFrame = "";
  }

  let avatarHtml = "";
  if (finalAuthorAvatarFrame) {
    avatarHtml = `
            <div class="avatar-with-frame">
                <img src="${finalAuthorAvatar}" class="avatar-img weibo-post-avatar">
                <img src="${finalAuthorAvatarFrame}" class="avatar-frame">
            </div>`;
  } else {
    avatarHtml = `<img src="${finalAuthorAvatar}" class="weibo-post-avatar">`;
  }

  const clickableAvatarWrapper = `
        <div class="weibo-post-avatar-clickable" data-char-id="${post.authorId}">
            ${avatarHtml}
        </div>
    `;

  postEl.innerHTML = `
        <div class="weibo-post-header">
            ${clickableAvatarWrapper} 
            <div class="weibo-post-info">
                <span class="weibo-post-nickname">${finalAuthorNickname}</span>
                <span class="weibo-post-timestamp">${formatPostTimestamp(post.timestamp)}</span>
            </div>
            <div class="post-actions-btn" data-post-id="${post.id}" data-author-id="${post.authorId}">…</div>
        </div>
        ${contentHtml}
        <div class="weibo-post-footer">
            <div class="weibo-post-actions">
                <span class="weibo-action-btn like-btn ${isLiked ? "liked" : ""}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${(post.baseLikesCount || 0) + (post.likes || []).length}</span>
                </span>
                <span class="weibo-action-btn comment-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>           
                    <span>${(post.comments || []).length}</span>
                </span>
<span class="weibo-action-btn generate-comments-btn" title="AI tạo bình luận">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                    </svg>
<span>Tạo bình luận</span>
                </span>
            </div>
            ${commentsHtml}
            <div class="weibo-comment-input-area">
<input type="text" class="weibo-comment-input" placeholder="Để lại bình luận thật chất của bạn...">
<button class="weibo-comment-send-btn">Gửi</button>
            </div>
        </div>
    `;

  // 绑定发送评论按钮
  const sendBtn = postEl.querySelector(".weibo-comment-send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const input = postEl.querySelector(".weibo-comment-input");
      handleWeiboComment(post.id, input);
    });
  }

  // 绑定AI生成评论按钮
  const generateBtn = postEl.querySelector(".generate-comments-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", () => generateWeiboComments(post.id));
  }

  // 绑定点赞按钮
  const likeBtn = postEl.querySelector(".like-btn");
  if (likeBtn) {
    likeBtn.addEventListener("click", () => handleWeiboLike(post.id));
  }

  // ★ 修改2：为评论区绑定一个全新的、功能更强大的点击事件监听器
  const commentSection = postEl.querySelector(".weibo-comments-container");
  if (commentSection) {
    commentSection.addEventListener("click", (e) => {
      // 阻止事件冒泡，这是解决点击无效的核心！
      e.stopPropagation();

      const target = e.target;
      const commentItem = target.closest(".weibo-comment-item");
      if (!commentItem) return; // 如果点击的不是评论区，就什么也不做

      const input = postEl.querySelector(".weibo-comment-input");

      // 检查点击的是否是删除按钮
      if (target.closest(".comment-delete-btn")) {
        deleteWeiboComment(post.id, commentItem.dataset.commentId);
        return; // 删除后结束
      }

      let replyToName = "";
      const replyToId = commentItem.dataset.commentId;

      // ★ 修改3：新增逻辑，判断你点击的是谁
      if (target.classList.contains("reply-target-name")) {
        // 如果点击了“被回复者”的名字
        replyToName = target.dataset.replyToName;
      } else {
        // 否则，默认回复这条评论的作者
        replyToName = commentItem.dataset.commenterName;
      }

      // ★ 修改4：优化回复逻辑
      // 如果正在回复同一个人，则取消回复
      if (
        input.dataset.replyToId === replyToId &&
        input.placeholder.includes(`@${replyToName}`)
      ) {
        input.placeholder = "Để lại bình luận thật chất của bạn...";
        delete input.dataset.replyToId;
        delete input.dataset.replyToNickname;
      } else {
        // 否则，设置为新的回复目标
        input.placeholder = `Trả lời @${replyToName}:`;
        input.dataset.replyToId = replyToId;
        input.dataset.replyToNickname = replyToName;
        input.focus();
      }
    });
  }

  return postEl;
}

/**
 * 【微博】打开微博发布/编辑模态框
 */
async function openWeiboPublisher() {
  const modal = document.getElementById("create-post-modal");

  modal.dataset.mode = "weibo"; // 关键！标记为微博模式

  document.getElementById("create-post-modal-title").textContent = "Đăng Weibo";
  document.getElementById("post-public-text").placeholder =
    "Có chuyện gì mới muốn chia sẻ với mọi người không?";

  // 隐藏动态专属的控件
  document.getElementById("post-image-desc-group").style.display = "none";
  document.getElementById("post-comments-toggle-group").style.display = "none";

  document.getElementById("post-mode-switcher").style.display = "flex"; // 微博也需要模式切换

  resetCreatePostModal();
  modal.classList.add("visible");
}

/**
 * 【全新】智能解析带“万”或“亿”的数字字符串
 * @param {string} str - 包含数字的字符串，例如 "30000", "3万", "1.5万"
 * @returns {number} - 解析后的纯数字
 */
function parseChineseNumber(str) {
  if (!str) return 0;
  str = String(str).trim().toLowerCase().replace(/,/g, "");
  let num = parseFloat(str);
  if (str.includes("万") || str.includes("w")) num = num * 10000;
  else if (str.includes("亿")) num = num * 100000000;
  else if (/\d\s*(b|tỷ)/.test(str)) num = num * 1000000000;
  else if (/\d\s*(m|tr)/.test(str)) num = num * 1000000;
  else if (/\d\s*(k|n)/.test(str)) num = num * 1000;
  return isNaN(num) ? 0 : Math.floor(num);
}

/**
 * 【微博 V3 - 粉丝数计算版】处理发布微博的核心函数
 */
async function handlePublishWeibo() {
  const modal = document.getElementById("create-post-modal");

  const mainContent = document.getElementById("post-public-text").value.trim();
  let imageUrl = "",
    hiddenContent = "",
    postType = "text_only",
    imageDescription = "";

  const isImageModeActive = document
    .getElementById("image-mode-content")
    .classList.contains("active");

  if (isImageModeActive) {
    // 【核心修复】我们现在通过检查预览容器是否可见，来判断用户是否真的上传了图片
    const hasImage = document
      .getElementById("post-image-preview-container")
      .classList.contains("visible");

    if (hasImage) {
      imageUrl = document.getElementById("post-image-preview").src;
      postType = "image";
      imageDescription = document
        .getElementById("post-image-description")
        .value.trim();
      // 图片描述的检查逻辑保持不变
      if (!imageDescription) {
        alert("Để AI hiểu được ảnh, nhất định phải điền mô tả ảnh nhé!");
        return;
      }
    }
    // 如果 hasImage 是 false (即用户只想发纯文字)，这段代码就会被跳过，imageUrl 保持为空，postType 保持为 text_only
  } else {
    // 文字图模式的逻辑保持不变
    hiddenContent = document.getElementById("post-hidden-text").value.trim();
    if (hiddenContent) {
      imageUrl = "https://i.postimg.cc/KYr2qRCK/1.jpg";
      postType = "text_image";
    }
  }

  if (!mainContent && !imageUrl) {
    alert("Nội dung Weibo không được để trống nhé!");
    return;
  }

  const fansCount = parseChineseNumber(state.qzoneSettings.weiboFansCount) || 0;
  const baseLikes = Math.floor(fansCount * (Math.random() * 0.1 + 0.1));
  const baseComments = Math.floor(baseLikes * (Math.random() * 0.1 + 0.05));

  const newPost = {
    authorId: "user",
    authorType: "user",
    authorNickname:
      state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "Tôi",
    authorAvatar:
      state.qzoneSettings.weiboAvatar ||
      state.qzoneSettings.avatar ||
      defaultAvatar,
    content: mainContent,
    imageUrl: imageUrl,
    authorAvatarFrame: state.qzoneSettings.weiboAvatarFrame || "",
    imageDescription: imageDescription,
    hiddenContent: hiddenContent,
    postType: postType,
    timestamp: Date.now(),
    likes: [],
    comments: [],
    baseLikesCount: baseLikes,
    baseCommentsCount: baseComments,
  };

  await db.weiboPosts.add(newPost);
  await renderMyWeiboFeed();
  await renderWeiboProfile();

  modal.classList.remove("visible");
  alert("Đăng Weibo thành công!");
}

/**
 * 【微博】处理点赞/取消点赞
 * @param {number} postId - 帖子ID
 */
async function handleWeiboLike(postId) {
  const post = await db.weiboPosts.get(postId);
  if (!post) return;

  const myNickname = state.qzoneSettings.nickname || "Tôi";
  if (!post.likes) post.likes = [];

  const likeIndex = post.likes.indexOf(myNickname);
  if (likeIndex > -1) {
    post.likes.splice(likeIndex, 1); // 取消点赞
  } else {
    post.likes.push(myNickname); // 点赞
  }

  await db.weiboPosts.put(post);
  // 重新渲染两个Feed，确保数据同步
  await renderMyWeiboFeed();
  await renderFollowingWeiboFeed();
}

/**
 * 【微博】处理发布评论或回复
 * @param {number} postId - 帖子ID
 * @param {HTMLInputElement} inputElement - 评论输入框元素
 */
async function handleWeiboComment(postId, inputElement) {
  const commentText = inputElement.value.trim();
  if (!commentText) {
    alert("Nội dung bình luận không được để trống!");
    return;
  }

  const post = await db.weiboPosts.get(postId);
  if (!post) return;

  if (!post.comments) post.comments = [];

  const newComment = {
    commentId: "comment_" + Date.now(),
    authorId: "user",
    authorNickname:
      state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "Tôi",
    commentText: commentText,
    timestamp: Date.now(),
  };

  // 检查是否是回复
  if (inputElement.dataset.replyToId) {
    newComment.replyToId = inputElement.dataset.replyToId;
    newComment.replyToNickname = inputElement.dataset.replyToNickname;
  }

  post.comments.push(newComment);
  await db.weiboPosts.put(post);

  // 清空输入框并重置状态
  inputElement.value = "";
  inputElement.placeholder = "Để lại bình luận thật chất của bạn...";
  delete inputElement.dataset.replyToId;
  delete inputElement.dataset.replyToNickname;

  // 重新渲染两个Feed
  await renderMyWeiboFeed();
  await renderFollowingWeiboFeed();
}

/**
 * 【全新】微博用户人设与职业设置核心功能
 */
function openWeiboUserSettingsModal() {
  const modal = document.getElementById("weibo-user-settings-modal");
  const settings = state.qzoneSettings;

  // 加载当前数据到输入框
  document.getElementById("weibo-user-profession-modal-input").value =
    settings.weiboUserProfession === "Bấm để đặt nghề nghiệp"
      ? ""
      : settings.weiboUserProfession;
  document.getElementById("weibo-user-persona-modal-input").value =
    settings.weiboUserPersona;

  renderWeiboUserPresetSelector(); // 渲染预设下拉框
  modal.classList.add("visible");
}

async function saveWeiboUserSettings() {
  const profession = document
    .getElementById("weibo-user-profession-modal-input")
    .value.trim();
  const persona = document
    .getElementById("weibo-user-persona-modal-input")
    .value.trim();

  state.qzoneSettings.weiboUserProfession = profession || "Bấm để đặt nghề nghiệp";
  state.qzoneSettings.weiboUserPersona = persona || "Một người dùng Weibo bình thường.";

  await saveQzoneSettings(); // 保存到数据库
  await renderWeiboProfile(); // 刷新主页显示
  document
    .getElementById("weibo-user-settings-modal")
    .classList.remove("visible");
  alert("Đã lưu thiết lập Weibo!");
}

function renderWeiboUserPresetSelector() {
  const select = document.getElementById("weibo-user-preset-select");
  const presets = state.qzoneSettings.weiboUserPersonaPresets || [];
  select.innerHTML = '<option value="">-- Chọn preset --</option>';
  presets.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = preset.name;
    select.appendChild(option);
  });
}

function handleWeiboUserPresetSelection() {
  const select = document.getElementById("weibo-user-preset-select");
  const presets = state.qzoneSettings.weiboUserPersonaPresets || [];
  const selectedIndex = select.value;

  if (selectedIndex !== "") {
    const preset = presets[parseInt(selectedIndex)];
    document.getElementById("weibo-user-profession-modal-input").value =
      preset.profession;
    document.getElementById("weibo-user-persona-modal-input").value =
      preset.persona;
  }
}

async function openWeiboUserPresetManager() {
  const choice = await showChoiceModal("Quản lý preset", [
    { text: "💾 Lưu hiện tại thành preset mới", value: "save" },
    { text: "🗑️ Xóa preset đã chọn", value: "delete" },
  ]);

  if (choice === "save") {
    const name = await showCustomPrompt("Lưu preset", "Nhập tên preset");
    if (name && name.trim()) {
      const newPreset = {
        name: name.trim(),
        profession: document
          .getElementById("weibo-user-profession-modal-input")
          .value.trim(),
        persona: document
          .getElementById("weibo-user-persona-modal-input")
          .value.trim(),
      };
      if (!state.qzoneSettings.weiboUserPersonaPresets)
        state.qzoneSettings.weiboUserPersonaPresets = [];
      state.qzoneSettings.weiboUserPersonaPresets.push(newPreset);
      await saveQzoneSettings();
      renderWeiboUserPresetSelector();
      alert(`Đã lưu preset "${name.trim()}"!`);
    }
  } else if (choice === "delete") {
    const select = document.getElementById("weibo-user-preset-select");
    const selectedIndex = select.value;
    if (selectedIndex === "") {
      alert("Vui lòng chọn một preset muốn xóa trong danh sách thả xuống trước.");
      return;
    }
    const presets = state.qzoneSettings.weiboUserPersonaPresets;
    const presetName = presets[parseInt(selectedIndex)].name;
    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa preset "${presetName}"?`,
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      presets.splice(parseInt(selectedIndex), 1);
      await saveQzoneSettings();
      renderWeiboUserPresetSelector();
      alert("Đã xóa preset.");
    }
  }
}

/**
 * 【全新】清空所有已关注角色的微博帖子
 */
async function clearFollowingFeed() {
  // 1. 弹出确认框，防止误操作
  const confirmed = await showCustomConfirm(
    "Xác nhận xóa sạch",
    "Thao tác này sẽ xóa vĩnh viễn mọi Weibo 【không phải do chính bạn đăng】, và không thể khôi phục. Bạn có chắc muốn tiếp tục?",
    { confirmButtonClass: "btn-danger" }, // 红色按钮以示警告
  );

  if (!confirmed) {
    return; // 如果用户取消，则不执行任何操作
  }

  try {
    // 2. 从数据库中找出所有作者不是'user'的帖子
    const postsToDelete = await db.weiboPosts
      .where("authorId")
      .notEqual("user")
      .toArray();
    const idsToDelete = postsToDelete.map((p) => p.id);

    if (idsToDelete.length === 0) {
      alert("Hiện không có bài đăng nào để xóa.");
      return;
    }

    // 3. 批量删除这些帖子
    await db.weiboPosts.bulkDelete(idsToDelete);

    // 4. 重新渲染“关注的人”的Feed，让界面变空
    await renderWeiboFeeds("weibo-following-view");

    alert(`Đã xóa sạch thành công ${idsToDelete.length} bài đăng!`);
  } catch (error) {
    console.error("清空关注动态时出错:", error);
    alert(`Thao tác thất bại: ${error.message}`);
  }
}

/**
 * 【全新】显示微博主页并渲染数据
 */
async function showWeiboScreen() {
  // 1. 计算关注数
  const allSingleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );
  let totalNpcCount = 0;
  allSingleChats.forEach((chat) => {
    if (chat.npcLibrary && chat.npcLibrary.length > 0) {
      totalNpcCount += chat.npcLibrary.length;
    }
  });
  const followingCount = allSingleChats.length + totalNpcCount;

  // 2. 更新页面上的元素
  // 从你的“动态(QZone)”设置里获取头像和昵称，保持统一
  document.getElementById("weibo-avatar-img").src =
    state.qzoneSettings.avatar || defaultAvatar;
  document.getElementById("weibo-nickname").textContent =
    state.qzoneSettings.nickname || "Biệt danh của bạn";
  document.getElementById("weibo-following-count").textContent = followingCount;

  // 3. 显示微博页面
  showScreen("weibo-screen");
}

/**
 * 【微博专属】渲染微博个人主页的所有数据
 */
async function renderWeiboProfile() {
  const settings = state.qzoneSettings || {};
  // 【核心】所有数据都从 weibo... 字段读取！
  document.getElementById("weibo-avatar-img").src = settings.weiboAvatar;
  document.getElementById("weibo-nickname").textContent =
    settings.weiboNickname;
  document.getElementById("weibo-fans-count").textContent =
    settings.weiboFansCount;
  document.getElementById("weibo-background-img").src =
    settings.weiboBackground;

  // 动态计算关注数 (这部分不变)
  const allSingleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );
  let totalNpcCount = 0;
  allSingleChats.forEach((chat) => {
    if (chat.npcLibrary && chat.npcLibrary.length > 0) {
      totalNpcCount += chat.npcLibrary.length;
    }
  });
  document.getElementById("weibo-following-count").textContent =
    allSingleChats.length + totalNpcCount;

  // 动态计算微博数
  const postsCount = await db.weiboPosts
    .where("authorId")
    .equals("user")
    .count();
  document.getElementById("weibo-posts-count").textContent = postsCount;

  const professionEl = document.getElementById("weibo-user-profession-display");
  if (professionEl) {
    professionEl.textContent = settings.weiboUserProfession || "Bấm để đặt nghề nghiệp";
  }

  // --- ▼▼▼ 以下是本次新增的核心代码 ▼▼▼ ---
  // 1. 获取保存的头像框URL
  const frameUrl = settings.weiboAvatarFrame || "";
  // 2. 找到头像框的img元素
  const frameImg = document.getElementById("weibo-avatar-frame");
  if (frameImg) {
    // 3. 如果URL存在，就显示它
    if (frameUrl) {
      frameImg.src = frameUrl;
      frameImg.style.display = "block";
    } else {
      // 4. 如果URL为空（即选择了“无”），就隐藏它
      frameImg.src = "";
      frameImg.style.display = "none";
    }
  }
  // --- ▲▲▲ 新增代码结束 ▲▲▲
}

/**
 * 通用的图片编辑函数 (本地上传或URL)
 * @param {string} title - 弹窗标题
 * @param {string} currentUrl - 当前的图片URL
 * @returns {Promise<string|null>} - 新的图片URL或null
 */
async function getNewImageUrl(title, currentUrl) {
  const choice = await showChoiceModal(title, [
    { text: "📁 Tải lên từ máy", value: "local" },
    { text: "🌐 Dùng URL trên mạng", value: "url" },
  ]);

  if (choice === "local") {
    return await uploadImageLocally();
  } else if (choice === "url") {
    const url = await showCustomPrompt(
      title,
      "Nhập URL ảnh mới",
      currentUrl,
      "url",
    );
    if (url && url.trim().startsWith("http")) {
      return url.trim();
    } else if (url !== null) {
      alert("Vui lòng nhập một URL hợp lệ!");
    }
  }
  return null;
}

/**
 * 【微博专属】编辑微博头像
 */
async function editWeiboAvatar() {
  const newAvatarUrl = await getNewImageUrl(
    "Đổi ảnh đại diện Weibo",
    state.qzoneSettings.weiboAvatar,
  );
  if (newAvatarUrl) {
    state.qzoneSettings.weiboAvatar = newAvatarUrl; // 只修改微博头像
    await saveQzoneSettings();
    await renderWeiboProfile(); // 用专属函数刷新
  }
}

/**
 * 【微博专属】编辑微博背景图
 */
async function editWeiboBackground() {
  const newBgUrl = await getNewImageUrl(
    "Đổi nền Weibo",
    state.qzoneSettings.weiboBackground,
  );
  if (newBgUrl) {
    state.qzoneSettings.weiboBackground = newBgUrl; // 只修改微博背景
    await saveQzoneSettings();
    await renderWeiboProfile();
  }
}

/**
 * 【微博专属】编辑微博昵称
 */
async function editWeiboNickname() {
  const newNickname = await showCustomPrompt(
    "Sửa biệt danh Weibo",
    "Nhập biệt danh mới",
    state.qzoneSettings.weiboNickname,
  );
  if (newNickname !== null) {
    state.qzoneSettings.weiboNickname = newNickname.trim() || "Biệt danh của bạn"; // 只修改微博昵称
    await saveQzoneSettings();
    await renderWeiboProfile();
  }
}

/**
 * 【微博专属】编辑微博粉丝数 (已修复，支持汉字)
 */
async function editWeiboFansCount() {
  // 核心修改：确保这里的第四个参数是 "text"，而不是 "number"
  const newFans = await showCustomPrompt(
    "Sửa số người theo dõi",
    "Nhập số người theo dõi mới",
    state.qzoneSettings.weiboFansCount,
    "text",
  );

  if (newFans !== null) {
    state.qzoneSettings.weiboFansCount = newFans.trim() || "0"; // 只修改微博粉丝数
    await saveQzoneSettings();
    await renderWeiboProfile();
  }
}

/**
 * 【全新】切换微博主界面中的不同页面视图
 * @param {string} viewId - 要切换到的视图的ID
 */
async function switchToWeiboView(viewId) {
  // 1. 隐藏所有微博页面
  document.querySelectorAll(".weibo-view").forEach((view) => {
    view.style.display = "none"; // 使用 style.display 确保隐藏
  });

  // 2. 显示目标页面
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.style.display = "flex"; // 使用 flex 显示
  }

  // 3. 更新底部导航栏的高亮状态
  document.querySelectorAll(".weibo-nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  const targetNavItem = document.querySelector(
    `.weibo-nav-item[data-view="${viewId}"]`,
  );
  if (targetNavItem) {
    targetNavItem.classList.add("active");
  }

  // --- ▼▼▼【核心修复】▼▼▼ ---
  // 4. 根据你点击的页签，去加载并显示对应的微博内容
  if (viewId === "weibo-following-view") {
    // 如果是“关注的人”页，就调用渲染关注列表的函数
    await renderFollowingWeiboFeed();
  } else if (viewId === "weibo-my-profile-view") {
    // 如果是“我的微博”页，就调用渲染“我”的微博的函数
    await renderMyWeiboFeed();
  }
  // --- ▲▲▲【修复结束】▲▲▲ ---
}

function resetCreatePostModal() {
  document.getElementById("post-public-text").value = "";
  document.getElementById("post-image-preview").src = "";
  document.getElementById("post-image-description").value = "";
  document
    .getElementById("post-image-preview-container")
    .classList.remove("visible");
  document.getElementById("post-image-desc-group").style.display = "none";
  document.getElementById("post-local-image-input").value = "";
  document.getElementById("post-hidden-text").value = "";

  // 【核心修复】我们不再模拟点击，而是直接、安全地设置状态
  const imageModeBtn = document.getElementById("switch-to-image-mode");
  const textImageModeBtn = document.getElementById("switch-to-text-image-mode");
  const imageModeContent = document.getElementById("image-mode-content");
  const textImageModeContent = document.getElementById(
    "text-image-mode-content",
  );

  imageModeBtn.classList.add("active");
  textImageModeBtn.classList.remove("active");
  imageModeContent.classList.add("active");
  textImageModeContent.classList.remove("active");
}

function openWeiboPublisherClean() {
  // 1. 重置并获取模态框
  resetCreatePostModal();
  const modal = document.getElementById("create-post-modal");

  // 2. 设置为“微博”模式，并修改标题和提示语
  modal.dataset.mode = "weibo";
  document.getElementById("create-post-modal-title").textContent = "Đăng Weibo";
  document.getElementById("post-public-text").placeholder =
    "Có chuyện gì mới muốn chia sẻ với mọi người không?";

  // 3. 确保所有“动态”专属的HTML元素都被隐藏
  const imageDescGroup = document.getElementById("post-image-desc-group");
  if (imageDescGroup) imageDescGroup.style.display = "none";

  const commentsToggleGroup = document.getElementById(
    "post-comments-toggle-group",
  );
  if (commentsToggleGroup) commentsToggleGroup.style.display = "none";

  const visibilityGroup = document.getElementById("post-visibility-group");
  if (visibilityGroup) visibilityGroup.style.display = "none";

  // 4. 显示微博需要的控件
  const modeSwitcher = document.getElementById("post-mode-switcher");
  if (modeSwitcher) modeSwitcher.style.display = "flex";

  // 5. 显示弹窗
  modal.classList.add("visible");
}

/**
 * 【总入口 V3 - 已支持多角色选择】生成微博热搜列表
 * @param {Array|string} targets - 目标角色ID数组或字符串'all'或'none'
 */
async function generateHotSearch(targets = "all") {
  await showCustomAlert("Vui lòng chờ...", "Đang tạo hot search Weibo...");

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  let publicFiguresContext = "";
  let promptTask =
    "Nhiệm vụ của bạn là dựa vào thông tin \"Nhân vật tham khảo cốt lõi\" bên dưới, thiết kế riêng cho họ một bảng xếp hạng gồm 10 chủ đề hot search.";

  let publicFigures = [];

  // --- 修改点：处理 targets 的逻辑 ---
  if (targets === "all") {
    publicFigures = Object.values(state.chats)
      .filter((chat) => !chat.isGroup)
      .map((chat) => ({
        name: chat.name,
        persona: chat.settings.aiPersona.substring(0, 150) + "...",
      }));
  } else if (targets === "none") {
    // 如果是 none，清空列表
    publicFigures = [];
    promptTask =
      "Nhiệm vụ của bạn là hư cấu một bảng xếp hạng hot search Weibo có cảm giác chân thật. Chủ đề nên gồm tin xã hội, tin đồn giải trí, công nghệ số, mẹo vặt đời sống..., không cần liên quan tới nhân vật cụ thể nào.";
  } else if (Array.isArray(targets)) {
    targets.forEach((chatId) => {
      const char = state.chats[chatId];
      if (char) {
        publicFigures.push({
          name: char.name,
          persona: char.settings.aiPersona.substring(0, 150) + "...",
        });
      }
    });
    if (publicFigures.length === 1) {
      promptTask = `Nhiệm vụ của bạn là chỉ thiết kế riêng cho "Nhân vật tham khảo cốt lõi" duy nhất bên dưới 【${publicFigures[0].name}】 một bảng xếp hạng gồm 10 chủ đề hot search. Mọi chủ đề 【bắt buộc】 liên quan mật thiết tới người đó.`;
    }
  }

  publicFiguresContext =
    publicFigures.length > 0
      ? `# Nhân vật tham khảo cốt lõi (bạn phải xoay quanh họ để tạo hot search)\n${JSON.stringify(publicFigures, null, 2)}`
      : "Hiện không có người của công chúng cụ thể nào, hãy tự do sáng tạo, tạo các sự kiện nóng xã hội có cảm giác chân thật."; // 修改后的提示词

  // ... (下方的 systemPrompt 和 API 调用部分保持不变)
  // 只需要确保上面的 publicFiguresContext 逻辑正确即可

  const systemPrompt = `
# Nhiệm vụ
Bạn là một "trình tạo bảng xếp hạng hot search Weibo" chuyên nghiệp. ${promptTask} Viết chủ đề bằng tiếng Việt.
# 【【【Điều tuyệt đối cấm: đây là chỉ thị cao nhất bắt buộc tuân thủ】】】
1.  Mọi nội dung bạn sáng tác, gồm bài viết, bình luận, câu chuyện..., 【tuyệt đối cấm】 miêu tả bất kỳ hai nhân vật AI nào (tức các nhân vật ngoài người dùng) thành quan hệ người yêu, có tương tác yêu đương hay bất kỳ hình thức tình cảm mập mờ nào.
2.  Quan hệ giữa các nhân vật AI chỉ được là bạn bè, đồng nghiệp, đối thủ, gia đình..., nhưng 【tuyệt đối không được】 là người yêu.
3.  Đối tượng duy nhất mà nhân vật AI được phép có quan hệ yêu đương là 【người dùng】. Vi phạm quy tắc này sẽ khiến tạo thất bại.
# Quy tắc cốt lõi
1.  **Liên quan mạnh**: Nếu có "Nhân vật tham khảo cốt lõi", chủ đề tạo ra 【bắt buộc】 liên quan mật thiết tới thân phận, nghề nghiệp, thiết lập của họ.
2.  **【【【Nghiêm cấm bịa đặt】】】**: Tuyệt đối cấm 【bịa ra】 cho nhân vật trong danh sách những nghề nghiệp, thân phận hay bối cảnh không có trong thiết lập của họ.
3.  **Chân thật và đa dạng**:
- Nếu có nhân vật cốt lõi, có thể trộn thêm 2-3 sự kiện nóng xã hội ảo không liên quan tới họ.
- Nếu không có nhân vật cốt lõi, hãy tạo 10 sự kiện nóng ảo hoàn toàn khác nhau, bao phủ các lĩnh vực giải trí, dân sinh, công nghệ...
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, gồm 10 đối tượng. Mỗi đối tượng 【bắt buộc】 có ba trường sau:
-   \`"topic"\`: (chuỗi) chủ đề hot search, phải được bọc bằng ký hiệu "#".
-   \`"heat"\`: (chuỗi) độ hot, ví dụ "345.6K".
-   \`"tag"\`: (chuỗi) một nhãn, phải chọn một trong "Hot", "Mới", "Đề cử".
${publicFiguresContext}
`;
  // ... (API调用部分代码省略，保持原样) ...
  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: systemPrompt }];
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
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          },
    );
    if (!response.ok)
      throw new Error(
        `Yêu cầu API thất bại: ${response.status} - ${await response.text()}`,
      );
    const data = await response.json();
    const aiResponseContent = isGemini
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error(
        "API trả về nội dung rỗng, có thể bị chính sách an toàn chặn. Hãy kiểm tra Prompt hoặc đổi model.",
      );
    }
    const sanitizedContent = aiResponseContent
      .replace(/^```json\s*|```$/g, "")
      .trim();
    const responseData = JSON.parse(sanitizedContent);
    const hotSearchData = responseData.hot_searches || responseData;
    weiboHotSearchCache = hotSearchData;
    await generatePlazaFeed(hotSearchData, targets);
    renderHotSearchList(hotSearchData);
    await showCustomAlert("Thao tác thành công", "Bảng hot search và quảng trường đều đã tạo xong!");
  } catch (error) {
    console.error("生成热搜失败:", error);
    await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
  }
}

/**
 * 【UI渲染】根据AI返回的数据渲染热搜列表
 */
function renderHotSearchList(hotSearchData) {
  const listEl = document.getElementById("weibo-hot-search-list");
  listEl.innerHTML = "";

  if (!hotSearchData || !Array.isArray(hotSearchData)) {
    listEl.innerHTML =
      '<p style="text-align:center; color: #8a8a8a;">Dữ liệu AI trả về sai định dạng, không thể hiển thị.</p>';
    return;
  }

  hotSearchData.forEach((item, index) => {
    const rank = index + 1;
    const tagClass = { "Hot": "hot", "Mới": "new", "Đề cử": "rec" }[item.tag] || "rec";

    const itemEl = document.createElement("div");
    itemEl.className = "hot-search-item";
    itemEl.dataset.rank = rank;
    itemEl.innerHTML = `
            <span class="hot-search-rank">${rank}</span>
            <div class="hot-search-content">
                <span class="hot-search-topic">${item.topic}</span>
                <span class="hot-search-tag ${tagClass}">${item.tag}</span>
            </div>
            <span class="hot-search-heat" style="color: var(--text-secondary); font-size: 13px;">${item.heat}</span>
        `;
    itemEl.addEventListener("click", () => showHotTopicFeedScreen(item.topic));
    listEl.appendChild(itemEl);
  });
}

/**
 * 【总入口】显示并生成指定热搜话题的微博Feed (已增加缓存功能)
 */
async function showHotTopicFeedScreen(topic) {
  currentHotTopic = topic;
  document.getElementById("weibo-hottopic-title").textContent = topic;
  switchToWeiboView("weibo-hottopic-feed-view");

  // 【核心修改】检查“小本本”里有没有记录
  if (hotTopicFeedCache[topic]) {
    // 如果有，就直接显示，不重新生成
    console.log(`从缓存加载话题: ${topic}`);
    const feedEl = document.getElementById("weibo-hottopic-feed-list");
    renderWeiboFeed(feedEl, hotTopicFeedCache[topic], true);
  } else {
    // 如果没有，才调用函数去生成新的内容
    await generateHotSearchFeed(topic);
  }
}

/**
 * 【AI核心 V2 - 已修复拼写错误 & 增加缓存】调用API为指定话题生成微博Feed
 */
async function generateHotSearchFeed(topic) {
  const feedEl = document.getElementById("weibo-hottopic-feed-list");
  feedEl.innerHTML =
    '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">Đang tạo nội dung, vui lòng chờ...</p>';

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const allChars = Object.values(state.chats)
    .filter((c) => !c.isGroup)
    .map((c) => ({
      name: c.name,
      persona: c.settings.aiPersona.substring(0, 100),
    }));
  const allNpcs = Object.values(state.chats)
    .flatMap((c) => c.npcLibrary || [])
    .map((npc) => ({ name: npc.name, persona: npc.persona.substring(0, 100) }));
  const allPeople = [...allChars, ...allNpcs];

  const systemPrompt = `
# Nhiệm vụ
Bạn là một "trình tạo nội dung Weibo". Nhiệm vụ của bạn là xoay quanh một chủ đề hot search cho trước, tạo một loạt bài Weibo liên quan bằng tiếng Việt.

# Chủ đề hot search hiện tại
**${topic}**
# 【【【Điều tuyệt đối cấm: đây là chỉ thị cao nhất bắt buộc tuân thủ】】】
1.  Mọi nội dung bạn sáng tác, gồm bài viết, bình luận, câu chuyện..., 【tuyệt đối cấm】 miêu tả bất kỳ hai nhân vật AI nào (tức các nhân vật ngoài người dùng) thành quan hệ người yêu, có tương tác yêu đương hay bất kỳ hình thức tình cảm mập mờ nào.
2.  Quan hệ giữa các nhân vật AI chỉ được là bạn bè, đồng nghiệp, đối thủ, gia đình..., nhưng 【tuyệt đối không được】 là người yêu.
3.  Đối tượng duy nhất mà nhân vật AI được phép có quan hệ yêu đương là 【người dùng】. Vi phạm quy tắc này sẽ khiến tạo thất bại.

# Quy tắc cốt lõi
1.  **Số lượng**: tạo 5 đến 10 Weibo.
2.  **Liên quan**: Mọi nội dung Weibo 【bắt buộc】 liên quan mạnh tới chủ đề **"${topic}"**, và 【bắt buộc】 có nhãn chủ đề **${topic}** trong nội dung.
3.  **Độ hot cao**: Các Weibo tạo ra phải trông như nội dung trên hot search, nên "likes" (lượt thích) và "comments" (lượt bình luận) 【bắt buộc】 rất cao. Lượt thích nên trong khoảng 10000 đến 500000, lượt bình luận trong khoảng 800 đến 20000.
4.  **Tạo bình luận**: Tạo 8 đến 10 bình luận người qua đường chân thật cho mỗi Weibo. Nội dung bình luận nên liên quan tới nội dung Weibo, phong cách đa dạng.
5.  **Đa dạng tác giả**: Tác giả Weibo có thể là nhân vật trong "Danh sách nhân vật có sẵn" bên dưới, cũng có thể là người qua đường, KOL hoặc truyền thông chính thống do bạn hư cấu. Nếu để nhân vật trong danh sách phát ngôn, nội dung phải phù hợp thiết lập của họ.
6.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, gồm nhiều đối tượng Weibo. Mỗi đối tượng 【bắt buộc】 có các trường sau:
-   \`"author"\`: (chuỗi) biệt danh tác giả.
-   \`"content"\`: (chuỗi) nội dung Weibo, phải có nhãn chủ đề ${topic}.
-   \`"likes"\`: (số) lượt thích cao ngẫu nhiên trong khoảng 10000 đến 500000.
-   \`"comments"\`: (số) lượt bình luận cao ngẫu nhiên trong khoảng 800 đến 20000.
-   \`"comments_list"\`: (mảng) mảng gồm 8-10 đối tượng bình luận, mỗi đối tượng có định dạng \`{"author": "biệt danh người bình luận", "text": "nội dung bình luận"}\`.

# Danh sách nhân vật có sẵn (bạn có thể để họ phát ngôn)
${JSON.stringify(allPeople, null, 2)}
`;
  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: systemPrompt }];
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
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          },
    );
    if (!response.ok)
      throw new Error(
        `Yêu cầu API thất bại: ${response.status} - ${await response.text()}`,
      );

    const data = await response.json();
    const aiResponseContent = isGemini
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error("API trả về nội dung rỗng, có thể bị chính sách an toàn chặn.");
    }

    const sanitizedContent = aiResponseContent
      .replace(/^```json\s*|```$/g, "")
      .trim();
    const responseData = JSON.parse(sanitizedContent);
    const feedData = responseData.posts || responseData;

    // 【核心修改】将新生成的内容，记在“小本本”上
    hotTopicFeedCache[topic] = feedData;

    renderWeiboFeed(feedEl, feedData, true);
  } catch (error) {
    console.error("生成热搜Feed失败:", error);
    feedEl.innerHTML = `<p style="text-align:center; color: #ff3b30; padding: 20px;">Tạo thất bại: ${error.message}</p>`;
  }
}

/**
 * 【总入口 V3 - 已支持多角色选择】生成微博广场Feed
 * @param {Array} hotTopics - (可选) 从热搜生成函数传过来的话题数组
 * @param {Array|string} targets - (新增) 目标角色ID数组或字符串'all'或'none'
 */
async function generatePlazaFeed(hotTopics = null, targets = "all") {
  if (!hotTopics) {
    await showCustomAlert("Vui lòng chờ...", "Đang tạo bài đăng quảng trường...");
  }
  const feedEl = document.getElementById("weibo-plaza-feed-list");
  feedEl.innerHTML =
    '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">Đang tải nội dung, vui lòng chờ...</p>';

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  let publicFiguresContext = "";
  let taskInstruction =
    "Nhiệm vụ của bạn là mô phỏng một quảng trường mạng xã hội chân thật, tạo 10 bài Weibo do những người qua đường khác nhau đăng.";

  let publicFigures = [];

  // --- 修改点：处理 targets 的逻辑 ---
  if (targets === "all") {
    publicFigures = Object.values(state.chats)
      .filter((chat) => !chat.isGroup)
      .map((chat) => ({
        name: chat.name,
        persona: chat.settings.aiPersona.substring(0, 150) + "...",
        weibo_profession: chat.settings.weiboProfession || "Chưa đặt",
        weibo_instruction: chat.settings.weiboInstruction || "Không",
      }));
  } else if (targets === "none") {
    // 纯随机
    publicFigures = [];
    taskInstruction =
      "Nhiệm vụ của bạn là mô phỏng một quảng trường mạng xã hội chân thật, tạo 10 bài Weibo hoàn toàn do người qua đường, KOL hoặc tài khoản chính thức hư cấu đăng, nội dung không cần liên quan tới nhân vật cụ thể nào.";
  } else if (Array.isArray(targets)) {
    targets.forEach((chatId) => {
      const char = state.chats[chatId];
      if (char) {
        publicFigures.push({
          name: char.name,
          persona: char.settings.aiPersona.substring(0, 150) + "...",
          weibo_profession: char.settings.weiboProfession || "Chưa đặt",
          weibo_instruction: char.settings.weiboInstruction || "Không",
        });
      }
    });
    // 提示词稍微调整
    if (publicFigures.length > 0) {
      taskInstruction = `Nhiệm vụ của bạn là mô phỏng một quảng trường mạng xã hội chân thật, tạo 10 bài Weibo liên quan tới nhân vật ${publicFigures
        .map((p) => `“${p.name}”`)
        .join("、")}, do những người qua đường khác nhau đăng.`;
    }
  }

  publicFiguresContext =
    publicFigures.length > 0
      ? `# Nhân vật tham khảo cốt lõi (nội dung bạn tạo 【bắt buộc】 xoay quanh họ)\n${JSON.stringify(publicFigures, null, 2)}`
      : "";

  // ... (其余部分保持不变) ...
  const topicsContext =
    hotTopics && Array.isArray(hotTopics) && hotTopics.length > 0
      ? `Hãy xoay quanh chủ đề hot sau để tạo nội dung: ${hotTopics.map((t) => t.topic).join("、 ")}`
      : "Hãy tạo ngẫu nhiên vài nội dung thường ngày gần gũi đời sống.";

  const systemPrompt = `
# Nhiệm vụ
Bạn là một "trình tạo nội dung quảng trường Weibo". ${taskInstruction} Viết bằng tiếng Việt.
# 【【【Điều tuyệt đối cấm: đây là chỉ thị cao nhất bắt buộc tuân thủ】】】
1.  Mọi nội dung bạn sáng tác, gồm bài viết, bình luận, câu chuyện..., 【tuyệt đối cấm】 miêu tả bất kỳ hai nhân vật AI nào (tức các nhân vật ngoài người dùng) thành quan hệ người yêu, có tương tác yêu đương hay bất kỳ hình thức tình cảm mập mờ nào.
2.  Quan hệ giữa các nhân vật AI chỉ được là bạn bè, đồng nghiệp, đối thủ, gia đình..., nhưng 【tuyệt đối không được】 là người yêu.
3.  Đối tượng duy nhất mà nhân vật AI được phép có quan hệ yêu đương là 【người dùng】. Vi phạm quy tắc này sẽ khiến tạo thất bại.
# Quy tắc cốt lõi
1.  **Danh tính**: Người đăng bài đều là người bình thường, biệt danh phải đời thường.
2.  **Nội dung**: Nội dung bài viết nên là chuyện thường ngày gần gũi đời sống. ${topicsContext}
3.  **Độ hot**: Lượt thích và bình luận có thể cao có thể thấp, mô phỏng tính ngẫu nhiên của thế giới thật.
4.  **【【【Nghiêm cấm bịa đặt】】】**: Nếu nội dung bạn tạo nhắc tới bất kỳ nhân vật nào trong danh sách "Nhân vật tham khảo cốt lõi" phía trên, bạn 【tuyệt đối cấm】 【bịa ra】 cho họ những nghề nghiệp, thân phận hay bối cảnh không có trong thiết lập. Bạn chỉ được sáng tạo hợp lý dựa trên thiết lập được cung cấp.
5.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, gồm 10 đối tượng Weibo. Định dạng mỗi đối tượng giống hệt định dạng của "Feed hot search" (gồm các trường author, content, likes, comments, comments_list).
- \`"comments_list"\`: (mảng) mảng gồm 2-5 đối tượng bình luận, mỗi đối tượng có định dạng \`{"author": "biệt danh người bình luận", "text": "nội dung bình luận"}\`.
${publicFiguresContext}
`;
  // (后续 API 调用代码保持不变)
  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: systemPrompt }];
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
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          },
    );
    if (!response.ok)
      throw new Error(
        `Yêu cầu API thất bại: ${response.status} - ${await response.text()}`,
      );
    const data = await response.json();
    const aiResponseContent = isGemini
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;
    if (!aiResponseContent) {
      throw new Error("API trả về nội dung rỗng, có thể bị chính sách an toàn chặn.");
    }
    const sanitizedContent = aiResponseContent
      .replace(/^```json\s*|```$/g, "")
      .trim();
    const responseData = JSON.parse(sanitizedContent);
    const feedData = responseData.posts || responseData;
    renderWeiboFeed(feedEl, feedData, false);
    if (!hotTopics) {
      await showCustomAlert("Thao tác thành công", "Đã tạo xong quảng trường!");
    }
  } catch (error) {
    console.error("生成广场Feed失败:", error);
    feedEl.innerHTML = `<p style="text-align:center; color: #ff3b30; padding: 20px;">Tạo thất bại: ${error.message}</p>`;
  }
}

/**
 * 【UI渲染 V3 - 修复评论和头像，并添加删除按钮 + 生成评论功能】通用函数，用于渲染微博Feed列表
 */
function renderWeiboFeed(containerEl, feedData, isHotSearch) {
  containerEl.innerHTML = "";

  if (!feedData || !Array.isArray(feedData)) {
    containerEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Dữ liệu AI trả về sai định dạng, không thể hiển thị.</p>';
    return;
  }

  feedData.forEach((post, index) => {
    const postEl = document.createElement("div");
    postEl.className = "weibo-post-item";
    // 关键：给临时帖子一个特殊的ID前缀，方便后续识别
    postEl.dataset.postId = `temp_${index}`;
    // 将帖子数据暂时存入 DOM 节点，方便 AI 读取上下文
    postEl.dataset.postContent = post.content || "";
    postEl.dataset.postAuthor = post.author || "";

    const finalAvatar = resolveWeiboAvatar(null, post.author);

    let commentsHtml = "";
    if (post.comments_list && post.comments_list.length > 0) {
      commentsHtml += '<div class="weibo-comments-container">';
      post.comments_list.forEach((comment) => {
        const commenterName = comment.author || "Người dùng ẩn danh";
        const commentText = comment.text || "";

        // --- 新增：获取评论者头像 ---
        const commentAvatarUrl = resolveWeiboAvatar(null, commenterName);

        // --- 修改：HTML结构 ---
        commentsHtml += `
                <div class="weibo-comment-item">
                    <img src="${commentAvatarUrl}" class="weibo-comment-avatar">
                    <div class="weibo-comment-content-wrapper">
                        <span class="weibo-commenter-name">${commenterName}:</span>
                        <span class="weibo-comment-text">${commentText}</span>
                    </div>
<button class="comment-delete-btn" title="Xóa bình luận này">×</button>
                </div>`;
      });
      commentsHtml += "</div>";
    }

    postEl.innerHTML = `
            <div class="weibo-post-header">
                <img src="${finalAvatar}" class="weibo-post-avatar">
                <div class="weibo-post-info">
                    <span class="weibo-post-nickname">${post.author}</span>
                    <span class="weibo-post-timestamp">${isHotSearch ? "Nội dung hot search" : "Vừa xong"}</span>
                </div>
<button class="weibo-post-delete-btn" title="Xóa bài đăng này">×</button>
            </div>
            <div class="weibo-post-content">${(post.content || "").replace(/\n/g, "<br>")}</div>
            <div class="weibo-post-footer">
                <div class="weibo-post-actions">
<span class="weibo-action-btn like-btn"> <!-- thêm class like-btn -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span class="like-count">${post.likes || 0}</span>
                    </span>
                    <span class="weibo-action-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        <span>${post.comments || 0}</span>
                    </span>
<!-- mới thêm: nút tạo bình luận -->
<span class="weibo-action-btn generate-comments-btn" title="AI tạo bình luận">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                        </svg>
<span>Tạo bình luận</span>
                    </span>
                </div>
                ${commentsHtml}
<!-- mới thêm: ô nhập bình luận -->
                <div class="weibo-comment-input-area">
<input type="text" class="weibo-comment-input" placeholder="Để lại bình luận thật chất của bạn...">
<button class="weibo-comment-send-btn">Gửi</button>
                </div>
            </div>
        `;
    containerEl.appendChild(postEl);
  });
}
/**
 * 【新增】为临时帖子(热搜/广场)生成AI评论
 */
async function generateCommentsForTempPost(postEl) {
  await showCustomAlert("Vui lòng chờ...", "Đang triệu tập quần chúng hóng biến...");

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  // 从DOM直接读取上下文
  const authorName = postEl.dataset.postAuthor || "Người qua đường";
  const postContent = postEl.dataset.postContent || "Nội dung";
  const commentsContainer =
    postEl.querySelector(".weibo-comments-container") ||
    createCommentsContainer(postEl);

  // 获取现有的评论作为参考
  let existingCommentsText = "";
  postEl.querySelectorAll(".weibo-comment-item").forEach((item) => {
    existingCommentsText += item.textContent.replace("×", "").trim() + "\n";
  });

  const systemPrompt = `
# Nhiệm vụ
Bạn là trình tạo bình luận Weibo. Hãy tạo 3-5 bình luận mới của cư dân mạng cho bài 【hot search/quảng trường】 dưới đây, viết bằng tiếng Việt.

# Nội dung Weibo
- Tác giả: ${authorName}
- Nội dung: ${postContent}
- Bình luận đã có để tham khảo:
${existingCommentsText.substring(0, 300)}

# Quy tắc
1. **Tính chân thật**: Bình luận phải như cư dân mạng thật, có người hóng biến, có người chế meme, có người thảo luận nghiêm túc.
2. **Định dạng**: trả về một mảng JSON, định dạng: \`[{"author": "biệt danh cư dân mạng", "text": "nội dung bình luận"}]\`
3. **Cấm**: đừng trả lời bình luận của người dùng (tôi).
`;

  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: systemPrompt }];
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
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: 0.8,
              response_format: { type: "json_object" },
            }),
          },
    );

    if (!response.ok) throw new Error("Yêu cầu API thất bại");
    const data = await response.json();

    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const jsonStr = rawContent.replace(/^```json\s*|```$/g, "").trim();
    let newComments = [];

    try {
      const parsed = JSON.parse(jsonStr);
      newComments = Array.isArray(parsed)
        ? parsed
        : parsed.comments || parsed.chatResponse || [];
    } catch (e) {
      console.error("JSON解析失败", e);
    }

    if (newComments.length > 0) {
      newComments.forEach((c) => {
        const html = `
                    <div class="weibo-comment-item">
                        <span class="weibo-commenter-name">${c.author}:</span>
                        <span class="weibo-comment-text">${c.text || c.comment}</span>
                        <button class="comment-delete-btn">×</button>
                    </div>`;
        commentsContainer.insertAdjacentHTML("beforeend", html);
      });
      await showCustomAlert("Thành công", `Đã thêm ${newComments.length} bình luận mới!`);
    } else {
      await showCustomAlert("Thông báo", "Lần này AI chẳng nghĩ ra câu nào bá đạo cả.");
    }
  } catch (error) {
    console.error(error);
    await showCustomAlert("Thất bại", error.message);
  }
}

/**
 * 【修改版】处理临时帖子的用户评论（支持回复）
 */
function handleUserCommentForTempPost(postEl, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return alert("Viết gì đó đi!");

  const myName = state.qzoneSettings.weiboNickname || "Tôi";
  const commentsContainer =
    postEl.querySelector(".weibo-comments-container") ||
    createCommentsContainer(postEl);

  // 获取回复目标
  const replyTo = inputEl.dataset.replyTo;

  const myAvatar =
    state.qzoneSettings.weiboAvatar ||
    state.qzoneSettings.avatar ||
    defaultAvatar;

  let html = `<div class="weibo-comment-item">`;

  // --- 新增：插入用户头像 ---
  html += `<img src="${myAvatar}" class="weibo-comment-avatar">`;
  html += `<div class="weibo-comment-content-wrapper">`; // 开启 wrapper

  // 构建名字部分
  html += `<span class="weibo-commenter-name" style="color:#ff8200">${myName}</span>`;

  // 如果是回复
  if (replyTo) {
    html += ` <span style="color:#888; margin:0 2px;">Trả lời</span> <span class="weibo-commenter-name">@${replyTo}</span>`;
  }

  html += `: <span class="weibo-comment-text">${text}</span>`;

  html += `</div>`; // 关闭 wrapper
  html += `<button class="comment-delete-btn">×</button></div>`;

  commentsContainer.insertAdjacentHTML("beforeend", html);

  // 清空输入框和回复状态
  inputEl.value = "";
  inputEl.placeholder = "Để lại bình luận thật chất của bạn...";
  delete inputEl.dataset.replyTo;

  // 更新评论数显示
  const countSpan = postEl.querySelector(
    ".weibo-post-actions span:nth-child(2) span",
  );
  if (countSpan)
    countSpan.textContent = parseInt(countSpan.textContent || 0) + 1;
}

// 辅助：如果帖子没有评论容器，创建一个
function createCommentsContainer(postEl) {
  let container = postEl.querySelector(".weibo-comments-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "weibo-comments-container";
    // 插入到 footer 的 input area 之前
    const footer = postEl.querySelector(".weibo-post-footer");
    const inputArea = postEl.querySelector(".weibo-comment-input-area");
    footer.insertBefore(container, inputArea);
  }
  return container;
}

/**
 * 【全新】删除一条微博评论
 * @param {number} postId - 评论所在的微博ID
 * @param {string} commentId - 要删除的评论的ID
 */
async function deleteWeiboComment(postId, commentId) {
  const post = await db.weiboPosts.get(postId);
  if (!post || !post.comments) return;

  const commentIndex = post.comments.findIndex(
    (c) => c.commentId === commentId,
  );
  if (commentIndex === -1) return;

  const commentText = post.comments[commentIndex].commentText;

  const confirmed = await showCustomConfirm(
    "Xóa bình luận",
    `Bạn có chắc muốn xóa bình luận này?\n\n"${commentText.substring(0, 50)}..."`,
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    post.comments.splice(commentIndex, 1);
    await db.weiboPosts.put(post);
    await renderMyWeiboFeed();
    await renderFollowingWeiboFeed();
    alert("Đã xóa bình luận.");
  }
}

function showFollowingList() {
  const modal = document.getElementById("weibo-following-modal");
  const listContainer = document.getElementById(
    "weibo-following-list-container",
  );
  listContainer.innerHTML = "";

  const allSingleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );

  if (allSingleChats.length === 0) {
    listContainer.innerHTML =
      '<p style="text-align:center; color:grey; padding: 20px;">Chưa theo dõi ai cả</p>';
  } else {
    allSingleChats.forEach((chat) => {
      const charItem = document.createElement("div");
      charItem.className = "weibo-following-item";
      charItem.innerHTML = `
                <img src="${chat.settings.aiAvatar || defaultAvatar}" class="weibo-following-avatar">
                <span class="weibo-following-name">${chat.name}</span>
<button class="view-profile-btn" data-char-id="${chat.id}">Trang cá nhân</button>
<span class="weibo-action-trigger-btn" data-target-id="${chat.id}" data-target-name="${chat.name}" data-is-npc="false" title="Thực hiện thao tác cho người này">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                </span>
            `;
      listContainer.appendChild(charItem);

      if (chat.npcLibrary && chat.npcLibrary.length > 0) {
        chat.npcLibrary.forEach((npc) => {
          const npcItem = document.createElement("div");
          npcItem.className = "weibo-following-item";
          npcItem.style.paddingLeft = "30px";
          npcItem.innerHTML = `
                         <img src="${npc.avatar || defaultGroupMemberAvatar}" class="weibo-following-avatar">
                         <span class="weibo-following-name">${npc.name} (NPC)</span>
<span class="weibo-action-trigger-btn" data-target-id="${npc.id}" data-target-name="${npc.name}" data-is-npc="true" data-owner-id="${chat.id}" title="Thực hiện thao tác cho người này">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                         </span>
                    `;
          listContainer.appendChild(npcItem);
        });
      }
    });
  }

  modal.classList.add("visible");
}

/**
 * 【评论优化版 V3 - 禁止回复用户】AI生成微博评论的核心函数
 * @param {number} postId - 需要生成评论的微博ID
 */
async function generateWeiboComments(postId) {
  const post = await db.weiboPosts.get(postId);
  if (!post) {
    alert("Lỗi: không tìm thấy Weibo này!");
    return;
  }

  await showCustomAlert("Vui lòng chờ...", "Đang triệu tập cư dân mạng chất lượng cao...");

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const userNickname =
    state.qzoneSettings.weiboNickname || state.qzoneSettings.nickname || "Tôi";

  let authorPersona = "Một người dùng bình thường.";
  let authorProfession = "Chưa đặt";
  const authorName =
    post.authorId === "user" ? userNickname : post.authorNickname;

  if (post.authorId === "user") {
    authorPersona =
      state.qzoneSettings.weiboUserPersona || "Một người dùng Weibo bình thường.";
    authorProfession = state.qzoneSettings.weiboUserProfession || "Chưa đặt";
  } else {
    const authorChat = state.chats[post.authorId];
    if (authorChat) {
      authorPersona = authorChat.settings.aiPersona || "Không";
      authorProfession = authorChat.settings.weiboProfession || "Chưa đặt";
    }
  }
  const truncatedPersona = authorPersona.substring(0, 400);
  const postContent = (post.content || "").substring(0, 200);
  const existingComments = (post.comments || [])
    .slice(-5)
    .map((c) => `${c.authorNickname}: ${c.commentText}`)
    .join("\n");

  let imageContext = "";
  if (post.imageUrl && post.imageDescription) {
    imageContext = `
- **Nội dung ảnh**: Weibo này kèm một tấm ảnh, mô tả là: "${post.imageDescription}"`;
  } else if (post.postType === "text_image" && post.hiddenContent) {
    imageContext = `
- **Nội dung ảnh**: Đây là một ảnh chữ, nội dung trên đó là: "${post.hiddenContent}"`;
  }

  const commenterPersonas = new Map();
  commenterPersonas.set(
    authorName,
    `[Nghề nghiệp: ${authorProfession}] [Thiết lập: ${truncatedPersona}]`,
  );

  if (post.comments && post.comments.length > 0) {
    post.comments.forEach((comment) => {
      const commenterName = comment.authorNickname;
      if (!commenterPersonas.has(commenterName)) {
        const commenterChat = Object.values(state.chats).find(
          (c) => c.name === commenterName,
        );
        if (commenterChat && !commenterChat.isGroup) {
          const profession = commenterChat.settings.weiboProfession || "Chưa đặt";
          const persona = (commenterChat.settings.aiPersona || "Không").substring(
            0,
            200,
          );
          commenterPersonas.set(
            commenterName,
            `[Nghề nghiệp: ${profession}] [Thiết lập: ${persona}]`,
          );
        }
      }
    });
  }

  let commenterContext = "";
  if (commenterPersonas.size > 0) {
    commenterContext += "\n# Thiết lập các nhân vật đã có trong khu bình luận (để bạn tham khảo khi trả lời)\n";
    commenterPersonas.forEach((persona, name) => {
      commenterContext += `- **${name}**: ${persona}\n`;
    });
  }

  const systemPrompt = `
# Nhiệm vụ
Bạn là một "trình mô phỏng mạng xã hội" chuyên nghiệp. Nhiệm vụ của bạn là dựa vào "thiết lập" của một nhân vật cụ thể, tạo một loạt bình luận chân thật, hợp tình huống của cư dân mạng cho bài Weibo người đó đăng. Viết bằng tiếng Việt.

# Tình huống Weibo
- **Tác giả**: ${authorName}
- **Chữ của Weibo**: ${postContent || "(Weibo này không có chú thích)"}
${imageContext}
- **Bình luận đã có (bạn có thể trả lời họ)**:
${existingComments || "(Chưa có bình luận)"}

${commenterContext}

# 【【【Quy tắc cốt lõi khi tạo bình luận】】】
1.  **【【【Lệnh cấm trả lời】】】**: Tuyệt đối cấm trả lời bất kỳ bình luận nào có biệt danh "**${userNickname}**". Đây là quy tắc ưu tiên cao nhất, vì người dùng sẽ tự trả lời. Bạn có thể trả lời bình luận của bất kỳ ai khác.
2.  **【【【Nghiêm cấm dùng】】】**: Tuyệt đối cấm dùng các biệt danh kiểu mã số như "Người qua đường A", "Cư dân mạng A", "Fan B" làm tên người bình luận.
3.  **Biệt danh đa dạng**: Biệt danh người bình luận phải thật chân thật, đa dạng và đúng hệ sinh thái mạng xã hội. Ví dụ: "Hôm nay cũng phải ngủ sớm", "Coca thêm đá", "Là bé Vương không phải bé Trương", "Tuyến đầu hóng biến lý trí".
4.  **Nội dung liên quan mạnh tới thiết lập**: Nội dung bình luận phải liên quan mật thiết tới 【nội dung Weibo (gồm chữ và ảnh)】 và 【thiết lập của tác giả cũng như người được trả lời】. Hãy suy nghĩ: kiểu fan nào sẽ theo dõi người như vậy? Họ sẽ nói chuyện thế nào? Khi trả lời một nhân vật có thiết lập cụ thể, câu trả lời của bạn phải cân nhắc thân phận của đối phương.
5.  **Phong cách đa dạng**: Các bình luận tạo ra nên có lập trường và phong cách khác nhau, ví dụ:
-   **Fan**: "Anh đẹp trai quá! Phim mới bao giờ chiếu vậy?"
-   **Người qua đường**: "Chỗ này trông đẹp quá, xin địa chỉ với!"
-   **Anti-fan/người hoài nghi**: "Vậy thôi á? Thấy photoshop hơi lố rồi đó..."
-   **Chế meme**: "Bạn bên trên có phải gián điệp do XX phái tới không (đầu chó)"
6.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một bình luận.
-   Đăng bình luận mới, dùng định dạng: \`{"author": "Tiên nữ không ăn rau mùi", "comment": "Oa, cái này đẹp quá!"}\`
-   Trả lời bình luận đã có, dùng định dạng: \`{"author": "Con nhím thích hóng biến", "comment": "Tôi cũng thấy vậy!", "replyTo": "Tiên nữ không ăn rau mùi"}\`

Bây giờ, hãy bắt đầu màn trình diễn của bạn.
`;

  try {
    let isGemini = proxyUrl === GEMINI_API_URL;
    let messagesForApi = [{ role: "user", content: systemPrompt }];
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Yêu cầu API thất bại: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponseContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();

    const newComments = JSON.parse(aiResponseContent);

    if (Array.isArray(newComments) && newComments.length > 0) {
      const postToUpdate = await db.weiboPosts.get(post.id);
      if (!postToUpdate) throw new Error("Không tìm thấy bài viết cần cập nhật trong cơ sở dữ liệu!");

      if (!postToUpdate.comments) postToUpdate.comments = [];

      newComments.forEach((comment) => {
        if (comment.author && comment.comment) {
          const newCommentObject = {
            commentId: "comment_" + Date.now() + Math.random(),
            authorNickname: comment.author,
            commentText: comment.comment,
            timestamp: Date.now(),
          };
          if (comment.replyTo) {
            newCommentObject.replyToNickname = comment.replyTo;
          }
          postToUpdate.comments.push(newCommentObject);
        }
      });

      postToUpdate.baseLikesCount =
        (postToUpdate.baseLikesCount || 0) +
        Math.floor(Math.random() * newComments.length * 3 + 5);

      await db.weiboPosts.put(postToUpdate);

      await renderMyWeiboFeed();
      await renderFollowingWeiboFeed();

      alert(`Đã tạo thành công ${newComments.length} bình luận mới!`);
    } else {
      alert("AI không tạo được bình luận hợp lệ.");
    }
  } catch (error) {
    console.error("生成微博评论失败:", error);
    await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
  }
}

/**
 * 【全新】打开指定角色的微博主页
 * @param {string} charId - 要查看的角色的ID
 */
async function openWeiboCharProfile(charId) {
  currentViewingWeiboProfileId = charId;
  const chat = state.chats[charId];
  if (!chat) return;

  // 渲染角色主页内容
  await renderWeiboCharProfile(charId);

  // 渲染该角色的微博Feed
  await renderCharSpecificFeed(charId);

  // 切换到角色主页屏幕
  showScreen("weibo-char-profile-screen");

  // 隐藏关注列表弹窗（如果它还开着）
  document.getElementById("weibo-following-modal").classList.remove("visible");
}

/**
 * 【全新】渲染角色微博主页的个人资料部分 (V2 - 支持粉丝/关注数)
 * @param {string} charId - 角色的ID
 */
async function renderWeiboCharProfile(charId) {
  const chat = state.chats[charId];
  if (!chat) return;

  // 渲染基础信息（这部分不变）
  document.getElementById("weibo-char-profile-title").textContent =
    `Trang cá nhân của ${chat.name}`;
  document.getElementById("weibo-char-avatar-img").src =
    chat.settings.weiboAvatar || chat.settings.aiAvatar;
  document.getElementById("weibo-char-nickname").textContent =
    chat.settings.weiboNickname || chat.name;
  document.getElementById("weibo-char-background-img").src =
    chat.settings.weiboBackground;
  document.getElementById("weibo-char-profession-display").textContent =
    chat.settings.weiboProfession || "Chưa đặt nghề nghiệp";

  document.getElementById("weibo-char-following-count").textContent =
    chat.settings.weiboFollowingCount || "0";
  document.getElementById("weibo-char-fans-count").textContent =
    chat.settings.weiboFansCount || "0";

  const postCount = await db.weiboPosts
    .where("authorId")
    .equals(charId)
    .count();
  document.getElementById("weibo-char-posts-count").textContent = postCount;

  const frameImg = document.getElementById("weibo-char-avatar-frame");
  const frameUrl = chat.settings.weiboAvatarFrame || "";
  if (frameUrl) {
    frameImg.src = frameUrl;
    frameImg.style.display = "block";
  } else {
    frameImg.style.display = "none";
  }
}

/**
 * 【全新】渲染指定角色的微博Feed
 * @param {string} charId - 角色的ID
 */
async function renderCharSpecificFeed(charId) {
  const feedEl = document.getElementById("char-weibo-feed-list");
  feedEl.innerHTML = "";

  const posts = await db.weiboPosts
    .where("authorId")
    .equals(charId)
    .reverse()
    .sortBy("timestamp");

  if (posts.length === 0) {
    feedEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary);">Người ấy chưa đăng Weibo nào cả.</p>';
    return;
  }

  posts.forEach((post) => {
    // 复用我们强大的微博帖子创建函数
    feedEl.appendChild(createWeiboPostElement(post));
  });
}

/**
 * 【全新】打开角色微博资料的编辑器
 */
async function openCharWeiboEditor() {
  if (!currentViewingWeiboProfileId) return;
  const chat = state.chats[currentViewingWeiboProfileId];
  if (!chat) return;

  // 填充当前数据到编辑器
  document.getElementById("char-weibo-editor-avatar-preview").src =
    chat.settings.weiboAvatar || chat.settings.aiAvatar;
  document.getElementById("char-weibo-editor-nickname-input").value =
    chat.settings.weiboNickname || chat.name;
  document.getElementById("char-weibo-editor-bg-preview").src =
    chat.settings.weiboBackground;

  // 显示弹窗
  document.getElementById("char-weibo-editor-modal").classList.add("visible");
}

/**
 * 【全新】保存对角色微博资料的修改
 */
async function saveCharWeiboProfile() {
  if (!currentViewingWeiboProfileId) return;
  const chat = state.chats[currentViewingWeiboProfileId];
  if (!chat) return;

  // 从编辑器获取新数据
  chat.settings.weiboAvatar = document.getElementById(
    "char-weibo-editor-avatar-preview",
  ).src;
  chat.settings.weiboNickname = document
    .getElementById("char-weibo-editor-nickname-input")
    .value.trim();
  chat.settings.weiboBackground = document.getElementById(
    "char-weibo-editor-bg-preview",
  ).src;

  // 保存到数据库
  await db.chats.put(chat);

  // 刷新主页显示
  await renderWeiboCharProfile(currentViewingWeiboProfileId);

  document
    .getElementById("char-weibo-editor-modal")
    .classList.remove("visible");
  alert("Đã lưu hồ sơ Weibo của nhân vật!");
}

/**
 * 【全新】根据角色人设和职业，生成初始的微博关注数和粉丝数
 * @param {object} chat - 角色的聊天对象
 * @returns {{following: string, fans: string}}
 */
function getInitialWeiboStats(chat) {
  const persona =
    (chat.settings.aiPersona || "") + (chat.settings.weiboProfession || "");
  const keywords = [
    "thần tượng",
    "ngôi sao",
    "diễn viên",
    "ca sĩ",
    "blogger",
    "hot",
    "youtuber",
    "streamer",
    "tuyển thủ",
    "họa sĩ",
    "nhà văn",
  ];
  const isPublicFigure = keywords.some((keyword) => persona.includes(keyword));

  let fansCount, followingCount;

  if (isPublicFigure) {
    fansCount = Math.floor(100000 + Math.random() * 9900000); // 10万 - 1000万
    followingCount = Math.floor(50 + Math.random() * 450); // 50 - 500
  } else {
    fansCount = Math.floor(100 + Math.random() * 4900); // 100 - 5000
    followingCount = Math.floor(50 + Math.random() * 250); // 50 - 300
  }

  return {
    fans: formatNumberToChinese(fansCount),
    following: formatNumberToChinese(followingCount),
  };
}

/**
 * 【全新】将数字格式化为带“万”或“亿”的字符串
 * @param {number} num - 原始数字
 * @returns {string} - 格式化后的字符串
 */
function formatNumberToChinese(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
}

/**
 * 【全新】显示微博内容生成的目标角色选择器
 * @returns {Promise<object|string|null>} - 返回选中的角色对象, 'all', 或 null (如果用户取消)
 */
async function showCharacterSelectorForWeibo() {
  const singleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );

  if (singleChats.length === 0) {
    alert("Chưa có nhân vật nào để tạo nội dung cả.");
    return null;
  }

  const options = [
    { text: "✨ Ngẫu nhiên (tất cả nhân vật)", value: "all" },
    ...singleChats.map((chat) => ({
      text: `👤 ${chat.name}`,
      value: chat.id,
    })),
  ];

  const selectedId = await showChoiceModal("Hãy chọn nhân vật chính cho lần tạo này", options);

  if (selectedId === null) {
    return null;
  }
  if (selectedId === "all") {
    return "all";
  }

  return state.chats[selectedId];
}
/**
 * 【全新 | V2多选版】显示微博内容生成的目标角色选择器
 * @returns {Promise<Array|string|null>} - 返回选中的角色ID数组, 'all', 'none', 或 null
 */
async function showMultiCharacterSelectorForWeibo() {
  return new Promise((resolve) => {
    const modal = document.getElementById("weibo-char-selector-modal");
    const listEl = document.getElementById("weibo-char-selector-list");
    const confirmBtn = document.getElementById("weibo-confirm-char-select-btn");
    const cancelBtn = document.getElementById("weibo-cancel-char-select-btn");
    const selectAllBtn = document.getElementById("weibo-select-all-btn");
    const deselectAllBtn = document.getElementById("weibo-deselect-all-btn");

    listEl.innerHTML = "";
    const singleChats = Object.values(state.chats).filter(
      (chat) => !chat.isGroup,
    );

    // --- 修改点 1：增加“纯路人/随机”选项 ---
    const noneOption = document.createElement("div");
    noneOption.className = "player-selection-item";
    noneOption.innerHTML = `
            <input type="radio" name="weibo-char-choice" value="none" id="weibo-char-none" style="margin-right: 15px;">
            <label for="weibo-char-none" style="display:flex; align-items:center; width:100%; cursor:pointer;">
<span class="name">🎲 Tạo hoàn toàn ngẫu nhiên (không gồm nhân vật nào)</span>
            </label>
<div style="font-size:12px; color:#888; padding-left:30px; margin-bottom:10px;">Hoàn toàn do AI hư cấu người qua đường, KOL hoặc sự kiện nóng, không liên quan tới kho nhân vật của bạn.</div>
        `;
    listEl.appendChild(noneOption);
    // ------------------------------------

    const randomOption = document.createElement("div");
    randomOption.className = "player-selection-item";
    randomOption.innerHTML = `
            <input type="radio" name="weibo-char-choice" value="all" id="weibo-char-random" checked style="margin-right: 15px;">
            <label for="weibo-char-random" style="display:flex; align-items:center; width:100%; cursor:pointer;">
<span class="name">✨ Chọn ngẫu nhiên (gồm tất cả nhân vật)</span>
            </label>
        `;
    listEl.appendChild(randomOption);

    const specificOptionHeader = document.createElement("div");
    specificOptionHeader.className = "player-selection-item";
    specificOptionHeader.innerHTML = `
            <input type="radio" name="weibo-char-choice" value="specific" id="weibo-char-specific" style="margin-right: 15px;">
            <label for="weibo-char-specific" style="display:flex; align-items:center; width:100%; cursor:pointer;">
<span class="name">👤 Chỉ định các nhân vật sau</span>
            </label>
        `;
    listEl.appendChild(specificOptionHeader);

    if (singleChats.length > 0) {
      singleChats.forEach((chat) => {
        const item = document.createElement("div");
        item.className = "player-selection-item";
        item.style.paddingLeft = "50px";
        item.innerHTML = `
                  <input type="checkbox" class="weibo-char-checkbox" value="${chat.id}" id="weibo-char-${chat.id}">
                  <label for="weibo-char-${
                    chat.id
                  }" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                      <img src="${chat.settings.aiAvatar || defaultAvatar}" alt="${chat.name}">
                      <span class="name">${chat.name}</span>
                  </label>
              `;
        listEl.appendChild(item);
      });
    }

    const cleanup = () => {
      modal.classList.remove("visible");
      newConfirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      selectAllBtn.removeEventListener("click", onSelectAll);
      deselectAllBtn.removeEventListener("click", onDeselectAll);
    };

    const onConfirm = () => {
      const choice = document.querySelector(
        'input[name="weibo-char-choice"]:checked',
      ).value;
      if (choice === "all") {
        cleanup();
        resolve("all");
      } else if (choice === "none") {
        // --- 修改点 2：处理 'none' 返回 ---
        cleanup();
        resolve("none");
      } else {
        const selectedIds = Array.from(
          document.querySelectorAll(".weibo-char-checkbox:checked"),
        ).map((cb) => cb.value);
        if (selectedIds.length === 0) {
          alert("Vui lòng chọn ít nhất một nhân vật được chỉ định!");
          return;
        }
        cleanup();
        resolve(selectedIds);
      }
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    const onSelectAll = () => {
      document.getElementById("weibo-char-specific").checked = true; // 自动选中“指定”
      document
        .querySelectorAll(".weibo-char-checkbox")
        .forEach((cb) => (cb.checked = true));
    };
    const onDeselectAll = () =>
      document
        .querySelectorAll(".weibo-char-checkbox")
        .forEach((cb) => (cb.checked = false));

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    selectAllBtn.addEventListener("click", onSelectAll);
    deselectAllBtn.addEventListener("click", onDeselectAll);

    modal.classList.add("visible");
  });
}

/**
 * 【V2 - AI自主版】打开微博操作模态框
 * @param {object} targetInfo - 包含被操作角色信息的对象
 */
function openWeiboActionModal(targetInfo) {
  currentWeiboActionTarget = targetInfo; // 保存目标信息
  const modal = document.getElementById("weibo-action-modal");

  document.getElementById("weibo-action-modal-title").textContent =
    `Kích hoạt hành động cho "${targetInfo.name}"`;

  const actorSelectGroup = document.getElementById(
    "weibo-action-actor-select",
  ).parentElement;
  if (actorSelectGroup) {
    actorSelectGroup.style.display = "none";
  }

  document.getElementById("weibo-action-prompt-input").value = "";
  document.querySelector(
    'input[name="weibo_action_type"][value="post"]',
  ).checked = true;

  modal.classList.add("visible");
}

/**
 * 【AI核心 V2.2 - 评论用户微博版 + 500错误最终修复】执行AI操作（发微博/评论）
 */
async function handleWeiboAiAction() {
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  document.getElementById("weibo-action-modal").classList.remove("visible");
  document.getElementById("weibo-following-modal").classList.remove("visible");
  await showCustomAlert("Vui lòng chờ...", "Đang yêu cầu AI tạo nội dung, vui lòng kiên nhẫn chờ...");

  const actionType = document.querySelector(
    'input[name="weibo_action_type"]:checked',
  ).value;
  const userInputPrompt = document
    .getElementById("weibo-action-prompt-input")
    .value.trim();

  let target = {
    id: currentWeiboActionTarget.id,
    name: currentWeiboActionTarget.name,
    persona: "Một người dùng Weibo bình thường.",
    profession: "",
    instruction: "",
  };

  if (currentWeiboActionTarget.isNpc) {
    const owner = state.chats[currentWeiboActionTarget.ownerId];
    const npc = owner.npcLibrary.find(
      (n) => n.id === currentWeiboActionTarget.id,
    );
    if (npc) {
      target.persona = npc.persona;
      target.profession = owner.settings.weiboProfession || "";
      target.instruction = owner.settings.weiboInstruction || "";
    }
  } else {
    const char = state.chats[currentWeiboActionTarget.id];
    if (char) {
      target.persona = char.settings.aiPersona;
      target.profession = char.settings.weiboProfession || "";
      target.instruction = char.settings.weiboInstruction || "";
    }
  }

  let systemPrompt = "";
  let messagesForApi = [];

  try {
    if (actionType === "post") {
      systemPrompt = `
# Nhiệm vụ: Nhập vai và sáng tác Weibo
Bây giờ bạn 【chính là】 nhân vật "${target.name}".
Nhiệm vụ của bạn là dựa vào thông tin thân phận của mình, sáng tác một bài Weibo hoàn toàn mới bằng tiếng Việt.
# Thông tin thân phận của bạn
- **Tên của bạn**: ${target.name}
- **Nghề nghiệp của bạn**: ${target.profession || "Chưa đặt"}
- **Thiết lập của bạn**: ${target.persona}
- **Chỉ thị Weibo của bạn (phải tuân thủ)**: ${target.instruction || "Không"}
- **Gợi ý người dùng đưa cho bạn (tham khảo tùy chọn)**: ${userInputPrompt || "Không"}
# 【【【Quy tắc cốt lõi khi tạo bình luận】】】
1.  **【【【Nghiêm cấm dùng】】】**: Tuyệt đối cấm dùng các biệt danh kiểu mã số như "Người qua đường A", "Cư dân mạng A", "Fan B" làm tên người bình luận.
2.  **Biệt danh đa dạng**: Biệt danh người bình luận phải thật chân thật, đa dạng và đúng hệ sinh thái mạng xã hội. Ví dụ: "Hôm nay cũng phải ngủ sớm", "Coca thêm đá", "Là bé Vương không phải bé Trương", "Tuyến đầu hóng biến lý trí".
3.  **Nội dung liên quan mạnh tới thiết lập**: Nội dung bình luận phải liên quan mật thiết tới 【nội dung Weibo bạn sắp sáng tác】 và 【thiết lập của chính bạn】.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
\`{"content": "nội dung Weibo...", "baseLikesCount": số lượt thích tạo ngẫu nhiên, "baseCommentsCount": số bình luận tạo ngẫu nhiên, "comments": "Hôm nay cũng phải ngủ sớm: bình luận 1...\\nCoca thêm đá: bình luận 2..."}\`
- Lượt thích và bình luận phải phù hợp thân phận địa vị của bạn.
- Trường "comments" là một 【chuỗi】, trong đó có 5-10 bình luận người qua đường chân thật, mỗi bình luận ngăn cách bằng ký tự xuống dòng '\\n'.
`;
      messagesForApi.push({ role: "user", content: systemPrompt });
    } else {
      let targetPost;
      let taskDescription;
      let extraContext = "";

      if (actionType === "comment_plaza") {
        targetPost = await db.weiboPosts.orderBy("timestamp").last();
        if (!targetPost) throw new Error("Quảng trường chưa có Weibo nào để bình luận!");
        taskDescription = `Nhiệm vụ của bạn là dựa vào thông tin thân phận của mình, đi bình luận bài 【Weibo quảng trường】 mới nhất dưới đây.`;
      } else if (actionType === "comment_user") {
        targetPost = await db.weiboPosts
          .where("authorId")
          .equals("user")
          .reverse()
          .first();
        if (!targetPost) throw new Error("Người dùng chưa đăng Weibo nào, không thể bình luận!");
        taskDescription = `Nhiệm vụ của bạn là dựa vào thông tin thân phận của mình, đi bình luận bài Weibo mới nhất do 【người dùng】 đăng dưới đây.`;
      }

      let postAuthorName = targetPost.authorNickname;
      if (postAuthorName === "{{user}}") {
        postAuthorName = "Tôi";
      }

      systemPrompt = `
# Nhiệm vụ: Nhập vai và bình luận Weibo
Bây giờ bạn 【chính là】 nhân vật "${target.name}".
${taskDescription}
# Thông tin thân phận của bạn
- **Tên của bạn**: ${target.name}
- **Nghề nghiệp của bạn**: ${target.profession || "Chưa đặt"}
- **Thiết lập của bạn**: ${target.persona}
- **Chỉ thị Weibo của bạn (phải tuân thủ)**: ${target.instruction || "Không"}
- **Gợi ý người dùng đưa cho bạn (tham khảo tùy chọn)**: ${userInputPrompt || "Không"}
# Weibo được bình luận
- Tác giả: ${postAuthorName}
- Nội dung: ${targetPost.content}
${extraContext}
# Quy tắc cốt lõi
1. **Nhập vai sâu**: Bình luận của bạn 【bắt buộc】 phù hợp hoàn toàn với nghề nghiệp, thiết lập và chỉ thị Weibo của bạn. Viết bằng tiếng Việt.
2. **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau:
\`{"commentText": "nội dung bình luận của bạn..."}\`
`;
      messagesForApi.push({ role: "user", content: systemPrompt });
    }

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
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            }),
          },
    );

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = "Không đọc được nội dung phản hồi lỗi.";
      }
      throw new Error(`Yêu cầu API thất bại: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(
        `API trả về lỗi: ${data.error.message || JSON.stringify(data.error)}`,
      );
    }
    const aiResponseContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();

    const result = JSON.parse(aiResponseContent);

    if (actionType === "post") {
      const newPost = {
        authorId: target.id,
        authorType: currentWeiboActionTarget.isNpc ? "npc" : "char",
        authorNickname: target.name,
        authorAvatar: currentWeiboActionTarget.isNpc
          ? state.chats[currentWeiboActionTarget.ownerId].npcLibrary.find(
              (n) => n.id === target.id,
            ).avatar || defaultGroupMemberAvatar
          : state.chats[target.id].settings.aiAvatar || defaultAvatar,
        content: result.content,
        timestamp: Date.now(),
        likes: [],
        comments: [],
        baseLikesCount: result.baseLikesCount || 0,
        baseCommentsCount: result.baseCommentsCount || 0,
      };
      if (result.comments) {
        newPost.comments = result.comments
          .split("\n")
          .map((c) => {
            const parts = c.split(/[:：]/);
            const commenter = parts.shift() || "Người qua đường";
            const commentText = parts.join(":").trim();
            return {
              commentId: "comment_" + Date.now() + Math.random(),
              authorNickname: commenter,
              commentText: commentText,
            };
          })
          .filter((c) => c.commentText);
      }
      await db.weiboPosts.add(newPost);
    } else {
      let postToUpdate;
      if (actionType === "comment_plaza") {
        postToUpdate = await db.weiboPosts.orderBy("timestamp").last();
      } else {
        postToUpdate = await db.weiboPosts
          .where("authorId")
          .equals("user")
          .reverse()
          .first();
      }

      if (postToUpdate) {
        if (!postToUpdate.comments) postToUpdate.comments = [];
        postToUpdate.comments.push({
          commentId: "comment_" + Date.now(),
          authorId: target.id,
          authorNickname: target.name,
          commentText: result.commentText,
          timestamp: Date.now(),
        });
        await db.weiboPosts.put(postToUpdate);
      }
    }

    await renderMyWeiboFeed();
    await renderFollowingWeiboFeed();
    await showCustomAlert("Thao tác thành công", `"${target.name}" đã thực hiện thao tác thành công!`);
  } catch (error) {
    console.error("微博AI操作失败:", error);
    await showCustomAlert("Thao tác thất bại", `Đã xảy ra lỗi:\n${error.message}`);
  }
}

/**
 * 【总入口】打开User的私信列表
 */
async function openUserDmListScreen() {
  const settings = state.qzoneSettings || {};
  // 如果还没有生成过私信，就先让AI生成
  if (!settings.userDms || settings.userDms.length === 0) {
    await generateUserDms();
  } else {
    // 如果已经有了，就直接渲染
    renderUserDmList(settings.userDms);
  }
  showScreen("user-dm-list-screen");
}

/**
 * 【AI核心 V4 - 已增加初始粉丝数量】调用AI为User生成一批粉丝私信
 */
async function generateUserDms(isAddingMore = false) {
  const settings = state.qzoneSettings;
  const { proxyUrl, apiKey, model } = state.apiConfig;

  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  if (!isAddingMore && settings.userDms && settings.userDms.length > 0) {
    const confirmed = await showCustomConfirm(
      "Tạo lại",
      "Đã có lịch sử tin nhắn riêng. Tạo lại sẽ ghi đè toàn bộ tin nhắn riêng hiện có, bạn chắc chứ?",
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (!confirmed) return;
  }

  const alertMessage = isAddingMore
    ? "Đang triệu tập fan mới..."
    : "AI đang mô phỏng tin nhắn riêng của fan cho bạn...";
  await showCustomAlert("Vui lòng chờ...", alertMessage);

  const userPersona = `
# Thông tin người dùng (đây là đối tượng nhận tin nhắn riêng của bạn, hãy đọc kỹ)
- Biệt danh Weibo của bạn: ${settings.weiboNickname || settings.nickname}
- Nghề nghiệp Weibo của bạn: ${settings.weiboUserProfession || "Chưa đặt"}
- Thiết lập ẩn của bạn (fan không thấy, nhưng sẽ ảnh hưởng thái độ của họ với bạn): ${settings.weiboUserPersona || "Một người dùng Weibo bình thường."}
`;

  const existingDmsContext =
    isAddingMore && settings.userDms
      ? `# Tin nhắn riêng đã có (để bạn tham khảo, hãy tạo cuộc trò chuyện hoàn toàn mới)\n${JSON.stringify(settings.userDms.slice(-5))}`
      : "";

  const systemPrompt = `
# Nhiệm vụ
Bạn là một "trình mô phỏng hệ sinh thái Weibo" chuyên nghiệp. Nhiệm vụ của bạn là dựa vào thiết lập Weibo của người dùng, hư cấu một danh sách tin nhắn riêng gồm ${isAddingMore ? "3-4" : "5-8"} fan/người qua đường khác nhau, và sáng tác cho mỗi fan một đoạn tin nhắn riêng 【họ gửi một chiều cho người dùng】, viết bằng tiếng Việt.
${userPersona}
${existingDmsContext}

# Quy tắc cốt lõi
1.  **Đa dạng fan**: Sáng tác ${isAddingMore ? "3-4" : "5-8"} fan thuộc các kiểu khác nhau. Nội dung và giọng điệu tin nhắn riêng của họ 【bắt buộc】 liên quan mật thiết tới thân phận của họ và 【thiết lập Weibo của người dùng】.
2.  **【【【Quy tắc sắt về hội thoại một chiều】】】**: Cuộc trò chuyện bạn tạo 【chỉ được gồm tin nhắn fan gửi cho người dùng】. Tuyệt đối đừng mô phỏng câu trả lời của người dùng.
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, bắt đầu trực tiếp bằng '[' và kết thúc bằng ']'.
4.  **Ảnh đại diện ngẫu nhiên**: Chọn ngẫu nhiên cho mỗi fan một URL từ kho ảnh đại diện bên dưới.

# Cấu trúc đối tượng JSON (quan trọng: trong mảng messages chỉ được có đối tượng có sender là "fan"!)
{
"fanName": "biệt danh Weibo của fan",
"fanPersona": "mô tả ngắn về fan này (ví dụ: 'một fan mẹ lo lắng cho sự nghiệp của anh')",
"fanAvatarUrl": "URL được chọn từ kho ảnh đại diện",
  "messages": [
{ "sender": "fan", "text": "đây là tin nhắn đầu tiên fan gửi..." },
{ "sender": "fan", "text": "đây là tin nhắn thứ hai fan gửi ngay sau đó, vì chưa nhận được trả lời..." }
  ]
}

# Kho ảnh đại diện (fanAvatarUrl bắt buộc chọn một trong các link sau)
- https://i.postimg.cc/PxZrFFFL/o-o-1.jpg
- https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png
Bây giờ, hãy bắt đầu tạo danh sách tin nhắn riêng 【chỉ có fan phát ngôn】.`;
  try {
    const messagesForApi = [{ role: "user", content: systemPrompt }];
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newDmsData = JSON.parse(cleanedContent);

    if (Array.isArray(newDmsData)) {
      newDmsData.forEach((convo, index) => {
        if (!convo.fanAvatarUrl) {
          const fanAvatars = [
            "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg",
            "https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png",
          ];
          convo.fanAvatarUrl = fanAvatars[index % fanAvatars.length];
        }
      });

      if (isAddingMore) {
        if (!settings.userDms) settings.userDms = [];
        settings.userDms.push(...newDmsData);
      } else {
        settings.userDms = newDmsData;
      }
      await saveQzoneSettings();
      renderUserDmList(settings.userDms);

      await showCustomAlert(
        "Tạo thành công",
        `${isAddingMore ? "Đã thêm tin nhắn riêng mới!" : "Đã tạo tin nhắn riêng của fan!"}`,
      );
    } else {
      throw new Error("Dữ liệu AI trả về không phải một mảng hợp lệ.");
    }
  } catch (error) {
    console.error("生成User私信失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 【已增强】处理用户点击“触发AI回应”按钮
 */
async function handleTriggerUserDmAiReply() {
  if (currentUserDmFanIndex === null) return;

  const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];
  if (!convo) return;

  const inputEl = document.getElementById("user-dm-input");
  inputEl.placeholder = "Đang chờ đối phương trả lời...";
  inputEl.disabled = true;

  const aiResponse = await triggerUserDmAiReply(convo);
  if (aiResponse && aiResponse.length > 0) {
    convo.messages.push(...aiResponse);
    await saveQzoneSettings();
    renderUserDmDetail(convo);
    renderUserDmList(state.qzoneSettings.userDms);
  }

  inputEl.placeholder = "Nói gì đó với fan...";
  inputEl.disabled = false;
  inputEl.focus();
}

/**
 * 【已增强】处理用户点击“重Roll”按钮
 */
async function handleUserDmReroll() {
  if (currentUserDmFanIndex === null) return;

  const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];
  if (!convo || convo.messages.length === 0) return;

  let lastMessageIndex = convo.messages.length - 1;

  while (
    lastMessageIndex >= 0 &&
    convo.messages[lastMessageIndex].sender === "char"
  ) {
    lastMessageIndex--;
  }

  if (
    lastMessageIndex < 0 ||
    convo.messages[lastMessageIndex].sender !== "fan"
  ) {
    alert("Chỉ có thể dùng chức năng Roll lại cho câu trả lời mới nhất của fan thôi.");
    return;
  }

  convo.messages.splice(lastMessageIndex);

  renderUserDmDetail(convo);

  const inputEl = document.getElementById("user-dm-input");
  inputEl.placeholder = "Đang tạo lại câu trả lời...";
  inputEl.disabled = true;

  const aiResponse = await triggerUserDmAiReply(convo);
  if (aiResponse && aiResponse.length > 0) {
    convo.messages.push(...aiResponse);
    renderUserDmDetail(convo);
  }

  await saveQzoneSettings();
  renderUserDmList(state.qzoneSettings.userDms);

  inputEl.placeholder = "Nói gì đó với fan...";
  inputEl.disabled = false;
  inputEl.focus();
}

/**
 * 【V2-已添加左滑删除】渲染User的私信列表
 */
function renderUserDmList(dmsData) {
  const listEl = document.getElementById("user-dm-list-container");
  listEl.innerHTML = "";

  if (!dmsData || dmsData.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa nhận được tin nhắn riêng nào</p>';
    return;
  }

  dmsData.forEach((convo, index) => {
    const lastMsg = convo.messages[convo.messages.length - 1];

    const swipeContainer = document.createElement("div");
    swipeContainer.className = "user-dm-list-item-swipe-container";

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "user-dm-list-item-content";
    contentWrapper.innerHTML = `
            <div class="dm-list-item" data-fan-index="${index}">
                <img src="${convo.fanAvatarUrl}" class="dm-avatar">
                <div class="dm-info">
                    <div class="dm-name-line">
                        <span class="dm-name">${convo.fanName}</span>
                        <span class="dm-persona-tag">${convo.fanPersona}</span>
                    </div>
                    <div class="dm-last-msg">${lastMsg.sender === "char" ? "Bạn: " : ""}${lastMsg.text}</div>
                </div>
            </div>
        `;

    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "user-dm-swipe-actions";
    actionsWrapper.innerHTML = `<button class="swipe-action-btn delete" data-fan-index="${index}">Xóa</button>`;

    swipeContainer.appendChild(contentWrapper);
    swipeContainer.appendChild(actionsWrapper);
    listEl.appendChild(swipeContainer);
  });
}
/**
 * 【全新】处理删除单条用户私信的逻辑
 */
async function handleDeleteUserDmMessage(fanIndex, messageIndex) {
  if (fanIndex === null || messageIndex === null) return;

  const settings = state.qzoneSettings;
  const conversation = settings.userDms[fanIndex];
  if (!conversation) return;

  const messageText = conversation.messages[messageIndex].text.substring(0, 30);
  const confirmed = await showCustomConfirm(
    "Xóa tin nhắn riêng",
    `Bạn có chắc muốn xóa tin nhắn riêng này?\n\n"${messageText}..."`,
    {
      confirmButtonClass: "btn-danger",
    },
  );

  if (confirmed) {
    conversation.messages.splice(messageIndex, 1);

    if (conversation.messages.length === 0) {
      settings.userDms.splice(fanIndex, 1);
      await saveQzoneSettings();
      renderUserDmList(settings.userDms);
      showScreen("user-dm-list-screen");
    } else {
      await saveQzoneSettings();
      renderUserDmDetail(conversation);
    }
    alert("Đã xóa tin nhắn riêng.");
  }
}

/**
 * 【全新】处理删除整个用户私信对话的逻辑
 */
async function handleDeleteUserDmConversation(fanIndex) {
  const settings = state.qzoneSettings;
  const conversation = settings.userDms[fanIndex];
  if (!conversation) return;

  const confirmed = await showCustomConfirm(
    "Xóa cuộc trò chuyện",
    `Bạn có chắc muốn xóa toàn bộ cuộc trò chuyện với "${conversation.fanName}"?`,
    {
      confirmButtonClass: "btn-danger",
    },
  );
  if (confirmed) {
    settings.userDms.splice(fanIndex, 1);
    await saveQzoneSettings();
    renderUserDmList(settings.userDms);
    alert("Đã xóa cuộc trò chuyện.");
  } else {
    const swipedContent = document.querySelector(
      `.user-dm-list-item-content.swiped`,
    );
    if (swipedContent) swipedContent.classList.remove("swiped");
  }
}

/**
 * 打开与某个粉丝的私信详情页
 */
function openUserDmDetail(fanIndex) {
  currentUserDmFanIndex = fanIndex;
  const convo = state.qzoneSettings.userDms[fanIndex];
  if (!convo) return;

  renderUserDmDetail(convo);
  showScreen("user-dm-detail-screen");
}

/**
 * 【V2-已添加删除按钮】渲染私信详情页的具体内容
 */
function renderUserDmDetail(conversation) {
  const messagesEl = document.getElementById("user-dm-messages-container");
  const titleEl = document.getElementById("user-dm-detail-title");
  messagesEl.innerHTML = "";
  titleEl.textContent = conversation.fanName;

  const userAvatar = state.qzoneSettings.avatar || defaultAvatar;

  conversation.messages.forEach((msg, index) => {
    const isFan = msg.sender === "fan";
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${isFan ? "fan" : "user-self"}`;

    const bubble = document.createElement("div");
    bubble.className = `message-bubble`;

    const avatarHtml = `<img src="${isFan ? conversation.fanAvatarUrl : userAvatar}" class="avatar">`;
    const contentHtml = `<div class="content">${msg.text.replace(/\n/g, "<br>")}</div>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "user-dm-message-delete-btn";
    deleteBtn.dataset.messageIndex = index;
    deleteBtn.title = "Xóa";
    deleteBtn.innerHTML = "×";

    bubble.innerHTML = `${avatarHtml}${contentHtml}`;

    wrapper.appendChild(bubble);
    wrapper.appendChild(deleteBtn);

    messagesEl.appendChild(wrapper);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * 【已修复】处理用户在私信详情页发送消息 (仅发送，不触发AI)
 */
async function handleSendUserDm() {
  const inputEl = document.getElementById("user-dm-input");
  const messageText = inputEl.value.trim();
  if (!messageText || currentUserDmFanIndex === null) return;

  const convo = state.qzoneSettings.userDms[currentUserDmFanIndex];

  const newMessage = { sender: "char", text: messageText };

  convo.messages.push(newMessage);

  inputEl.value = "";
  inputEl.style.height = "auto";

  renderUserDmDetail(convo);
  renderUserDmList(state.qzoneSettings.userDms);

  await saveQzoneSettings();

  inputEl.focus();
}

/**
 * 【AI回复核心 V2 - 已增强回复丰富度】调用AI生成粉丝的回复 (可以生成多条)
 */
async function triggerUserDmAiReply(conversation) {
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    console.error("API配置不完整");
    return null;
  }

  const settings = state.qzoneSettings;

  const systemPrompt = `
# Nhiệm vụ nhập vai
Bạn sẽ đóng vai một fan đang nhắn tin riêng với thần tượng hoặc blogger. Viết bằng tiếng Việt.

# Thiết lập fan của bạn
- Biệt danh của bạn: "${conversation.fanName}"
- Tính cách và bối cảnh của bạn: "${conversation.fanPersona}"

# Thông tin blogger (bạn đang chat với người này)
- Biệt danh Weibo: ${settings.weiboNickname || settings.nickname}
- Nghề nghiệp Weibo: ${settings.weiboUserProfession || "Chưa đặt"}
- Thiết lập ẩn của blogger: ${settings.weiboUserPersona || "Một người dùng Weibo bình thường."}

# Lịch sử hội thoại (5 tin gần nhất)
${conversation.messages
  .slice(-5)
  .map(
    (m) => `- ${m.sender === "fan" ? conversation.fanName : "Tôi"}: ${m.text}`,
  )
  .join("\n")}

# Nhiệm vụ của bạn
Dựa vào thiết lập và lịch sử hội thoại trên, tạo câu trả lời tiếp theo của bạn.

# Quy tắc trả lời
1.  **Nhập vai sâu**: Câu trả lời của bạn phải 【cực kỳ phù hợp】 thiết lập fan. Giọng điệu, cách dùng từ, cảm xúc đều phải chuẩn.
2.  **Nội dung phong phú**: Đừng chỉ trả lời một câu. Câu trả lời nên có cảm xúc (phấn khích, thất vọng, tò mò...), suy nghĩ, hoặc đặt câu hỏi mới cho blogger để đẩy cuộc trò chuyện.
3.  **【【【Quy tắc sắt về định dạng】】】**: Câu trả lời của bạn phải là một 【mảng JSON】, kể cả khi chỉ có một tin. Mảng này có thể gồm 3 đến 8 đối tượng tin nhắn, mô phỏng cảnh nhắn liên tục khi chat thật.
4.  **Cấu trúc đối tượng**: Mỗi đối tượng trong mảng đều phải là {"sender": "fan", "text": "nội dung một tin trả lời của bạn"}.

Bây giờ, hãy tạo 1-3 tin nhắn tiếp theo bạn muốn gửi dưới dạng mảng JSON.`;

  try {
    const messagesForApi = [{ role: "user", content: systemPrompt }];
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: 1.0,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();

    const newMessages = JSON.parse(cleanedContent);

    return Array.isArray(newMessages) ? newMessages : [newMessages];
  } catch (error) {
    console.error("触发粉丝回复失败:", error);
    await showCustomAlert("Tạo câu trả lời thất bại", `Có lỗi: ${error.message}`);
    return [{ sender: "fan", text: `(AI gặp lỗi khi tạo câu trả lời: ${error.message})` }];
  }
}

/**
 * 清空所有User的私信
 */
async function handleClearAllUserDms() {
  const confirmed = await showCustomConfirm(
    "Xác nhận xóa sạch",
    "Bạn có chắc muốn xóa sạch mọi tin nhắn riêng của fan? Thao tác này không thể khôi phục.",
    {
      confirmButtonClass: "btn-danger",
    },
  );
  if (confirmed) {
    state.qzoneSettings.userDms = [];
    await saveQzoneSettings();
    renderUserDmList([]);
    alert("Đã xóa sạch mọi tin nhắn riêng.");
  }
}

/**
 * 【总入口】当用户点击关注列表时，打开私信界面
 * @param {object} targetInfo - 包含被点击角色/NPC信息的对象
 */
async function openWeiboDms(targetInfo) {
  currentViewingDmsFor = targetInfo;
  const charId = targetInfo.isNpc ? targetInfo.ownerId : targetInfo.id;
  const chat = state.chats[charId];
  if (!chat) return;

  const dmsData = await generateAndCacheFanDms(chat);

  renderDmList(dmsData, targetInfo.name);

  showScreen("weibo-dm-list-screen");
}

/**
 * 【AI核心】检查或生成角色的粉丝私信数据
 * @param {object} characterChat - 角色/NPC的 "主人" 的聊天对象
 * @returns {Promise<Array>} - 粉丝私信对话数组
 */
async function generateAndCacheFanDms(characterChat, addMore = false) {
  if (!addMore && characterChat.weiboDms && characterChat.weiboDms.length > 0) {
    console.log(`从缓存加载 "${characterChat.name}" 的粉丝私信。`);
    return characterChat.weiboDms;
  }

  const alertMessage = addMore
    ? "Đang tạo thêm nội dung tin nhắn riêng..."
    : `Đang tạo nội dung tin nhắn riêng của fan cho "${characterChat.name}"...`;
  await showCustomAlert("Vui lòng chờ...", alertMessage);

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return [];
  }

  const truncatedMainPersona = (
    characterChat.settings.aiPersona || "Một nhân vật bình thường"
  ).substring(0, 500);
  const truncatedWeiboInstruction = (
    characterChat.settings.weiboInstruction || "Không có chỉ thị đặc biệt"
  ).substring(0, 400);

  const existingDmsContext = addMore
    ? `
# Lịch sử tin nhắn riêng đã có (để bạn tham khảo, bạn có thể chọn tiếp nối cuộc trò chuyện hoặc mở cuộc trò chuyện mới):
${JSON.stringify(characterChat.weiboDms, null, 2)}
`
    : "";

  const systemPrompt = `
# Nhiệm vụ
Bây giờ bạn là trợ lý vận hành mạng xã hội của nhân vật "${characterChat.name}".
Nhiệm vụ của bạn là dựa vào 【toàn bộ thông tin】 của nhân vật này, hư cấu một danh sách tin nhắn riêng gồm ${addMore ? "2-3" : "3-5"} fan khác nhau, và sáng tác cho mỗi fan một đoạn lịch sử hội thoại sinh động, chân thật bằng tiếng Việt.
${existingDmsContext}

# Thông tin nhân vật (bạn phải tham khảo tổng hợp toàn bộ thông tin sau)
- Tên nhân vật: ${characterChat.name}
- Nghề nghiệp công khai: ${characterChat.settings.weiboProfession || "Chưa đặt"}
- Thiết lập cốt lõi (ưu tiên cao nhất): ${truncatedMainPersona}
- Nguyên tắc tương tác Weibo (cần tuân thủ khi xử lý tin nhắn riêng): ${truncatedWeiboInstruction}

# Quy tắc cốt lõi
1.  **Đa dạng fan**: Sáng tác ${addMore ? "2-3" : "3-5"} fan thuộc các kiểu khác nhau (ví dụ: fan cuồng, fan sự nghiệp, fan CP, anti-fan, fan qua đường, nhà quảng cáo...).
2.  **【【【Quy tắc sắt về độ sống động của hội thoại】】】**: Để cuộc trò chuyện chân thật hơn, bạn phải:
-   **Tránh hỏi đáp máy móc**: đừng tạo hội thoại vô nghĩa kiểu "Chào bạn" - "Chào bạn". Hãy để cuộc trò chuyện như một đoạn tương tác thật đang diễn ra.
-   **Thêm cảm xúc và giọng điệu**: giọng của fan có thể phấn khích, lo lắng, hoài nghi, đùa giỡn. Phản hồi của nhân vật cũng phải phù hợp thiết lập, có thể lạnh nhạt, dịu dàng, công thức, hoặc dứt khoát seen không trả lời.
-   **Dùng ngôn ngữ mạng**: thêm vừa phải tiếng lóng hợp văn hóa fandom, emoji hoặc kaomoji, để cuộc trò chuyện gần gũi hơn.
-   **Nội dung đa dạng**: tin nhắn riêng không nên chỉ giới hạn ở công việc, có thể là fan chia sẻ chuyện thường ngày, bày tỏ quan tâm, hỏi vài câu riêng tư...
3.  **Phản hồi của nhân vật**: Dựa vào 【Nguyên tắc tương tác Weibo】 và 【Thiết lập cốt lõi】 của nhân vật để quyết định nhân vật có trả lời tin nhắn riêng không và trả lời thế nào. Ví dụ, một nhân vật lạnh lùng có thể chỉ trả lời thông tin quan trọng, hoặc dứt khoát không trả lời.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, bắt đầu trực tiếp bằng '[' và kết thúc bằng ']'.

# Cấu trúc đối tượng JSON (lưu ý: bạn không cần cung cấp URL ảnh đại diện nữa)
{
"fanName": "biệt danh Weibo của fan",
"fanPersona": "mô tả ngắn về fan này (ví dụ: 'một fan mẹ lo lắng cho sự nghiệp của anh')",
  "messages": [
{ "sender": "fan", "text": "tin nhắn đầu tiên fan gửi..." },
{ "sender": "char", "text": "tin nhắn nhân vật trả lời..." }
  ]
}

Bây giờ, hãy bắt đầu tạo danh sách tin nhắn riêng.`;

  try {
    const messagesForApi = [{ role: "user", content: systemPrompt }];
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) {
      throw new Error(
        `Yêu cầu API thất bại: ${response.status} - ${await response.text()}`,
      );
    }

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newDmsData = JSON.parse(cleanedContent);
    if (Array.isArray(newDmsData)) {
      const fanAvatars = [
        "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg",
        "https://i.postimg.cc/Qd0Y537F/com-xingin-xhs-20251011153800.png",
      ];

      newDmsData.forEach((convo, index) => {
        convo.fanAvatarUrl = fanAvatars[index % fanAvatars.length];
      });
    }

    if (Array.isArray(newDmsData)) {
      if (!characterChat.weiboDms) characterChat.weiboDms = [];
      if (addMore) {
        characterChat.weiboDms.push(...newDmsData);
      } else {
        characterChat.weiboDms = newDmsData;
      }
      await db.chats.put(characterChat);
      return characterChat.weiboDms;
    }
    throw new Error("Dữ liệu AI trả về không phải một mảng hợp lệ.");
  } catch (error) {
    console.error("生成粉丝私信失败:", error);
    await showCustomAlert(
      "Tạo thất bại",
      `Xin lỗi, đã xảy ra lỗi khi tạo tin nhắn riêng.\n\nChi tiết:\n${error.message}`,
    );
    return characterChat.weiboDms || [];
  }
}

/**
 * 渲染粉丝私信列表
 * @param {Array} dmsData - 私信对话数组
 * @param {string} charName - 角色名
 */
function renderDmList(dmsData, charName) {
  const listEl = document.getElementById("weibo-dm-list");
  const titleEl = document.getElementById("weibo-dm-list-title");
  listEl.innerHTML = "";
  titleEl.textContent = `Tin nhắn riêng của ${charName}`;

  if (!dmsData || dmsData.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Chưa nhận được tin nhắn riêng nào</p>';
    return;
  }

  dmsData.forEach((convo, index) => {
    const lastMsg = convo.messages[convo.messages.length - 1];
    const item = document.createElement("div");
    item.className = "dm-list-item";
    item.dataset.fanIndex = index;
    item.innerHTML = `
            <img src="${convo.fanAvatarUrl}" class="dm-avatar">
            <div class="dm-info">
                <div class="dm-name">${convo.fanName}</div>
                <div class="dm-last-msg">${lastMsg.text}</div>
            </div>
        `;
    listEl.appendChild(item);
  });
}

/**
 * 打开私信详情页
 * @param {number} fanIndex - 粉丝在私信数组中的索引
 */
function openDmDetail(fanIndex) {
  const charId = currentViewingDmsFor.isNpc
    ? currentViewingDmsFor.ownerId
    : currentViewingDmsFor.id;
  const chat = state.chats[charId];
  const conversation = chat.weiboDms[fanIndex];

  if (conversation) {
    document.getElementById("weibo-dm-detail-screen").dataset.currentFanIndex =
      fanIndex; // Store index
    renderDmDetail(conversation, chat);
    showScreen("weibo-dm-detail-screen");
  }
}

/**
 * 渲染私信详情页的聊天气泡
 * @param {object} conversation - 单个粉丝的对话对象
 * @param {object} characterChat - 角色的聊天对象
 */
function renderDmDetail(conversation, characterChat) {
  const messagesEl = document.getElementById("weibo-dm-messages");
  const titleEl = document.getElementById("weibo-dm-detail-title");
  messagesEl.innerHTML = "";
  titleEl.textContent = conversation.fanName;

  const charAvatar =
    characterChat.settings.weiboAvatar ||
    characterChat.settings.aiAvatar ||
    defaultAvatar;

  conversation.messages.forEach((msg, index) => {
    const isFan = msg.sender === "fan";
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${isFan ? "fan" : "char"}`;

    const bubble = document.createElement("div");
    bubble.className = `message-bubble`;

    const avatarHtml = `<img src="${isFan ? conversation.fanAvatarUrl : charAvatar}" class="avatar">`;
    const contentHtml = `<div class="content">${msg.text.replace(/\n/g, "<br>")}</div>`;

    const deleteBtnHtml = isFan
      ? `<button class="dm-message-delete-btn" data-message-index="${index}">×</button>`
      : "";

    bubble.innerHTML = `${avatarHtml}${contentHtml}`;
    wrapper.innerHTML = deleteBtnHtml;
    wrapper.appendChild(bubble);

    messagesEl.appendChild(wrapper);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}
/**
 * 【全新】清空当前角色的所有粉丝私信
 */
async function handleClearAllDms() {
  if (!currentViewingDmsFor) return;

  const charId = currentViewingDmsFor.isNpc
    ? currentViewingDmsFor.ownerId
    : currentViewingDmsFor.id;
  const chat = state.chats[charId];
  if (!chat || !chat.weiboDms || chat.weiboDms.length === 0) {
    alert("Không có tin nhắn riêng nào để xóa.");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận xóa sạch",
    `Bạn có chắc muốn xóa sạch mọi tin nhắn riêng của fan mà "${currentViewingDmsFor.name}" đã nhận? Thao tác này không thể khôi phục.`,
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    chat.weiboDms = []; // 清空数组
    await db.chats.put(chat); // 保存到数据库
    renderDmList(chat.weiboDms, currentViewingDmsFor.name); // 重新渲染列表
    alert("Đã xóa sạch mọi tin nhắn riêng.");
  }
}

/**
 * 处理删除单条私信的逻辑
 * @param {number} fanIndex - 粉丝对话的索引
 * @param {number} messageIndex - 要删除的消息的索引
 */
async function handleDeleteWeiboDm(fanIndex, messageIndex) {
  const charId = currentViewingDmsFor.isNpc
    ? currentViewingDmsFor.ownerId
    : currentViewingDmsFor.id;
  const chat = state.chats[charId];
  if (!chat || !chat.weiboDms[fanIndex]) return;

  const conversation = chat.weiboDms[fanIndex];
  const messageText = conversation.messages[messageIndex].text.substring(0, 30);

  const confirmed = await showCustomConfirm(
    "Xóa tin nhắn riêng",
    `Bạn có chắc muốn xóa tin nhắn riêng này?\n\n"${messageText}..."`,
    {
      confirmButtonClass: "btn-danger",
    },
  );

  if (confirmed) {
    conversation.messages.splice(messageIndex, 1);

    if (conversation.messages.length === 0) {
      chat.weiboDms.splice(fanIndex, 1);
      await db.chats.put(chat);
      renderDmList(chat.weiboDms, currentViewingDmsFor.name);
      showScreen("weibo-dm-list-screen");
    } else {
      await db.chats.put(chat);
      renderDmDetail(conversation, chat);
    }
    alert("Đã xóa tin nhắn riêng.");
  }
}

/**
 * 处理点击“继续生成”按钮的逻辑
 */
async function handleGenerateMoreDms() {
  const charId = currentViewingDmsFor.isNpc
    ? currentViewingDmsFor.ownerId
    : currentViewingDmsFor.id;
  const chat = state.chats[charId];
  if (!chat) return;

  const newDmsData = await generateAndCacheFanDms(chat, true);

  renderDmList(newDmsData, currentViewingDmsFor.name);
}

const setupFileUpload = (inputId, callback) => {
  document.getElementById(inputId).addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // 调用新的通用压缩函数
        const compressedDataUrl = await handleImageUploadAndCompress(file);
        callback(compressedDataUrl); // 将压缩后的结果传给回调
      } catch (error) {
        console.error(`处理文件 ${file.name} 失败:`, error);
        alert(`Xử lý ảnh thất bại: ${error.message}`);
      } finally {
        event.target.value = null;
      }
    }
  });
};

// ===================================================================
// 3. Weibo Event Listeners
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("weibo-app-icon").addEventListener("click", () => {
    renderWeiboProfile();
    renderMyWeiboFeed();
    switchToWeiboView("weibo-my-profile-view");
    showScreen("weibo-screen");
  });

  // 【核心修改】统一的微博屏幕点击处理 (包含回复功能)
  document
    .getElementById("weibo-screen")
    .addEventListener("click", async (e) => {
      const target = e.target;
      const postItem = target.closest(".weibo-post-item");

      // 1. 获取帖子ID信息
      let postId = null;
      let isTempPost = false;

      if (postItem && postItem.dataset.postId) {
        if (postItem.dataset.postId.startsWith("temp_")) {
          isTempPost = true; // 标记为临时帖子
        } else {
          postId = parseInt(postItem.dataset.postId); // 数据库帖子
        }
      }

      // --- 0. 处理点击评论 (进入回复模式) ---
      // 注意：要排除删除按钮
      const commentItem = target.closest(".weibo-comment-item");
      if (
        commentItem &&
        !target.classList.contains("comment-delete-btn") &&
        postItem
      ) {
        const input = postItem.querySelector(".weibo-comment-input");
        if (!input) return;

        // 获取被点击者的名字 (去掉冒号和空格)
        // 优先找 .weibo-commenter-name，如果没有就找整个文本的开头
        const nameEl = commentItem.querySelector(".weibo-commenter-name");
        let commenterName = nameEl ? nameEl.textContent : "";
        // 如果名字里有 @，去掉 @
        commenterName = commenterName.replace("@", "").replace(":", "").trim();

        // 如果点击的是自己，或者是空的，就不回复
        const myNickname = state.qzoneSettings.weiboNickname || "Tôi";
        if (commenterName === myNickname) return;

        // 切换回复状态
        if (input.dataset.replyTo === commenterName) {
          // 取消回复
          input.placeholder = "Để lại bình luận thật chất của bạn...";
          delete input.dataset.replyTo;
        } else {
          // 设置回复
          input.placeholder = `Trả lời @${commenterName}:`;
          input.dataset.replyTo = commenterName;
          input.focus();
        }
        return; // 阻止继续触发其他逻辑
      }

      // --- 1. 处理删除评论 ---
      const deleteCommentBtn = target.closest(".comment-delete-btn");
      if (deleteCommentBtn) {
        const commentItem = deleteCommentBtn.closest(".weibo-comment-item");
        if (isTempPost) {
          commentItem.remove(); // 临时帖子直接删DOM
          // 更新评论数
          const countSpan = postItem.querySelector(
            ".weibo-post-actions span:nth-child(2) span",
          );
          if (countSpan)
            countSpan.textContent = Math.max(
              0,
              parseInt(countSpan.textContent || 0) - 1,
            );
        } else if (postId && commentItem && commentItem.dataset.commentId) {
          deleteWeiboComment(postId, commentItem.dataset.commentId);
        }
        return;
      }

      // --- 2. 处理生成评论 (AI) ---
      const generateBtn = target.closest(".generate-comments-btn");
      if (generateBtn && postItem) {
        if (isTempPost) {
          generateCommentsForTempPost(postItem);
        } else if (postId) {
          generateWeiboComments(postId);
        }
        return;
      }

      // --- 3. 处理用户发送评论 ---
      const sendBtn = target.closest(".weibo-comment-send-btn");
      if (sendBtn && postItem) {
        const input = postItem.querySelector(".weibo-comment-input");
        if (isTempPost) {
          handleUserCommentForTempPost(postItem, input);
        } else if (postId && input) {
          handleWeiboComment(postId, input);
        }
        return;
      }

      // --- 4. 处理点赞 ---
      const likeBtn = target.closest(".like-btn");
      if (likeBtn && postItem) {
        if (isTempPost) {
          likeBtn.classList.toggle("liked");
          const countSpan =
            likeBtn.querySelector("span:last-child") ||
            likeBtn.querySelector(".like-count");
          let count = parseInt(countSpan.textContent || 0);
          if (likeBtn.classList.contains("liked")) {
            countSpan.textContent = count + 1;
          } else {
            countSpan.textContent = Math.max(0, count - 1);
          }
        } else if (postId) {
          handleWeiboLike(postId);
        }
        return;
      }

      // --- 5. 处理删除整个帖子 ---
      const deletePostBtn =
        target.closest(".weibo-post-delete-btn") ||
        target.closest(".post-actions-btn");
      if (deletePostBtn && postItem) {
        const confirmed = await showCustomConfirm(
          "Xóa bài đăng",
          "Bạn có chắc muốn xóa bài đăng này?",
          { confirmButtonClass: "btn-danger" },
        );
        if (confirmed) {
          if (isTempPost) {
            postItem.remove();
          } else if (postId) {
            await db.weiboPosts.delete(postId);
            await renderMyWeiboFeed();
            await renderFollowingWeiboFeed();
          }
        }
        return;
      }

      // ... 原有的跳转逻辑 ...
      const avatarWrapper = e.target.closest(".weibo-post-avatar-clickable");
      if (avatarWrapper) {
        const charId = avatarWrapper.dataset.charId;
        if (charId && charId !== "user") openWeiboCharProfile(charId);
        return;
      }

      const navItem = target.closest(".weibo-nav-item");
      if (navItem && navItem.dataset.view) {
        switchToWeiboView(navItem.dataset.view);
        return;
      }
    });

  document
    .getElementById("weibo-profile-page")
    .addEventListener("click", async (e) => {
      const target = e.target;

      if (
        target.id === "weibo-avatar-img" ||
        target.closest(".weibo-avatar-container")
      ) {
        const choice = await showChoiceModal("Sửa ảnh đại diện", [
          { text: "Đổi ảnh đại diện", value: "avatar" },
          { text: "Đổi khung ảnh đại diện", value: "frame" },
        ]);

        if (choice === "avatar") {
          editWeiboAvatar();
        } else if (choice === "frame") {
          openFrameSelectorModal("weibo_profile");
        }
        return;
      } else if (target.id === "weibo-nickname") {
        editWeiboNickname();
      } else if (target.id === "weibo-user-profession-display") {
        openWeiboUserSettingsModal();
      } else if (target.id === "weibo-background-img") {
        editWeiboBackground();
      } else if (target.closest("#weibo-fans-item")) {
        editWeiboFansCount();
      }
    });

  document
    .getElementById("weibo-following-btn")
    .addEventListener("click", showFollowingList);
  document
    .getElementById("create-weibo-post-btn")
    .addEventListener("click", openWeiboPublisherClean);
  document
    .getElementById("close-following-list-btn")
    .addEventListener("click", () => {
      document
        .getElementById("weibo-following-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("clear-following-feed-btn")
    .addEventListener("click", clearFollowingFeed);

  document
    .getElementById("edit-weibo-profile-btn")
    .addEventListener("click", openWeiboUserSettingsModal);
  document
    .getElementById("cancel-weibo-user-settings-btn")
    .addEventListener("click", () => {
      document
        .getElementById("weibo-user-settings-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("save-weibo-user-settings-btn")
    .addEventListener("click", saveWeiboUserSettings);
  document
    .getElementById("weibo-user-preset-select")
    .addEventListener("change", handleWeiboUserPresetSelection);
  document
    .getElementById("manage-weibo-user-presets-btn")
    .addEventListener("click", openWeiboUserPresetManager);

  document
    .getElementById("generate-hot-search-btn")
    .addEventListener("click", async () => {
      const targets = await showMultiCharacterSelectorForWeibo();
      if (targets) {
        await generateHotSearch(targets);
      }
    });
  document
    .getElementById("generate-plaza-feed-btn")
    .addEventListener("click", async () => {
      const targets = await showMultiCharacterSelectorForWeibo();
      if (targets) {
        await generatePlazaFeed(null, targets);
      }
    });

  document
    .getElementById("back-from-hottopic-btn")
    .addEventListener("click", () => {
      switchToWeiboView("weibo-hot-search-view");
    });

  document
    .getElementById("refresh-hottopic-feed-btn")
    .addEventListener("click", () => {
      if (currentHotTopic) {
        generateHotSearchFeed(currentHotTopic);
      }
    });

  // 【已修复】关注列表点击事件：区分主页按钮、操作按钮和私信
  document
    .getElementById("weibo-following-list-container")
    .addEventListener("click", (e) => {
      const item = e.target.closest(".weibo-following-item");
      if (!item) return;

      // 1. 检查是否点击了【操作图标】
      const triggerBtn = e.target.closest(".weibo-action-trigger-btn");
      if (triggerBtn) {
        const targetInfo = {
          id: triggerBtn.dataset.targetId,
          name: triggerBtn.dataset.targetName,
          isNpc: triggerBtn.dataset.isNpc === "true",
          ownerId: triggerBtn.dataset.ownerId || null,
        };
        openWeiboActionModal(targetInfo);
        return; // 处理完直接退出
      }

      // 2. ★★★ 核心修复：检查是否点击了【主页按钮】 ★★★
      const profileBtn = e.target.closest(".view-profile-btn");
      if (profileBtn) {
        const charId = profileBtn.dataset.charId;
        if (charId) {
          // 关闭关注列表弹窗
          document
            .getElementById("weibo-following-modal")
            .classList.remove("visible");
          // 打开角色微博主页
          openWeiboCharProfile(charId);
        }
        return; // 处理完直接退出
      }

      // 3. 如果既不是操作按钮，也不是主页按钮，则默认打开私信
      document
        .getElementById("weibo-following-modal")
        .classList.remove("visible");

      // 为了打开私信，我们需要获取这一行绑定的数据（通常存在 actionBtn 上）
      const actionBtn = item.querySelector(".weibo-action-trigger-btn");
      if (actionBtn) {
        const targetInfo = {
          id: actionBtn.dataset.targetId,
          name: actionBtn.dataset.targetName,
          isNpc: actionBtn.dataset.isNpc === "true",
          ownerId: actionBtn.dataset.ownerId || null,
        };
        openWeiboDms(targetInfo);
      }
    });

  document
    .getElementById("cancel-weibo-action-btn")
    .addEventListener("click", () => {
      document.getElementById("weibo-action-modal").classList.remove("visible");
    });

  document
    .getElementById("confirm-weibo-action-btn")
    .addEventListener("click", handleWeiboAiAction);

  const userDmBtn = document.getElementById("weibo-my-dms-btn");
  if (userDmBtn) {
    userDmBtn.addEventListener("click", openUserDmListScreen);
  }

  document
    .getElementById("back-from-user-dm-list")
    .addEventListener("click", () => {
      showScreen("weibo-screen");
      switchToWeiboView("weibo-my-profile-view");
    });

  document
    .getElementById("generate-new-user-dms-btn")
    .addEventListener("click", () => generateUserDms(true));
  document
    .getElementById("clear-all-user-dms-btn")
    .addEventListener("click", handleClearAllUserDms);

  document
    .getElementById("user-dm-list-container")
    .addEventListener("click", (e) => {
      const item = e.target.closest(".dm-list-item");
      if (item && item.dataset.fanIndex) {
        openUserDmDetail(parseInt(item.dataset.fanIndex));
      }
    });

  document
    .getElementById("back-from-dm-detail")
    .addEventListener("click", () => {
      showScreen("user-dm-list-screen");
    });
  // 补丁：修复User私信详情页返回按钮失效的问题
  const backBtnUserDm = document.getElementById("back-from-user-dm-detail");
  if (backBtnUserDm) {
    backBtnUserDm.addEventListener("click", () => {
      showScreen("user-dm-list-screen");
    });
  }

  document
    .getElementById("user-dm-send-btn")
    .addEventListener("click", handleSendUserDm);
  document.getElementById("user-dm-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("user-dm-send-btn").click();
    }
  });

  document
    .getElementById("user-dm-trigger-ai-btn")
    .addEventListener("click", handleTriggerUserDmAiReply);
  document
    .getElementById("user-dm-reroll-btn")
    .addEventListener("click", handleUserDmReroll);

  document
    .getElementById("user-dm-messages-container")
    .addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".user-dm-message-delete-btn");
      if (deleteBtn) {
        const messageIndex = parseInt(deleteBtn.dataset.messageIndex);
        if (currentUserDmFanIndex !== null && !isNaN(messageIndex)) {
          handleDeleteUserDmMessage(currentUserDmFanIndex, messageIndex);
        }
      }
    });

  const userDmListEl = document.getElementById("user-dm-list-container");
  let userDmSwipeState = { isDragging: false, startX: 0, activeContent: null };

  function resetAllUserDmSwipes(exceptThisOne = null) {
    document
      .querySelectorAll(".user-dm-list-item-content.swiped")
      .forEach((content) => {
        if (content !== exceptThisOne) {
          content.classList.remove("swiped");
        }
      });
  }

  userDmListEl.addEventListener("mousedown", (e) => {
    const content = e.target.closest(".user-dm-list-item-content");
    if (content) {
      resetAllUserDmSwipes(content);
      userDmSwipeState = {
        isDragging: true,
        startX: e.pageX,
        activeContent: content,
      };
      e.preventDefault();
    }
  });
  userDmListEl.addEventListener(
    "touchstart",
    (e) => {
      const content = e.target.closest(".user-dm-list-item-content");
      if (content) {
        resetAllUserDmSwipes(content);
        userDmSwipeState = {
          isDragging: true,
          startX: e.touches[0].pageX,
          activeContent: content,
        };
      }
    },
    { passive: true },
  );

  document.addEventListener("mousemove", (e) => {
    if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent) return;
    const diffX = e.pageX - userDmSwipeState.startX;
    if (diffX < 0 && diffX > -90) {
      userDmSwipeState.activeContent.style.transition = "none";
      userDmSwipeState.activeContent.style.transform = `translateX(${diffX}px)`;
    }
  });
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent)
        return;
      const diffX = e.touches[0].pageX - userDmSwipeState.startX;
      if (diffX < 0 && diffX > -90) {
        userDmSwipeState.activeContent.style.transition = "none";
        userDmSwipeState.activeContent.style.transform = `translateX(${diffX}px)`;
      }
    },
    { passive: true },
  );

  const handleUserDmSwipeEnd = (e) => {
    if (!userDmSwipeState.isDragging || !userDmSwipeState.activeContent) return;

    const content = userDmSwipeState.activeContent;
    content.style.transition = "transform 0.3s ease";
    const transformStyle = window.getComputedStyle(content).transform;
    const currentTranslateX = new DOMMatrix(transformStyle).m41;

    if (currentTranslateX < -40) {
      content.classList.add("swiped");
    } else {
      content.classList.remove("swiped");
    }
    content.style.transform = "";

    userDmSwipeState = { isDragging: false, activeContent: null };
  };
  document.addEventListener("mouseup", handleUserDmSwipeEnd);
  document.addEventListener("touchend", handleUserDmSwipeEnd);

  userDmListEl.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("swipe-action-btn") &&
      e.target.classList.contains("delete")
    ) {
      const fanIndex = parseInt(e.target.dataset.fanIndex);
      if (!isNaN(fanIndex)) {
        handleDeleteUserDmConversation(fanIndex);
      }
    }
  });

  document.getElementById("back-from-dm-list").addEventListener("click", () => {
    showScreen("weibo-screen");
    switchToWeiboView("weibo-my-profile-view");
  });

  document
    .getElementById("back-from-dm-detail")
    .addEventListener("click", () => {
      showScreen("weibo-dm-list-screen");
    });

  document
    .getElementById("generate-more-dms-btn")
    .addEventListener("click", handleGenerateMoreDms);
  document
    .getElementById("clear-all-dms-btn")
    .addEventListener("click", handleClearAllDms);

  document.getElementById("weibo-dm-list").addEventListener("click", (e) => {
    const item = e.target.closest(".dm-list-item");
    if (item && item.dataset.fanIndex) {
      openDmDetail(parseInt(item.dataset.fanIndex));
    }
  });

  document
    .getElementById("weibo-dm-messages")
    .addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".dm-message-delete-btn");
      if (deleteBtn) {
        const fanIndex = parseInt(
          document.querySelector(".dm-list-item.active")?.dataset.fanIndex ??
            document.getElementById("weibo-dm-detail-screen").dataset
              .currentFanIndex,
        );
        const messageIndex = parseInt(deleteBtn.dataset.messageIndex);

        const conversation = state.chats[
          currentViewingDmsFor.isNpc
            ? currentViewingDmsFor.ownerId
            : currentViewingDmsFor.id
        ].weiboDms.find(
          (convo) =>
            convo.fanName ===
            document.getElementById("weibo-dm-detail-title").textContent,
        );
        const fanIdx =
          state.chats[
            currentViewingDmsFor.isNpc
              ? currentViewingDmsFor.ownerId
              : currentViewingDmsFor.id
          ].weiboDms.indexOf(conversation);

        if (!isNaN(fanIdx) && !isNaN(messageIndex)) {
          handleDeleteWeiboDm(fanIdx, messageIndex);
        }
      }
    });

  document
    .getElementById("back-from-char-profile")
    .addEventListener("click", () => {
      showScreen("weibo-screen");
    });

  document
    .getElementById("edit-char-weibo-profile-btn")
    .addEventListener("click", openCharWeiboEditor);

  document
    .getElementById("char-weibo-editor-modal")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("change-frame-btn")) {
        const type = e.target.dataset.type;
        const targetId = currentViewingWeiboProfileId;
        openFrameSelectorModal(type, targetId);
      } else if (e.target.id === "cancel-char-weibo-editor-btn") {
        document
          .getElementById("char-weibo-editor-modal")
          .classList.remove("visible");
      } else if (e.target.id === "save-char-weibo-editor-btn") {
        saveCharWeiboProfile();
      }
    });

  document
    .getElementById("weibo-char-profile-page")
    .addEventListener("click", async (e) => {
      if (!currentViewingWeiboProfileId) return;
      const chat = state.chats[currentViewingWeiboProfileId];
      if (!chat) return;

      if (e.target.closest("#weibo-char-following-item")) {
        const newFollowing = await showCustomPrompt(
          "Sửa số đang theo dõi",
          "Nhập số đang theo dõi mới:",
          chat.settings.weiboFollowingCount,
        );
        if (newFollowing !== null) {
          chat.settings.weiboFollowingCount = newFollowing.trim() || "0";
          await db.chats.put(chat);
          await renderWeiboCharProfile(currentViewingWeiboProfileId);
        }
      } else if (e.target.closest("#weibo-char-fans-item")) {
        const newFans = await showCustomPrompt(
          "Sửa số người theo dõi",
          "Nhập số người theo dõi mới (hỗ trợ 'K'/'M'):",
          chat.settings.weiboFansCount,
        );
        if (newFans !== null) {
          chat.settings.weiboFansCount = newFans.trim() || "0";
          await db.chats.put(chat);
          await renderWeiboCharProfile(currentViewingWeiboProfileId);
        }
      }
    });

  setupFileUpload("char-weibo-editor-avatar-input", (base64) => {
    document.getElementById("char-weibo-editor-avatar-preview").src = base64;
  });
  setupFileUpload("char-weibo-editor-bg-input", (base64) => {
    document.getElementById("char-weibo-editor-bg-preview").src = base64;
  });
});
