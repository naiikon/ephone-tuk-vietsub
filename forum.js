document.addEventListener("DOMContentLoaded", () => {
  let currentFilterContext = { type: "global", id: null }; // 记录当前打开筛选的是哪个页面
  let activeGroupId = null; // 记录当前打开的小组ID
  let activeForumPostId = null; // 记录当前打开的帖子ID
  let editingGroupId = null; // 用于追踪正在编辑的小组ID
  // ▼▼▼ 用这块【已添加梦角小组】的代码，完整替换掉你旧的 initializeDefaultGroups 函数 ▼▼▼
  let activeForumFilters = {
    global: [], // 用于主页小组列表的筛选
    group: {}, // 用于存储每个小组内部帖子的筛选, e.g., { 1: ['科幻'], 2: ['剧情'] }
  };
  let isSelectionMode = false;
  let weiboHotSearchCache = [];
  let activeSeriesId = null; // 当前查看的连载ID
  let postReturnContext = "group"; // 帖子详情返回去向
  const ongoingSeriesTasks = new Set(); // 防重复追更
  /**
   * 【全新】从一个数组中随机获取一个元素
   * @param {Array} arr - 目标数组
   * @returns {*} - 数组中的一个随机元素
   */
  function getRandomItem(arr) {
    // 安全检查，如果数组为空或不存在，返回空字符串
    if (!arr || arr.length === 0) return "";
    // 返回一个随机索引对应的元素
    return arr[Math.floor(Math.random() * arr.length)];
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
    const textImageModeBtn = document.getElementById(
      "switch-to-text-image-mode",
    );
    const imageModeContent = document.getElementById("image-mode-content");
    const textImageModeContent = document.getElementById(
      "text-image-mode-content",
    );

    imageModeBtn.classList.add("active");
    textImageModeBtn.classList.remove("active");
    imageModeContent.classList.add("active");
    textImageModeContent.classList.remove("active");
  }

  // ▲▲▲ 粘贴结束 ▲▲▲
  function addLongPressListener(element, callback) {
    let pressTimer;
    const startPress = (e) => {
      if (isSelectionMode) return;
      e.preventDefault();
      pressTimer = window.setTimeout(() => callback(e), 500);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    element.addEventListener("mousedown", startPress);
    element.addEventListener("mouseup", cancelPress);
    element.addEventListener("mouseleave", cancelPress);
    element.addEventListener("touchstart", startPress, { passive: true });
    element.addEventListener("touchend", cancelPress);
    element.addEventListener("touchmove", cancelPress);
  }
  /**
   * 【V3 最终完美版】渲染论坛主屏幕
   * 逻辑：内置小组显示SVG，用户小组显示自定义图片
   */
  async function renderForumScreen() {
    const listEl = document.getElementById("forum-group-list");
    const allGroups = await db.forumGroups.toArray();
    listEl.innerHTML = "";

    // --- 筛选逻辑 (保持不变) ---
    const globalFilters = activeForumFilters.global;
    let groupsToRender = allGroups;
    if (globalFilters && globalFilters.length > 0) {
      groupsToRender = allGroups.filter(
        (group) =>
          group.categories &&
          group.categories.some((cat) => globalFilters.includes(cat)),
      );
    }

    if (groupsToRender.length === 0) {
      const message =
        globalFilters.length > 0
          ? "Không tìm thấy nhóm nào khớp điều kiện lọc"
          : "Chưa có nhóm nào, bấm \"+\" ở góc trên bên phải để tạo một nhóm nhé!";
      listEl.innerHTML = `<p style="text-align:center; color: #8a8a8a; padding: 50px 0;">${message}</p>`;
      return;
    }

    // --- 核心：图标生成器 (已修复：优先显示自定义图片) ---
    const renderGroupIcon = (group) => {
      const name = group.name;
      const iconInput = group.icon || ""; // 可能是emoji 或 URL

      // 1. 【最高优先级】检查是否是图片URL (http开头 或 data:开头)
      // 只要用户填了链接，不管它叫什么名字，都强制显示图片！
      if (iconInput.startsWith("http") || iconInput.startsWith("data:")) {
        return `<img src="${iconInput}" class="forum-group-custom-img">`;
      }

      // 2. 如果没有图片URL，再检查是否是【内置小组】，使用精美SVG
      const svgStyle = `width="24" height="24" fill="currentColor" viewBox="0 0 24 24"`;

      if (name.includes("giải trí") || name.includes("hóng")) {
        return `<div class="forum-group-icon-wrapper style-pink"><svg ${svgStyle}><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
      }
      if (name.includes("tâm linh") || name.includes("ma")) {
        return `<div class="forum-group-icon-wrapper style-purple"><svg ${svgStyle}><path d="M9 22v-2c0-1.1.9-2 2-2s2 .9 2 2v2M6 22v-4c0-1.1.9-2 2-2s2 .9 2 2v4M18 22v-4c0-1.1-.9-2-2-2s-2 .9-2 2v4M12 2a8 8 0 0 0-8 8v7a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-7a8 8 0 0 0-8-8z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg></div>`;
      }
      if (
        name.includes("crush") ||
        name.includes("mơ") ||
        name.includes("yêu") ||
        name.includes("rung động")
      ) {
        return `<div class="forum-group-icon-wrapper style-red"><svg ${svgStyle}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>`;
      }
      if (name.includes("đồng nhân") || name.includes("truyện") || name.includes("viết")) {
        return `<div class="forum-group-icon-wrapper style-blue"><svg ${svgStyle}><path d="M12 19l7-7 3 3-7 7-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 2l7.586 7.586" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="11" r="2" fill="currentColor"/></svg></div>`;
      }
      if (name.includes("giúp") || name.includes("chọn") || name.includes("hỗ trợ")) {
        return `<div class="forum-group-icon-wrapper style-orange"><svg ${svgStyle}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2"/></svg></div>`;
      }

      // 3. 如果既不是URL，名字也没匹配到内置风格，就检查是不是 Emoji
      if (iconInput) {
        // 这里简单处理，直接显示输入的字符作为图标（用于Emoji）
        return `<div class="forum-group-icon-wrapper style-default" style="font-size: 24px; display: flex; align-items: center; justify-content: center;">${iconInput}</div>`;
      }

      // 4. 最后的默认 SVG (兜底)
      return `<div class="forum-group-icon-wrapper style-default"><svg ${svgStyle}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg></div>`;
    };

    // --- 渲染列表 ---
    groupsToRender.forEach((group) => {
      const item = document.createElement("div");
      item.className = "forum-group-item";

      let categoriesHtml = "";
      if (group.categories && group.categories.length > 0) {
        categoriesHtml = `
                <div class="category-tag-container">
                    ${group.categories.map((cat) => `<span class="category-tag">#${cat}</span>`).join("")}
                </div>
            `;
      }

      item.innerHTML = `
            ${renderGroupIcon(group)}
            <div class="forum-group-info">
                <div class="forum-group-name">${group.name}</div>
                <div class="forum-group-desc">${group.description || "Chưa có giới thiệu"}</div>
                ${categoriesHtml}
            </div>
            <div class="forum-group-arrow">›</div>
        `;
      item.addEventListener("click", () => openGroup(group.id, group.name));
      addLongPressListener(item, () => showGroupActions(group.id, group.name));
      listEl.appendChild(item);
    });

    // 更新筛选按钮状态
    const filterBtn = document.getElementById("forum-filter-btn");
    if (filterBtn) {
      filterBtn.classList.toggle(
        "active",
        globalFilters && globalFilters.length > 0,
      );
    }
  }

  /**
   * 【全新】长按小组时显示操作菜单（编辑或删除）
   * @param {number} groupId - 小组的ID
   * @param {string} groupName - 小组的名称
   */
  async function showGroupActions(groupId, groupName) {
    // 调用你现有的弹窗函数，显示两个选项
    const choice = await showChoiceModal(`Thao tác với nhóm "${groupName}"`, [
      { text: "✏️ Sửa thông tin nhóm", value: "edit" },
      { text: "🗑️ Xóa nhóm", value: "delete" },
    ]);

    // 根据用户的选择，执行不同的操作
    if (choice === "edit") {
      // 如果用户选择“编辑”，就调用你原来的编辑函数
      openGroupEditor(groupId);
    } else if (choice === "delete") {
      // 如果用户选择“删除”，就调用你原来的删除函数
      deleteGroupAndPosts(groupId);
    }
  }

  async function openGroup(groupId, groupName) {
    window.activeGroupId = groupId;
    document.getElementById("group-screen-title").textContent = groupName;
    const fanficBar = document.getElementById("fanfic-preference-bar");

    // 根据小组名显示或隐藏特定UI
    if (groupName === "Nhóm truyện đồng nhân") {
      fanficBar.style.display = "block";
      await populateFanficSelectors();
      await loadFanficPresets(); // ★ 新增：加载预设

      // 默认折叠起来，不占用空间
      document.getElementById("fanfic-bar-content").classList.add("collapsed");
      document
        .getElementById("fanfic-bar-toggle-icon")
        .classList.add("collapsed");
    } else {
      fanficBar.style.display = "none";
    }
    await renderGroupPosts(groupId);
    showScreen("group-screen");
  }

  /**
   * 【全新】将一个新创建的帖子元素添加到列表的顶部
   * @param {object} post - 包含ID的完整帖子对象
   */
  function prependNewPostElement(post) {
    const listEl = document.getElementById("group-post-list");

    // 检查列表当前是否显示“空空如也”的消息，如果是，就清空它
    const emptyMessage = listEl.querySelector("p");
    if (
      emptyMessage &&
      (emptyMessage.textContent.includes("chưa có bài viết") ||
        emptyMessage.textContent.includes("khớp điều kiện lọc"))
    ) {
      listEl.innerHTML = "";
    }

    // 创建新帖子的DOM元素（这段代码与renderGroupPosts中的逻辑几乎一样）
    const commentCount = 0; // 新帖子的评论数永远是0
    const item = document.createElement("div");
    item.className = "forum-post-item";
    item.dataset.postId = post.id;

    let categoriesHtml = "";
    if (post.categories && post.categories.length > 0) {
      categoriesHtml = `
      <div class="category-tag-container">
          ${post.categories.map((cat) => `<span class="category-tag">#${cat}</span>`).join("")}
      </div>
    `;
    }

    item.innerHTML = `
      <div class="post-item-title">${post.title}</div>
      ${categoriesHtml}
      <div class="post-item-meta">
<span>Tác giả: ${post.author}</span>
<span>Bình luận: ${commentCount}</span>
      </div>
<button class="forum-post-delete-btn" title="Xóa bài viết">×</button>
  `;

    // 使用 prepend() 将新帖子添加到列表的【最前面】
    listEl.prepend(item);
  }

  // forum.js

  /**
   * 【已修复】渲染小组内的帖子列表及其分类（已支持筛选）
   */
  async function renderGroupPosts(groupId) {
    const listEl = document.getElementById("group-post-list");
    const allPosts = await db.forumPosts
      .where("groupId")
      .equals(groupId)
      .reverse()
      .sortBy("timestamp");
    listEl.innerHTML = "";

    const groupFilters = activeForumFilters.group[groupId];
    let postsToRender = allPosts;

    if (groupFilters && groupFilters.length > 0) {
      postsToRender = allPosts.filter(
        (post) =>
          post.categories &&
          post.categories.some((cat) => groupFilters.includes(cat)),
      );
    }

    if (postsToRender.length === 0) {
      const message =
        groupFilters && groupFilters.length > 0
          ? "Không tìm thấy bài viết nào khớp điều kiện lọc"
          : "Nhóm này chưa có bài viết nào";
      listEl.innerHTML = `<p style="text-align:center; color: #8a8a8a; padding: 50px 0;">${message}</p>`;
      return;
    }

    for (const post of postsToRender) {
      // ★★★★★ 这就是唯一的、核心的修复！ ★★★★★
      // 在使用 post.id 查询前，先用 parseInt() 确保它一定是数字类型。
      const commentCount = await db.forumComments
        .where("postId")
        .equals(parseInt(post.id))
        .count();
      // ★★★★★ 修复结束 ★★★★★

      const item = document.createElement("div");
      item.className = "forum-post-item";
      item.dataset.postId = post.id;

      const categoriesForDisplay = [...(post.categories || [])];
      if (
        post.lengthType === "long" &&
        !categoriesForDisplay.includes("Truyện dài")
      ) {
        categoriesForDisplay.unshift("Truyện dài");
      } else if (
        post.lengthType === "short" &&
        !categoriesForDisplay.includes("Truyện ngắn")
      ) {
        categoriesForDisplay.unshift("Truyện ngắn");
      }
      if (post.chapterIndex) {
        categoriesForDisplay.unshift(`Chương ${post.chapterIndex}`);
      }

      let categoriesHtml = "";
      if (categoriesForDisplay.length > 0) {
        categoriesHtml = `
                <div class="category-tag-container">
                    ${categoriesForDisplay.map((cat) => `<span class="category-tag">#${cat}</span>`).join("")}
                </div>
            `;
      }

      item.innerHTML = `
            <div class="post-item-title">${post.title}</div>
            ${categoriesHtml}
            <div class="post-item-meta">
<span>Tác giả: ${post.author}</span>
<span>Bình luận: ${commentCount}</span>
            </div>
<button class="forum-post-delete-btn" title="Xóa bài viết">×</button>
        `;
      listEl.appendChild(item);
    }

    // 更新筛选按钮状态
    const filterBtn = document.getElementById("group-filter-btn");
    if (filterBtn) {
      filterBtn.classList.toggle(
        "active",
        groupFilters && groupFilters.length > 0,
      );
    }
  }

  /**
   * 【关键修复】打开一个帖子，显示详情和评论
   */
  async function openPost(
    postId,
    returnContext = "group",
    returnSeriesId = null,
  ) {
    activeForumPostId = postId;
    postReturnContext = returnContext;
    activeSeriesId = returnSeriesId || activeSeriesId;
    await renderPostDetails(postId);
    showScreen("post-screen");
  }
  /**
   * 【功能增强版】渲染帖子详情和评论 (已修改：接入全局路人头像库)
   */
  async function renderPostDetails(postId) {
    const contentEl = document.getElementById("post-detail-content");
    const post = await db.forumPosts.get(postId);
    const comments = await db.forumComments
      .where("postId")
      .equals(postId)
      .sortBy("timestamp");

    if (post?.groupId) {
      window.activeGroupId = post.groupId;
    }

    if (!post) {
      contentEl.innerHTML = "<p>Bài viết không tồn tại hoặc đã bị xóa</p>";
      return;
    }

    // --- 1. 获取作者头像 ---
    let authorAvatarUrl;
    const userNickname = state.qzoneSettings.nickname || "Tôi";

    // 优先级 1: 如果是用户自己
    if (post.author === userNickname) {
      authorAvatarUrl = state.qzoneSettings.avatar;
    }
    // 优先级 2: 如果是已存在的角色 (Char)
    else {
      const authorChar = Object.values(state.chats).find(
        (c) => c.name === post.author,
      );
      if (authorChar) {
        authorAvatarUrl = authorChar.settings.aiAvatar;
      } else {
        // 优先级 3: 既不是用户也不是角色，那就是路人 -> 调用全局路人库
        // 这里的 window.getAvatarForName 是你在本体代码里定义的全局函数
        authorAvatarUrl = window.getAvatarForName
          ? window.getAvatarForName(post.author)
          : "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg"; // 防止函数未定义的兜底
      }
    }

    let seriesMetaHtml = "";
    if (post.lengthType === "long" && post.seriesId) {
      const series = await db.forumSeries.get(post.seriesId);
      const nextChapterIndex =
        (series?.lastChapterIndex || post.chapterIndex || 1) + 1;
      const isFollowed = !!series?.isFollowed;
      const followText = isFollowed ? "Đã theo dõi truyện" : "Theo dõi truyện";
      const isFinished = !!series?.isFinished;
      const continueText = isFinished
        ? "Đã hoàn thành"
        : `Viết tiếp chương ${nextChapterIndex}`;
      seriesMetaHtml = `
        <div class="post-series-bar">
          <div class="series-meta">
<div class="series-title">Truyện dài kỳ: ${series?.title || post.title}</div>
<div class="series-status">Chương hiện tại: Chương ${post.chapterIndex || 1} · CP: ${series?.pairing || "Không xác định"} · ${isFinished ? "Đã hoàn thành" : "Đang ra"}</div>
          </div>
          <div class="series-actions">
            <button class="mini-btn ${isFollowed ? "disabled" : ""}" data-action="follow-series" data-series-id="${post.seriesId}" ${isFollowed ? "disabled" : ""}>${followText}</button>
            <button class="mini-btn primary ${isFinished ? "disabled" : ""}" data-action="continue-series" data-series-id="${post.seriesId}" data-target-chapter="${nextChapterIndex}" ${isFinished ? "disabled" : ""}>${continueText}</button>
          </div>
        </div>
      `;
    }

    // --- 2. 拼接评论区HTML ---
    let commentsHtml = `
        <div class="post-comments-section">
<h3>Bình luận (${comments.length})</h3>
    `;
    if (comments.length > 0) {
      comments.forEach((comment, index) => {
        // --- 2a. 获取评论者头像 ---
        let commenterAvatarUrl;

        // 优先级 1: 如果是用户自己
        if (comment.author === userNickname) {
          commenterAvatarUrl = state.qzoneSettings.avatar;
        }
        // 优先级 2: 如果是已存在的角色 (Char)
        else {
          const commenterChar = Object.values(state.chats).find(
            (c) => c.name === comment.author,
          );
          if (commenterChar) {
            commenterAvatarUrl = commenterChar.settings.aiAvatar;
          } else {
            // 优先级 3: 路人 -> 调用全局路人库
            commenterAvatarUrl = window.getAvatarForName
              ? window.getAvatarForName(comment.author)
              : "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg";
          }
        }

        // --- 2b. 处理回复 ---
        let replyHtml = "";
        if (comment.replyTo) {
          replyHtml = `<span class="reply-text">trả lời</span> <span class="reply-target-name">${comment.replyTo}</span>`;
        }

        // --- 2c. 拼接单条评论的完整HTML ---
        commentsHtml += `
        <div class="post-comment-item" data-commenter-name="${comment.author}">
            <img src="${commenterAvatarUrl}" class="comment-avatar-small">
            <div class="comment-details">
                <div class="comment-header-line">
                    <span class="comment-author">${comment.author}</span>
<span class="comment-floor">Tầng ${index + 1}</span>
                </div>
                <div class="comment-content">
                    ${replyHtml}
                    <span class="comment-text">${(comment.content || "").replace(/\n/g, "<br>")}</span>
                </div>
            </div>
<!-- nút xóa -->
            <span class="forum-comment-delete-btn" data-id="${comment.id}">×</span>
        </div>
    `;
      });
    } else {
      commentsHtml +=
        '<p style="color: var(--text-secondary); font-size: 14px;">Chưa có bình luận, mau vào giành tem!</p>';
    }
    commentsHtml += "</div>";

    // --- 3. 拼接帖子详情页的完整HTML ---
    contentEl.innerHTML = `
        <div class="post-detail-header">
            <h1 class="post-main-title">${post.title}</h1>
            <div class="post-user-info-row">
                <img src="${authorAvatarUrl}" class="post-author-avatar">
                <div class="post-detail-meta-group">
                    <span class="post-author-name">${post.author}</span>
                    <span class="post-publish-time">${new Date(post.timestamp).toLocaleString()}</span>
                </div>
            </div>
        </div>

        ${seriesMetaHtml}

        <div class="post-detail-body">${post.content.replace(/\n/g, "<br>")}</div>

        <div class="generate-comments-container">
<button id="generate-forum-comments-btn">✨ Tạo bình luận</button>
        </div>
        ${commentsHtml}
    `;

    // --- 4. 重新绑定评论的点击回复事件 ---
    contentEl.querySelectorAll(".post-comment-item").forEach((item) => {
      item.addEventListener("click", () => {
        const commenterName = item.dataset.commenterName;
        const myNickname = state.qzoneSettings.nickname || "Tôi";
        if (commenterName !== myNickname) {
          const commentInput = document.getElementById("post-comment-input");
          commentInput.placeholder = `Trả lời ${commenterName}:`;
          commentInput.dataset.replyTo = commenterName;
          commentInput.focus();
        }
      });
    });
  }

  /**
   * 【AI核心】为论坛帖子生成“豆瓣风格”的评论
   */
  async function generateForumComments() {
    const postIdToCommentOn = activeForumPostId;
    if (!postIdToCommentOn) return;

    await showCustomAlert("Vui lòng chờ...", "Đang gọi các thành viên kỳ cựu tới xem...");

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Hãy cấu hình xong trong Cài đặt API mới tạo được nội dung nhé!");
      return;
    }

    const post = await db.forumPosts.get(postIdToCommentOn);
    const existingComments = await db.forumComments
      .where("postId")
      .equals(postIdToCommentOn)
      .toArray();
    const group = await db.forumGroups.get(post.groupId);

    // ▼▼▼ 用下面这【一整块新代码】替换掉旧的 prompt 变量 ▼▼▼
    const prompt = `
# Nhiệm vụ
Bạn là một "trình mô phỏng thành viên kỳ cựu của hội nhóm Douban" chuyên nghiệp. Nhiệm vụ của bạn là tạo 5 bình luận hoàn toàn mới, rất "chất hội nhóm" cho một bài viết trong nhóm diễn đàn tên "${group.name}".

# Thông tin bài viết
- Tiêu đề: ${post.title}
- Nội dung: ${post.content.substring(0, 300)}...
- Bình luận đã có:
${existingComments.map((c) => `- ${c.author}: ${c.content}`).join("\n") || "(Chưa có bình luận)"}

# 【【【Quy tắc cốt lõi khi tạo bình luận】】】
1.  **Phong cách hội nhóm**: Văn phong bình luận phải thật tự nhiên, đúng thói quen của cư dân mạng Việt Nam trong các hội nhóm. Dùng nhiều tiếng lóng và ngôn ngữ mạng, ví dụ:
- "Đồng ý với chị em bên trên!"
- "Lưu lại, cảm ơn chủ thớt đã chia sẻ"
- "Hóng phần tiếp theo"
- "Hahahahahahahahahahahahahaha" (thật nhiều chữ "ha")
- "Cái này nói ra được hả?"
- "Đánh dấu"
- "Cười xỉu, bà là cái loa phát thanh của cõi mạng à"
- "Ghim lại"
- "Tôi vào trước, chủ thớt tốt bụng cả đời bình an"
2.  **Tính tương tác**: Các bình luận được tạo phải tương tác qua lại với nhau. Bạn có thể trả lời chủ thớt (tác giả: ${post.author}), cũng có thể trả lời cư dân mạng khác trong khu bình luận.
3.  **【【【Quy tắc sắt về tạo biệt danh】】】**: Biệt danh của người bình luận ("author") 【bắt buộc】 là biệt danh cư dân mạng qua đường do bạn tự hư cấu, ngẫu nhiên, đời thường, hợp không khí nhóm. 【Tuyệt đối cấm】 dùng bất kỳ tên nào trong "Danh sách người của công chúng" bên dưới làm người bình luận.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt gồm 5 đối tượng. Mỗi đối tượng 【bắt buộc】 có hai trường "author" và "content", nếu cần trả lời người khác có thể thêm trường "replyTo". Viết bằng tiếng Việt.

# Danh sách người của công chúng (họ là đối tượng được bàn tán, không phải người đăng bài)
${Object.values(state.chats)
  .filter((c) => !c.isGroup)
  .map((c) => `- ${c.name}`)
  .join("\n")}

# Ví dụ định dạng đầu ra JSON:
[
  {
"author": "Ngủ sớm dậy sớm khỏe người",
"content": "Đồng ý với anh bên trên, đúng là vậy thật!"
  },
  {
    "author": "momo",
"content": "Hahahahahahahaha cái này nói ra được hả",
"replyTo": "Ngủ sớm dậy sớm khỏe người"
  }
]
`;
    // ▲▲▲ 替换结束 ▲▲▲

    const messagesForApi = [{ role: "user", content: prompt }];

    try {
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
      const newCommentsData = JSON.parse(cleanedContent);
      if (Array.isArray(newCommentsData) && newCommentsData.length > 0) {
        const commentsToAdd = newCommentsData.map((comment, index) => ({
          postId: postIdToCommentOn,
          author: comment.author || "Người qua đường",
          content: comment.content,
          replyTo: comment.replyTo || null,
          timestamp: Date.now() + index,
        }));
        await db.forumComments.bulkAdd(commentsToAdd);
        await showCustomAlert(
          "Gọi thành công!",
          `Đã gọi thành công ${commentsToAdd.length} thành viên tới xem.`,
        );
      } else {
        throw new Error("Dữ liệu AI trả về sai định dạng.");
      }
    } catch (error) {
      console.error("生成小组评论失败:", error);
      await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    } finally {
      await renderPostDetails(postIdToCommentOn);
    }
  }

  /**
   * 为帖子添加新评论 (支持回复)
   */
  async function handleAddComment() {
    if (!activeForumPostId) return;
    const input = document.getElementById("post-comment-input");
    const content = input.value.trim();
    if (!content) {
      alert("Nội dung bình luận không được để trống!");
      return;
    }
    const newComment = {
      postId: activeForumPostId,
      author: state.qzoneSettings.nickname || "Tôi",
      content: content,
      timestamp: Date.now(),
    };
    if (input.dataset.replyTo) {
      newComment.replyTo = input.dataset.replyTo;
    }
    await db.forumComments.add(newComment);
    input.value = "";
    input.placeholder = "Viết bình luận của bạn...";
    delete input.dataset.replyTo;
    await renderPostDetails(activeForumPostId);
  }

  /**
   * 获取所有可用于同人创作的角色列表
   */
  function getAvailableCharacters() {
    const user = { id: "user", name: state.qzoneSettings.nickname || "Tôi" };
    const chars = Object.values(state.chats)
      .filter((c) => !c.isGroup)
      .map((c) => ({ id: c.id, name: c.name }));
    return [user, ...chars];
  }

  async function selectShareTarget(
    title = "Chia sẻ tới...",
    inputName = "share-target",
  ) {
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    if (!modal || !listEl) {
      alert("Không tìm thấy thành phần cửa sổ chia sẻ");
      return null;
    }
    listEl.innerHTML = "";

    const allChats = Object.values(state.chats);
    if (allChats.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color:#999; padding:20px;">Chưa có đối tượng chat</p>';
    } else {
      allChats.forEach((chat) => {
        const item = document.createElement("div");
        item.className = "contact-picker-item";
        const avatarUrl = chat.isGroup
          ? chat.settings.groupAvatar || defaultGroupAvatar
          : chat.settings.aiAvatar || defaultAvatar;
        const typeLabel = chat.isGroup
          ? '<span style="font-size:10px; color:white; background:#007bff; padding:1px 4px; border-radius:4px; margin-left:5px;">Nhóm chat</span>'
          : "";
        item.innerHTML = `
          <input type="radio" name="${inputName}" value="${chat.id}" id="${inputName}-${chat.id}" style="margin-right: 15px;">
          <label for="${inputName}-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
            <img src="${avatarUrl}" class="avatar">
            <span class="name">${chat.name} ${typeLabel}</span>
          </label>
        `;
        listEl.appendChild(item);
      });
    }

    document.getElementById("share-target-modal-title").textContent = title;
    modal.classList.add("visible");

    return await new Promise((resolve) => {
      const confirmBtn = document.getElementById("confirm-share-target-btn");
      const cancelBtn = document.getElementById("cancel-share-target-btn");
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      newConfirmBtn.onclick = () => {
        const selectedRadio = document.querySelector(
          `input[name="${inputName}"]:checked`,
        );
        if (!selectedRadio) {
          alert("Vui lòng chọn một đối tượng chat!");
          return;
        }
        modal.classList.remove("visible");
        resolve(state.chats[selectedRadio.value]);
      };
      const handleCancel = () => {
        modal.classList.remove("visible");
        resolve(null);
      };
      if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.onclick = handleCancel;
      }
    });
  }

  function getPersonaByName(name) {
    if (!name) return "Một người bình thường";
    if (name === state.qzoneSettings.nickname) {
      return state.qzoneSettings.weiboUserPersona || "Một người bình thường";
    }
    const target = Object.values(state.chats).find((c) => c.name === name);
    return target?.settings?.aiPersona || "Một người bình thường";
  }

  /**
   * 填充同人文小组的CP选择器
   */
  async function populateFanficSelectors() {
    const charList = getAvailableCharacters();
    const select1 = document.getElementById("fanfic-char1-select");
    const select2 = document.getElementById("fanfic-char2-select");
    select1.innerHTML = "";
    select2.innerHTML = "";
    charList.forEach((char) => {
      const option1 = document.createElement("option");
      option1.value = char.name;
      option1.textContent = char.name;
      select1.appendChild(option1);
      const option2 = document.createElement("option");
      option2.value = char.name;
      option2.textContent = char.name;
      select2.appendChild(option2);
    });
    if (charList.length > 1) {
      select1.selectedIndex = 0;
      select2.selectedIndex = 1;
    }
  }

  // ▼▼▼ 【修改点 3】生成AI内容时，使用全局变量 ▼▼▼
  async function handleGenerateGroupContent() {
    const groupIdToGenerateFor = window.activeGroupId; // 【修改】使用 window.activeGroupId
    if (!groupIdToGenerateFor) return;

    const group = await db.forumGroups.get(groupIdToGenerateFor);
    if (!group) return;

    if (group.name === "Nhóm nhân vật trong mơ") {
      await generateDreamPost(groupIdToGenerateFor);
    } else if (group.name === "Nhóm giải trí") {
      await generateEntertainmentGroupContent(groupIdToGenerateFor);
    } else if (group.name === "Nhóm truyện đồng nhân") {
      await generateFanfic(groupIdToGenerateFor);
    } else {
      await generateForumContentWithAPI(groupIdToGenerateFor, group.name);
    }
  }

  // ▼▼▼ 用这块【V5 | 最终原创分类版】代码，完整替换旧的 generateForumContentWithAPI 函数 ▼▼▼

  /**
   * 【AI核心 - V5 世界观+原创分类版】为通用小组生成内容
   */
  async function generateForumContentWithAPI(groupId, groupName) {
    if (!groupId) return;

    // --- 1. 获取小组的世界观 ---
    const group = await db.forumGroups.get(groupId);
    if (!group) {
      alert("Lỗi: không tìm thấy nhóm này!");
      return;
    }
    const worldview = group.worldview || "";

    await showCustomAlert("Vui lòng chờ...", `AI đang tìm cảm hứng cho nhóm "${groupName}"...`);

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Hãy cấu hình xong trong Cài đặt API mới tạo được nội dung nhé!");
      return;
    }

    let worldviewContext = "";
    if (worldview.trim()) {
      worldviewContext = `
# Thế giới quan riêng của nhóm (bạn phải tuân thủ nghiêm ngặt)
${worldview}
`;
    }

    const passerbyPostCount = 5;

    // --- ▼▼▼ 【核心修改】彻底重写Prompt指令 ---
    const prompt = `
# Nhiệm vụ
Bạn là một "trình tạo nội dung diễn đàn" chuyên nghiệp. Nhiệm vụ của bạn là tạo 【${passerbyPostCount} bài viết】 hoàn toàn mới, thú vị, phù hợp chủ đề cho nhóm diễn đàn tên "${groupName}", và tạo 2-3 bình luận hợp tình huống cho mỗi bài. Viết tất cả bằng tiếng Việt.

${worldviewContext}

# Quy tắc cốt lõi
1.  **Liên quan chủ đề**: Tiêu đề, nội dung và bình luận của mọi bài đều phải liên quan mật thiết tới chủ đề nhóm "${groupName}".
2.  **【【【Quy tắc sắt về phân loại】】】**: Bạn 【bắt buộc】 phải dựa vào 【nội dung cụ thể】 của từng bài để tự sáng tạo 1-2 nhãn phân loại liên quan mật thiết. Tuyệt đối không dùng bất kỳ danh sách phân loại cố định, có sẵn nào.
- Ví dụ, nếu bài viết bàn về thiết lập, phân loại có thể là ["Bàn về thiết lập"].
- Nếu bài viết phân tích cốt truyện, phân loại có thể là ["Phân tích cốt truyện"].
- Nếu bài viết là tán gẫu, phân loại có thể là ["Tám chuyện"].
3.  **Tác giả ngẫu nhiên**: Tác giả mỗi bài đều phải là cư dân mạng qua đường do bạn hư cấu, hợp không khí nhóm.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, gồm 【${passerbyPostCount}】 đối tượng bài viết. Mỗi đối tượng 【bắt buộc】 có các trường "author", "title", "content", "categories" và "comments".
- Trường "categories" 【bắt buộc】 là mảng phân loại bạn tự sáng tạo cho bài này.
- Giá trị trường "comments" 【bắt buộc】 là một mảng đối tượng, mỗi đối tượng có trường "author" và "content".

# Ví dụ định dạng đầu ra JSON:
[
  {
"author": "Ngủ sớm dậy sớm khỏe người",
"title": "Một thắc mắc về thiết lập XX trong thế giới quan",
"content": "Tôi vừa xem thiết lập thế giới quan, trong đó nói XX màu xanh dương, nhưng chỗ khác lại nói là màu xanh lá...",
"categories": ["Bàn về thiết lập", "Phân tích cốt truyện"],
    "comments": [
{"author": "Người qua đường A", "content": "Tôi cũng phát hiện ra! Hóng người giải đáp."}
    ]
  }
]
`;
    // --- ▲▲▲ 更新结束 ▲▲▲ ---

    const messagesForApi = [{ role: "user", content: prompt }];

    try {
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
      const newPostsData = JSON.parse(cleanedContent);

      if (Array.isArray(newPostsData) && newPostsData.length > 0) {
        let totalPosts = 0;
        let totalComments = 0;
        for (const postData of newPostsData) {
          // --- 3. 保存帖子时，也保存AI原创的分类 ---
          const newPost = {
            groupId: groupId,
            title: postData.title,
            content: postData.content,
            author: postData.author,
            timestamp: Date.now() + totalPosts,
            categories: postData.categories || [], // 保存原创分类
          };
          const postId = await db.forumPosts.add(newPost);
          totalPosts++;

          if (postData.comments && Array.isArray(postData.comments)) {
            const commentsToAdd = postData.comments
              .map((comment) => {
                if (
                  typeof comment === "object" &&
                  comment !== null &&
                  comment.author &&
                  comment.content
                ) {
                  return {
                    postId: postId,
                    author: comment.author,
                    content: comment.content,
                    timestamp: Date.now() + totalPosts + totalComments++,
                  };
                }
                return null;
              })
              .filter(Boolean);

            if (commentsToAdd.length > 0) {
              await db.forumComments.bulkAdd(commentsToAdd);
            }
          }
        }
        await showCustomAlert(
          "Tạo thành công!",
          `Đã tạo ${totalPosts} bài viết mới và ${totalComments} bình luận cho nhóm "${groupName}".`,
        );
        await renderGroupPosts(groupId);
      } else {
        throw new Error("AI không trả về dữ liệu hợp lệ nào.");
      }
    } catch (error) {
      console.error("生成小组内容失败:", error);
      await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    }
  }
  /**
   * 【V12 | 拆分文风与类型版】
   */
  async function generateFanfic(groupId) {
    if (!groupId) {
      console.error("generateFanfic called without a groupId!");
      alert("Lỗi nội bộ: không chỉ định được ID nhóm khi tạo truyện đồng nhân.");
      return;
    }
    const char1Name = document.getElementById("fanfic-char1-select").value;
    const char2Name = document.getElementById("fanfic-char2-select").value;

    // 获取分离后的参数
    const wordCountReq = document
      .getElementById("fanfic-wordcount-input")
      .value.trim();
    const typeReq = document.getElementById("fanfic-type-input").value.trim(); // 类型：ABO, 甜文
    const styleReq = document.getElementById("fanfic-style-input").value.trim(); // 文风：细腻, 华丽
    const worldviewPreference = document
      .getElementById("fanfic-worldview-input")
      .value.trim();
    const lengthMode = (
      document.getElementById("fanfic-length-select")?.value || "short"
    ).toLowerCase();

    if (char1Name === char2Name) {
      alert("Vui lòng chọn hai nhân vật khác nhau!");
      return;
    }

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Vui lòng cấu hình API trước!");
      return;
    }

    const allChars = getAvailableCharacters();
    const char1Data = allChars.find((c) => c.name === char1Name);
    const char2Data = allChars.find((c) => c.name === char2Name);

    let char1Persona = "";
    let char2Persona = "";

    if (char1Name === state.qzoneSettings.nickname) {
      char1Persona = state.qzoneSettings.weiboUserPersona || "Một người bình thường";
    } else {
      char1Persona =
        state.chats[char1Data.id]?.settings.aiPersona || "Một người bình thường";
    }

    if (char2Name === state.qzoneSettings.nickname) {
      char2Persona = state.qzoneSettings.weiboUserPersona || "Một người bình thường";
    } else {
      char2Persona =
        state.chats[char2Data.id]?.settings.aiPersona || "Một người bình thường";
    }
    const userPersona = state.qzoneSettings.weiboUserPersona || "Một người bình thường";

    if (lengthMode === "long") {
      await generateLongFanficSeries({
        groupId,
        char1Name,
        char2Name,
        char1Persona,
        char2Persona,
        userPersona,
        wordCountReq,
        typeReq,
        styleReq,
        worldviewPreference,
      });
      return;
    }

    await showCustomAlert(
      "Đang sáng tác...",
      `Fan đang miệt mài viết cho 【${char1Name}x${char2Name}】...`,
    );

    // 构建 Prompt
    let contextInstructions = "";

    if (typeReq)
      contextInstructions += `\n**【Yêu cầu thể loại】**: Bài viết phải thuộc thể loại 【${typeReq}】.`;
    if (styleReq)
      contextInstructions += `\n**【Văn phong/Quy chuẩn viết】**: Hãy bắt chước nghiêm ngặt nét bút và phong cách tự sự của 【${styleReq}】.`;
    if (worldviewPreference)
      contextInstructions += `\n**【Thiết lập cốt truyện/thế giới quan】**: ${worldviewPreference}`;

    let lengthInstruction = wordCountReq
      ? `Độ dài mỗi truyện cần gần 【${wordCountReq}】.`
      : "Mỗi truyện không dưới 800 từ.";

    const prompt = `
Bạn là một người viết truyện đồng nhân chuyên nghiệp. Hãy dựa vào các yêu cầu sau để sáng tác 【ba truyện】 đồng nhân về nhân vật A và nhân vật B, viết bằng tiếng Việt.

# Thông tin nhân vật
- Nhân vật A (${char1Name}): ${char1Persona}
- Nhân vật B (${char2Name}): ${char2Persona}

# Chỉ thị sáng tác cốt lõi
${contextInstructions}
${lengthInstruction}

# Yêu cầu nhiệm vụ
1.  **Sáng tác ba truyện**: phải phù hợp với thể loại và quy chuẩn văn phong ở trên.
2.  **Phân loại tự sáng tạo**: gắn 1-2 nhãn cho mỗi truyện (ví dụ: ${typeReq || "Truyện ngọt"}).
3.  **Tạo bình luận**: mô phỏng 3-5 bình luận độc giả cho mỗi truyện.
4.  **Định dạng JSON**: câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON thuần.

# Cấu trúc JSON
[
  {
"title": "tiêu đề truyện 1",
"story": "nội dung truyện 1...",
"categories": ["phân loại 1", "phân loại 2"],
    "comments": [
{"author": "Độc giả A", "content": "nội dung bình luận A..."},
{"author": "Độc giả B", "content": "nội dung bình luận B..."}
    ]
  },
  ...
]
`;

    const messagesForApi = [{ role: "user", content: prompt }];
    try {
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
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          });
      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);
      const data = await response.json();
      const rawContent = isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content;
      let stories = [];
      try {
        const cleanedContent = rawContent
          .replace(/^```json\s*|```$/g, "")
          .trim();
        stories = JSON.parse(cleanedContent);
        if (!Array.isArray(stories)) throw new Error("AI không trả về định dạng mảng.");
      } catch (e) {
        console.error("JSON解析失败！", e);
        throw new Error("AI trả về định dạng JSON không hợp lệ.");
      }
      for (let i = 0; i < stories.length; i++) {
        const storyData = stories[i];
        const baseCategories =
          storyData.categories && Array.isArray(storyData.categories)
            ? [...storyData.categories]
            : [];
        if (!baseCategories.includes("Truyện ngắn")) baseCategories.unshift("Truyện ngắn");
        const newPost = {
          groupId: groupId,
          title: `【${char1Name}x${char2Name}】${storyData.title || `Không tiêu đề`}`,
          content: storyData.story || "Tạo nội dung thất bại",
          author: getRandomItem([
            "Thái thái viết vì đam mê",
            "Tự đẩy thuyền",
            "CP là thật",
            "Đẩy thuyền đến xỉu",
            "Gù gù gù",
          ]),
          timestamp: Date.now() + i,
          categories: baseCategories,
          lengthType: "short",
          seriesId: null,
          chapterIndex: null,
        };
        const postId = await db.forumPosts.add(newPost);
        if (storyData.comments && Array.isArray(storyData.comments)) {
          const commentsToAdd = storyData.comments.map((c, idx) => ({
            postId,
            author: c.author || "Ẩn danh",
            content: c.content,
            timestamp: Date.now() + i + idx + 1,
          }));
          await db.forumComments.bulkAdd(commentsToAdd);
        }
      }
      await renderGroupPosts(groupId);
      await showCustomAlert(
        "Sáng tác xong!",
        `Đã sáng tác thành công ${stories.length} truyện đồng nhân mới cho bạn.`,
      );
    } catch (error) {
      console.error("生成同人文失败:", error);
      await showCustomAlert("Sáng tác thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    }
  }

  async function generateLongFanficSeries(options) {
    const {
      groupId,
      char1Name,
      char2Name,
      char1Persona,
      char2Persona,
      userPersona,
      wordCountReq,
      typeReq,
      styleReq,
      worldviewPreference,
    } = options;

    await showCustomAlert(
      "Đang mở hố...",
      `Đang sáng tác chương 1 của truyện dài kỳ cho 【${char1Name}x${char2Name}】...`,
    );

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Vui lòng cấu hình API trước!");
      return;
    }

    let contextInstructions = "";
    if (typeReq) contextInstructions += `- Thể loại/kiểu: ${typeReq}\n`;
    if (styleReq) contextInstructions += `- Văn phong/quy chuẩn viết: ${styleReq}\n`;
    if (worldviewPreference)
      contextInstructions += `- Thiết lập thế giới quan/cốt truyện: ${worldviewPreference}\n`;
    const lengthInstruction = wordCountReq
      ? `Độ dài chương 1 cố gắng gần 【${wordCountReq}】, cho phép xê dịch chút ít.`
      : "Chương 1 ít nhất 1200 từ, và cài cắm phục bút cho phần sau.";
    const seriesAuthor =
      getRandomItem([
        "Tác giả nhà bên",
        "Người viết Ngân Hà",
        "Thái thái ẩn danh",
        "Bút danh chưa định",
        "Người nhặt chữ",
      ]) || "Thái thái ẩn danh";

    const prompt = `
Bạn là một tác giả truyện đồng nhân dài kỳ chuyên nghiệp. Hãy sáng tác một bộ 【truyện dài kỳ】 cho nhân vật A và nhân vật B, viết trọn chương 1 trước và kèm tóm tắt ngắn để tiện viết tiếp sau này. Viết bằng tiếng Việt.

# Nhân vật và thiết lập
- Nhân vật A (${char1Name}): ${char1Persona}
- Nhân vật B (${char2Name}): ${char2Persona}
- Người dùng: ${userPersona}

# Yêu cầu viết
${contextInstructions || "- Tự do sáng tạo, nhưng giữ nhịp truyện dài kỳ, chú ý sự trưởng thành của nhân vật và yếu tố hồi hộp."}
- ${lengthInstruction}
- Chương 1 cần có xung đột mở đầu hoặc điểm hấp dẫn rõ ràng, đồng thời giữ lại manh mối chưa có lời giải.
- Bình luận: tạo 5-8 bình luận/bình luận chạy của độc giả cho chương này, ngôn ngữ tự nhiên, có cảm giác nhập tâm.

# Định dạng đầu ra (đối tượng JSON nghiêm ngặt, nhất định phải có 5-8 bình luận)
{
"seriesTitle": "tiêu đề chính của truyện dài kỳ",
"chapterTitle": "tiêu đề chương 1",
"chapterSummary": "tóm tắt chương này trong 3-5 câu, dùng làm tóm tắt gửi cho AI khi viết tiếp",
"chapterContent": "nội dung chương 1",
"categories": ["nhãn 1","nhãn 2"],
  "comments": [
{"author": "Độc giả A", "content": "bình luận ngắn hoặc bình luận chạy"},
{"author": "Độc giả B", "content": "bình luận ngắn hoặc bình luận chạy"}
  ]
}

Chỉ xuất đối tượng JSON thuần, đừng thêm giải thích.`;

    const messagesForApi = [{ role: "user", content: prompt }];
    try {
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
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          });
      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);

      const data = await response.json();
      const rawContent = isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content;
      let parsed;
      try {
        const cleanedContent = rawContent
          .replace(/^```json\s*|```$/g, "")
          .trim();
        parsed = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("解析长篇连载返回数据失败", e);
        throw new Error("AI trả về định dạng JSON không hợp lệ.");
      }

      const seriesTitle =
        parsed.seriesTitle || `Truyện dài kỳ của ${char1Name}x${char2Name}`;
      const chapterTitle = parsed.chapterTitle || "Chương 1";
      const chapterContent =
        parsed.chapterContent ||
        parsed.story ||
        parsed.content ||
        "Tạo nội dung chương này thất bại, vui lòng thử lại.";
      const chapterSummary = parsed.chapterSummary || "";
      const baseCategories = Array.isArray(parsed.categories)
        ? parsed.categories
        : [];
      const postCategories = Array.from(
        new Set(["Truyện dài", "Truyện dài kỳ", ...baseCategories]),
      );
      const timestamp = Date.now();

      const seriesId = await db.forumSeries.add({
        groupId,
        title: seriesTitle,
        pairing: `${char1Name}x${char2Name}`,
        char1Name,
        char2Name,
        char1Persona,
        char2Persona,
        userPersona,
        worldview: worldviewPreference,
        type: typeReq,
        style: styleReq,
        wordCount: wordCountReq,
        isFollowed: false,
        bookshelfAddedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastChapterIndex: 1,
        seriesAuthor,
        isFinished: false,
      });

      const postId = await db.forumPosts.add({
        groupId: groupId,
        title: `【Truyện dài kỳ】${seriesTitle} - ${chapterTitle}`,
        content: chapterContent,
        author: seriesAuthor,
        timestamp,
        categories: postCategories,
        lengthType: "long",
        seriesId,
        chapterIndex: 1,
      });

      const chapterId = await db.forumChapters.add({
        seriesId,
        chapterIndex: 1,
        title: chapterTitle,
        summary: chapterSummary,
        content: chapterContent,
        createdAt: timestamp,
        postId,
      });

      await db.forumSeries.update(seriesId, {
        lastChapterId: chapterId,
        firstChapterId: chapterId,
      });

      if (parsed.comments && Array.isArray(parsed.comments)) {
        const commentsToAdd = parsed.comments
          .filter((c) => c && c.content)
          .map((c, idx) => ({
            postId,
            author: c.author || "Người qua đường",
            content: c.content,
            timestamp: timestamp + idx + 1,
          }));
        if (commentsToAdd.length > 0) {
          await db.forumComments.bulkAdd(commentsToAdd);
        }
      }

      await renderGroupPosts(groupId);
      await showCustomAlert(
        "Sáng tác xong!",
        `Đã tạo chương 1 của truyện dài kỳ 《${seriesTitle}》, mở bài viết là có thể theo dõi truyện.`,
      );
    } catch (error) {
      console.error("生成长篇连载失败:", error);
      await showCustomAlert("Sáng tác thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    }
  }

  async function generateSeriesShareSummary(series, chapters, latestChapter) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      return {
        summary: series.worldview || "Đây là một câu chuyện đang được đăng dài kỳ.",
        highlights: [],
        latestExcerpt: (latestChapter.content || "").slice(0, 120),
      };
    }

    const chapterSummaries = chapters
      .map(
        (ch) =>
          `Tóm tắt chương ${ch.chapterIndex} 《${ch.title || ""}》: ${ch.summary || (ch.content || "").slice(0, 80)}`,
      )
      .join("\n");
    const latestContent = (latestChapter.content || "").slice(0, 1500);

    const prompt = `
Bạn là một trợ lý biên tập ngắn gọn, hãy tạo thông tin chia sẻ cho truyện dài kỳ dưới đây, xuất JSON nghiêm ngặt:
{
"summary": "tóm tắt tiếng Việt 120-180 từ, khái quát toàn bộ cốt truyện và tông giọng",
"highlights": ["điểm nhấn 1","điểm nhấn 2","điểm nhấn 3"],
"latestExcerpt": "trích đoạn 80-120 từ từ chương mới nhất, giữ giọng văn gốc"
}

# Thông tin truyện dài kỳ
Tiêu đề: ${series.title || series.pairing || "Truyện dài kỳ chưa đặt tên"}
CP：${series.pairing || `${series.char1Name || ""}x${series.char2Name || ""}`}
Trạng thái: ${series.isFinished ? "Đã hoàn thành" : "Đang ra"}, tổng ${chapters.length} chương

# Tóm tắt lịch sử
${chapterSummaries || "Chưa có tóm tắt"}

# Chương mới nhất
Tiêu đề: ${latestChapter.title || "Chương chưa đặt tên"}
Nội dung (đã cắt ngắn): ${latestContent}
Chỉ xuất JSON.`;

    const messagesForApi = [{ role: "user", content: prompt }];
    try {
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
              temperature: parseFloat(state.apiConfig.temperature) || 0.5,
              response_format: { type: "json_object" },
            }),
          });
      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);
      const data = await response.json();
      const rawContent = isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content;
      const cleaned = rawContent.replace(/^```json\s*|```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        summary:
          parsed.summary || series.worldview || "Đây là một câu chuyện đang được đăng dài kỳ.",
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        latestExcerpt: parsed.latestExcerpt || latestContent.slice(0, 120),
      };
    } catch (e) {
      console.error("生成分享摘要失败", e);
      return {
        summary: series.worldview || "Đây là một câu chuyện đang được đăng dài kỳ.",
        highlights: [],
        latestExcerpt: latestContent.slice(0, 120),
      };
    }
  }

  async function shareSeriesToChat(seriesId) {
    const series = await db.forumSeries.get(seriesId);
    if (!series) {
      alert("Không tìm thấy sách/truyện dài kỳ này");
      return;
    }
    const chapters = await db.forumChapters
      .where("seriesId")
      .equals(seriesId)
      .sortBy("chapterIndex");
    if (!chapters.length) {
      alert("Truyện dài kỳ này chưa có chương nào, không thể chia sẻ");
      return;
    }
    const latestChapter = chapters[chapters.length - 1];

    const summaryData = await generateSeriesShareSummary(
      series,
      chapters,
      latestChapter,
    );

    const targetChat = await selectShareTarget(
      "Chia sẻ sách tới...",
      "series-share-target",
    );
    if (!targetChat) return;

    const statusText = series.isFinished ? "Đã hoàn thành" : "Đang ra";
    const highlightsText =
      summaryData.highlights && summaryData.highlights.length
        ? `\nĐiểm nhấn:\n${summaryData.highlights.map((h) => `- ${h}`).join("\n")}`
        : "";
    const messageContent = `【Chia sẻ truyện dài kỳ】${series.title || series.pairing || "Truyện dài kỳ chưa đặt tên"}\nCP: ${series.pairing || ""}\nTrạng thái: ${statusText} | Tổng ${chapters.length} chương\nMới nhất: Chương ${latestChapter.chapterIndex} ${latestChapter.title || ""}\n\nTóm tắt: ${summaryData.summary}${highlightsText}\n\nToàn văn chương mới nhất:\n${latestChapter.content || ""}`;

    const userMessage = {
      role: "user",
      senderName: targetChat.isGroup
        ? targetChat.settings.myNickname || "Tôi"
        : "Tôi",
      type: "series_share",
      timestamp: Date.now(),
      content: messageContent,
      payload: {
        seriesId,
        latestPostId: latestChapter.postId,
        latestChapterIndex: latestChapter.chapterIndex,
        latestTitle: latestChapter.title,
        summary: summaryData.summary,
        highlights: summaryData.highlights || [],
        seriesTitle: series.title || series.pairing || "Truyện dài kỳ chưa đặt tên",
        pairing:
          series.pairing ||
          `${series.char1Name || ""}x${series.char2Name || ""}`,
        statusText,
        chapterCount: chapters.length,
      },
    };
    targetChat.history.push(userMessage);

    const hiddenInstruction = {
      role: "system",
      isHidden: true,
      timestamp: Date.now() + 1,
      content: `[Chỉ thị hệ thống] Hãy đọc thông tin truyện dài kỳ người dùng chia sẻ, và dựa vào tóm tắt cùng trích đoạn chương mới nhất để đưa ra nhận xét/góp ý của bạn. Trạng thái truyện: ${statusText}.`,
    };
    targetChat.history.push(hiddenInstruction);

    await db.chats.put(targetChat);
    await showCustomAlert(
      "Chia sẻ thành công",
      `Đã chia sẻ 《${series.title || "Bộ truyện dài kỳ này"}》 cho "${targetChat.name}".`,
    );
    openChat(targetChat.id);
    triggerAiResponse();
  }

  // ▼▼▼ 用这个【V2版】替换旧的 openCreateForumPostModal 函数 ▼▼▼
  /**
   * 打开创建帖子的模态框
   */
  async function openCreateForumPostModal() {
    resetCreatePostModal();
    const modal = document.getElementById("create-post-modal");
    modal.dataset.mode = "forum";
    document.getElementById("create-post-modal-title").textContent =
      "Đăng bài viết mới";
    document.getElementById("post-public-text").placeholder =
      "Nhập nội dung bài viết...";

    // 隐藏所有不需要的控件
    modal.querySelector(".post-mode-switcher").style.display = "none";
    modal.querySelector("#image-mode-content").style.display = "none";
    modal.querySelector("#text-image-mode-content").style.display = "none";
    modal.querySelector("#post-comments-toggle-group").style.display = "none";
    modal.querySelector("#post-visibility-group").style.display = "none";

    const publicTextGroup =
      document.getElementById("post-public-text").parentElement;

    // --- 动态添加或显示“标题”输入框 ---
    let titleGroup = document.getElementById("forum-post-title-group");
    if (!titleGroup) {
      titleGroup = document.createElement("div");
      titleGroup.className = "form-group";
      titleGroup.id = "forum-post-title-group";
      titleGroup.innerHTML = `
            <label for="forum-post-title-input">Tiêu đề</label>
<input type="text" id="forum-post-title-input" placeholder="Nhập tiêu đề bài viết...">
        `;
      publicTextGroup.parentNode.insertBefore(titleGroup, publicTextGroup);
    }
    document.getElementById("forum-post-title-input").value = "";

    // --- ▼▼▼ 【核心新增】动态添加“分类”输入框 ▼▼▼ ---
    let categoryGroup = document.getElementById("forum-post-category-group");
    if (!categoryGroup) {
      categoryGroup = document.createElement("div");
      categoryGroup.className = "form-group";
      categoryGroup.id = "forum-post-category-group";
      categoryGroup.innerHTML = `
            <label for="forum-post-category-input">Phân loại bài viết (cách nhau bằng dấu #)</label>
<input type="text" id="forum-post-category-input" placeholder="Ví dụ: #ThaoLuanCotTruyen #PhanTichNhanVat">
        `;
      // 将分类输入框插入到“内容”输入框之后
      publicTextGroup.parentNode.insertBefore(
        categoryGroup,
        publicTextGroup.nextSibling,
      );
    }
    document.getElementById("forum-post-category-input").value = "";
    // --- ▲▲▲ 新增结束 ▲▲▲ ---

    modal.classList.add("visible");
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【修改点 2】发布帖子时，使用全局变量 ▼▼▼
  async function handleCreateForumPost() {
    const title = document
      .getElementById("forum-post-title-input")
      .value.trim();
    const content = document.getElementById("post-public-text").value.trim();
    if (!title || !content) {
      alert("Tiêu đề và nội dung bài viết đều không được để trống nhé!");
      return;
    }

    const categoryInput = document
      .getElementById("forum-post-category-input")
      .value.trim();
    const categories = categoryInput
      ? categoryInput.match(/#(\S+)/g)?.map((tag) => tag.substring(1)) || []
      : [];

    const newPost = {
      groupId: window.activeGroupId, // 【修改】这里必须用 window.activeGroupId
      title: title,
      content: content,
      author: state.qzoneSettings.nickname || "Tôi",
      timestamp: Date.now(),
      categories: categories,
      lengthType: "short",
      seriesId: null,
      chapterIndex: null,
    };

    // 1. 将数据库 add() 操作返回的【ID】捕获到一个变量中。
    const postId = await db.forumPosts.add(newPost);
    // 2. 将这个ID赋值回我们的 newPost 对象
    newPost.id = postId;

    // 3. 关闭发帖弹窗。
    document.getElementById("create-post-modal").classList.remove("visible");

    // 4. 将新帖子显示在列表顶部
    prependNewPostElement(newPost);

    // 5. 给出成功提示。
    alert("Đăng bài thành công!");
  }
  window.handleCreateForumPost = handleCreateForumPost;
  /**
   * 删除一个小组及其所有内容
   */
  async function deleteGroupAndPosts(groupId) {
    const group = await db.forumGroups.get(groupId);
    if (!group) return;
    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa nhóm "${group.name}"? Thao tác này sẽ xóa luôn 【toàn bộ bài viết và bình luận】 trong nhóm, và không thể khôi phục!`,
      { confirmButtonClass: "btn-danger" },
    );
    if (confirmed) {
      try {
        const postsToDelete = await db.forumPosts
          .where("groupId")
          .equals(groupId)
          .toArray();
        const postIds = postsToDelete.map((p) => p.id);
        if (postIds.length > 0) {
          await db.forumComments.where("postId").anyOf(postIds).delete();
        }
        await db.forumPosts.where("groupId").equals(groupId).delete();
        await db.forumGroups.delete(groupId);
        await renderForumScreen();
        alert(`Đã xóa nhóm "${group.name}" cùng toàn bộ nội dung.`);
      } catch (error) {
        console.error("删除小组时出错:", error);
        alert(`Xóa thất bại: ${error.message}`);
      }
    }
  }

  /**
   * 【全能转发版】"转载"功能：将帖子内容分享到单聊或群聊
   */
  async function repostToChat() {
    if (!activeForumPostId) return;
    const post = await db.forumPosts.get(activeForumPostId);
    if (!post) {
      alert("Không tìm thấy bài viết cần đăng lại!");
      return;
    }

    const targetChat = await selectShareTarget(
      "Đăng lại bài viết tới...",
      "repost-target",
    );
    if (!targetChat) return;
    const targetChatId = targetChat.id;

    const myNickname = targetChat.isGroup
      ? targetChat.settings.myNickname || "Tôi"
      : "Tôi";

    // 1. 创建对用户可见的转载卡片消息
    const repostMessage = {
      role: "user",
      senderName: myNickname, // 确保群聊里显示正确的发送者名字
      type: "repost_forum_post",
      timestamp: Date.now(),
      content: `[Bài viết được đăng lại]\nID là ${post.id}\nTiêu đề: 《${post.title}》\nTác giả: ${post.author}\nNội dung: ${post.content}\nHãy bình luận về bài viết này.`,
      payload: {
        postId: post.id,
        title: post.title,
        author: post.author,
        content: post.content.substring(0, 100) + "...",
      },
    };
    targetChat.history.push(repostMessage);

    // 2. 创建给【AI看】的隐藏指令
    // 注意：这里稍微修改了提示词，以适应群聊场景（群聊AI会自动决定谁来回复）
    const instructionContent = targetChat.isGroup
      ? `[Chỉ thị hệ thống: người dùng (${myNickname}) vừa đăng lại vào nhóm một bài viết của hội nhóm có ID 【${post.id}】, nội dung như sau. Các thành viên trong nhóm 【bắt buộc】 đọc bài viết này, và dựa vào thiết lập riêng dùng chỉ thị 'forum_comment' để bình luận hoặc thảo luận về bài viết.]\n\n--- Bắt đầu bài viết ---\nTiêu đề: ${post.title}\nTác giả: ${post.author}\nNội dung: ${post.content}\n--- Kết thúc bài viết ---`
      : `[Chỉ thị hệ thống: người dùng vừa chia sẻ cho bạn một bài viết của hội nhóm có ID 【${post.id}】, nội dung như sau. Nhiệm vụ của bạn là 【bắt buộc】 bình luận về bài viết này. Hãy 【ngay lập tức】 dùng chỉ thị 'forum_comment' để hoàn thành nhiệm vụ, và đảm bảo trong chỉ thị có đúng "postId": ${post.id}.]\n\n--- Bắt đầu bài viết ---\nTiêu đề: ${post.title}\nTác giả: ${post.author}\nNội dung: ${post.content}\n--- Kết thúc bài viết ---`;

    const hiddenInstructionMessage = {
      role: "system",
      content: instructionContent,
      timestamp: Date.now() + 1,
      isHidden: true,
    };
    targetChat.history.push(hiddenInstructionMessage);

    // 3. 保存、关闭弹窗、跳转
    await db.chats.put(targetChat);

    await showCustomAlert(
      "Đăng lại thành công",
      `Đã đăng lại bài viết cho "${targetChat.name}" thành công!`,
    );

    // 跳转到对应的聊天界面
    openChat(targetChatId);
    // 自动触发AI响应（对于群聊，这会触发群友讨论帖子）
    triggerAiResponse();
  }
  // --- 同人文预设与UI逻辑 ---

  // 初始化/加载同人文预设
  async function loadFanficPresets() {
    const select = document.getElementById("fanfic-preset-select");
    select.innerHTML = '<option value="">-- Chọn preset --</option>';

    // 确保全局设置里有这个字段
    if (!state.globalSettings.fanficPresets) {
      state.globalSettings.fanficPresets = [];
    }

    state.globalSettings.fanficPresets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = index; // 使用索引作为 value
      option.textContent = preset.name;
      select.appendChild(option);
    });
  }

  async function saveCurrentFanficPreset() {
    const name = await showCustomPrompt("Lưu preset", "Hãy đặt tên cho cấu hình hiện tại:");
    if (!name) return;

    const preset = {
      name: name.trim(),
      char1: document.getElementById("fanfic-char1-select").value,
      char2: document.getElementById("fanfic-char2-select").value,
      wordCount: document.getElementById("fanfic-wordcount-input").value,
      type: document.getElementById("fanfic-type-input").value, // 新增：类型
      style: document.getElementById("fanfic-style-input").value, // 新增：文风
      worldview: document.getElementById("fanfic-worldview-input").value,
    };

    if (!state.globalSettings.fanficPresets)
      state.globalSettings.fanficPresets = [];
    state.globalSettings.fanficPresets.push(preset);

    await db.globalSettings.put(state.globalSettings);
    await loadFanficPresets();

    document.getElementById("fanfic-preset-select").value =
      state.globalSettings.fanficPresets.length - 1;
    alert("Lưu preset thành công!");
  }

  function applyFanficPreset() {
    const index = document.getElementById("fanfic-preset-select").value;
    if (index === "") return;

    const preset = state.globalSettings.fanficPresets[index];
    if (preset) {
      document.getElementById("fanfic-char1-select").value = preset.char1;
      document.getElementById("fanfic-char2-select").value = preset.char2;
      document.getElementById("fanfic-wordcount-input").value =
        preset.wordCount || "";
      document.getElementById("fanfic-type-input").value = preset.type || ""; // 回填类型
      document.getElementById("fanfic-style-input").value = preset.style || ""; // 回填文风
      document.getElementById("fanfic-worldview-input").value =
        preset.worldview || "";
    }
  }

  // 删除选中的预设
  async function deleteFanficPreset() {
    const index = document.getElementById("fanfic-preset-select").value;
    if (index === "") return;

    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      "Bạn có chắc muốn xóa preset này?",
    );
    if (confirmed) {
      state.globalSettings.fanficPresets.splice(index, 1);
      await db.globalSettings.put(state.globalSettings);
      await loadFanficPresets();

      // 清空输入框
      document.getElementById("fanfic-wordcount-input").value = "";
      document.getElementById("fanfic-style-input").value = "";
      document.getElementById("fanfic-worldview-input").value = "";
    }
  }

  // 切换折叠状态
  function toggleFanficBar() {
    const content = document.getElementById("fanfic-bar-content");
    const icon = document.getElementById("fanfic-bar-toggle-icon");

    if (content.classList.contains("collapsed")) {
      content.classList.remove("collapsed");
      icon.classList.remove("collapsed");
    } else {
      content.classList.add("collapsed");
      icon.classList.add("collapsed");
    }
  }

  /**
   * 打开小组编辑器 (已升级：支持图片URL)
   */
  async function openGroupEditor(groupId) {
    editingGroupId = groupId;
    const group = await db.forumGroups.get(groupId);
    if (!group) return;

    document.getElementById("group-editor-name-input").value = group.name;
    document.getElementById("group-editor-desc-input").value =
      group.description;

    // ★★★ 修改：获取图标输入框，并修改 placeholder 提示 ★★★
    const iconInput = document.getElementById("group-editor-icon-input");
    iconInput.value = group.icon;
    // 修改输入框上方的 label 文字（通过修改 DOM 或设置 placeholder）
    iconInput.placeholder = "Nhập link ảnh (URL) hoặc Emoji";
    // 找到它前面的 label 元素并修改文字
    const iconLabel = document.querySelector(
      'label[for="group-editor-icon-input"]',
    );
    if (iconLabel) iconLabel.textContent = "Ảnh bìa nhóm (URL ảnh / Emoji)";

    document.getElementById("group-editor-worldview-input").value =
      group.worldview || "";

    const categoriesString = (group.categories || [])
      .map((c) => `#${c}`)
      .join(" ");
    document.getElementById("group-editor-categories-input").value =
      categoriesString;

    document
      .getElementById("forum-group-editor-modal")
      .classList.add("visible");
  }

  /**
   * 保存对小组信息的修改
   */
  async function saveGroupSettings() {
    if (!editingGroupId) return;

    const name = document
      .getElementById("group-editor-name-input")
      .value.trim();
    if (!name) {
      alert("Tên nhóm không được để trống!");
      return;
    }

    const description = document
      .getElementById("group-editor-desc-input")
      .value.trim();
    const icon = document
      .getElementById("group-editor-icon-input")
      .value.trim();
    const worldview = document
      .getElementById("group-editor-worldview-input")
      .value.trim();
    const categoriesInput = document
      .getElementById("group-editor-categories-input")
      .value.trim();
    // 解析分类字符串
    const categories = categoriesInput
      ? categoriesInput.match(/#(\S+)/g)?.map((tag) => tag.substring(1)) || []
      : [];

    await db.forumGroups.update(editingGroupId, {
      name,
      description,
      icon,
      worldview,
      categories,
    });

    document
      .getElementById("forum-group-editor-modal")
      .classList.remove("visible");
    await renderForumScreen();
    alert("Đã cập nhật thông tin nhóm!");
  }

  /**
   * 打开分类管理弹窗
   */
  async function openForumCategoryManager() {
    await renderForumCategoryList();
    document
      .getElementById("forum-category-manager-modal")
      .classList.add("visible");
  }

  /**
   * 在弹窗中渲染分类列表
   */
  async function renderForumCategoryList() {
    const listEl = document.getElementById("existing-forum-categories-list");
    const categories = await db.forumCategories.toArray();
    listEl.innerHTML = "";
    if (categories.length === 0) {
      listEl.innerHTML =
        '<p style="text-align: center; color: var(--text-secondary);">Chưa có phân loại nào</p>';
    }
    categories.forEach((cat) => {
      const item = document.createElement("div");
      item.className = "existing-group-item";
      item.innerHTML = `
            <span class="group-name">${cat.name}</span>
            <span class="delete-group-btn" data-id="${cat.id}">×</span>
        `;
      listEl.appendChild(item);
    });
  }

  /**
   * 添加一个新的圈子分类
   */
  async function addNewForumCategory() {
    const input = document.getElementById("new-forum-category-name-input");
    const name = input.value.trim();
    if (!name) {
      alert("Tên phân loại không được để trống!");
      return;
    }
    const existing = await db.forumCategories
      .where("name")
      .equals(name)
      .first();
    if (existing) {
      alert(`Phân loại "${name}" đã tồn tại!`);
      return;
    }
    await db.forumCategories.add({ name });
    input.value = "";
    await renderForumCategoryList();
  }

  /**
   * 删除一个圈子分类
   */
  async function deleteForumCategory(categoryId) {
    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      "Bạn có chắc muốn xóa phân loại này?",
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      await db.forumCategories.delete(categoryId);
      await renderForumCategoryList();
    }
  }
  async function openGroupCreator() {
    const name = await showCustomPrompt("Tạo nhóm mới", "Nhập tên nhóm:");
    if (!name || !name.trim()) {
      if (name !== null) alert("Tên nhóm không được để trống!");
      return;
    }

    const desc = await showCustomPrompt("Mô tả nhóm", "Viết một câu giới thiệu cho nhóm của bạn nhé:");
    if (desc === null) return;

    // ★★★ 修改：提示输入 URL ★★★
    const icon = await showCustomPrompt(
      "Ảnh bìa nhóm",
      "Nhập link ảnh (URL):\n(để trống thì dùng biểu tượng mặc định)",
      "",
      "url",
    );
    if (icon === null) return;

    try {
      const newGroup = {
        name: name.trim(),
        description: desc.trim(),
        icon: icon.trim(), // 存入URL
      };
      await db.forumGroups.add(newGroup);
      await renderForumScreen();
      alert(`Đã tạo nhóm "${name.trim()}" thành công!`);
    } catch (error) {
      console.error("创建小组失败:", error);
      alert(`Tạo thất bại: ${error.message}`);
    }
  }

  /**
   * 【全新】删除一个小组
   * @param {number} groupId - 要删除的小组的ID
   */
  async function deleteGroupAndPosts(groupId) {
    const group = await db.forumGroups.get(groupId);
    if (!group) return;

    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa nhóm "${group.name}"? Thao tác này sẽ xóa luôn 【toàn bộ bài viết và bình luận】 trong nhóm, và không thể khôi phục!`,
      { confirmButtonClass: "btn-danger" },
    );

    if (confirmed) {
      try {
        // 1. 找到该小组下的所有帖子
        const postsToDelete = await db.forumPosts
          .where("groupId")
          .equals(groupId)
          .toArray();
        const postIds = postsToDelete.map((p) => p.id);

        // 2. 如果有帖子，就找到这些帖子下的所有评论并删除
        if (postIds.length > 0) {
          await db.forumComments.where("postId").anyOf(postIds).delete();
        }

        // 3. 删除所有帖子
        await db.forumPosts.where("groupId").equals(groupId).delete();

        // 4. 最后删除小组本身
        await db.forumGroups.delete(groupId);

        await renderForumScreen(); // 刷新列表
        alert(`Đã xóa nhóm "${group.name}" cùng toàn bộ nội dung.`);
      } catch (error) {
        console.error("删除小组时出错:", error);
        alert(`Xóa thất bại: ${error.message}`);
      }
    }
  }
  // ▼▼▼ 用这块【V4 | 最终分类版】代码，完整替换旧的 generateEntertainmentGroupContent 函数 ▼▼▼

  // ▼▼▼ 用这块【V5 | 最终原创分类版】代码，完整替换旧的 generateEntertainmentGroupContent 函数 ▼▼▼

  /**
   * 【AI核心 - 娱乐小组 V5 | 最终原创分类版】
   */
  async function generateEntertainmentGroupContent(groupId) {
    if (!groupId) return;

    await showCustomAlert("Vui lòng chờ...", "Nhóm giải trí đang họp khẩn bàn về hot mới nhất...");

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Hãy cấu hình xong trong Cài đặt API mới tạo được nội dung nhé!");
      return;
    }

    const publicFigures = Object.values(state.chats)
      .filter((c) => !c.isGroup)
      .map((c) => ({
        name: c.name,
        profession: c.settings.weiboProfession || "Nghệ sĩ",
        persona: (
          c.settings.weiboInstruction || c.settings.aiPersona
        ).substring(0, 150),
      }));

    let topicsContext = "";
    if (weiboHotSearchCache && weiboHotSearchCache.length > 0) {
      topicsContext = `Hãy thảo luận xoay quanh 【các chủ đề hot search Weibo mới nhất hiện tại】 sau:\n${weiboHotSearchCache
        .map((t) => `- ${t.topic}`)
        .join("\n")}`;
    } else {
      topicsContext = `Hãy dựa vào 【nghề nghiệp và thiết lập】 của từng nhân vật trong "Danh sách người của công chúng" bên dưới, tạo ra một số tin tức giải trí hoặc sự kiện tin đồn hợp thân phận, có khả năng gây bàn tán làm chủ đề thảo luận.`;
    }

    // --- ▼▼▼ 【核心修改】彻底重写Prompt指令 ---
    const prompt = `
# Nhiệm vụ
Bạn là một "trình mô phỏng thành viên kỳ cựu của hội nhóm giải trí Douban" chuyên nghiệp. Nhiệm vụ của bạn là dựa vào một chủ đề giải trí đang hot, tạo 5 bài viết và các bình luận tương ứng, mô phỏng không khí thảo luận chân thật trong nhóm. Viết tất cả bằng tiếng Việt.

# Chủ đề thảo luận hiện tại
${topicsContext}

# Quy tắc cốt lõi
1.  **Quy tắc sắt về phong cách hội nhóm**: Tiêu đề, nội dung và bình luận của mọi bài viết đều 【bắt buộc】 mang đúng phong cách "hội nhóm hóng biến".
2.  **【【【Quy tắc sắt về phân loại】】】**: Bạn 【bắt buộc】 phải dựa vào nội dung tin đồn của từng bài để 【tự sáng tạo】 1-2 nhãn phân loại liên quan mật thiết. Tuyệt đối không dùng danh sách có sẵn nào. Ví dụ, nếu bài viết về chuyện tình cảm, phân loại có thể là ["Biến tình cảm"].
3.  **Quy tắc sắt về nhập vai**: Nội dung bài viết bạn tạo có thể 【thảo luận hoặc nhắc tới】 những người của công chúng bên dưới, nhưng 【không được đóng vai họ】 tự đăng bài. Mọi bài viết đều phải từ góc nhìn người qua đường.
4.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, gồm 5 đối tượng bài viết. Mỗi đối tượng 【bắt buộc】 có các trường "author", "title", "content", "categories" và "comments".
- Trường "categories" 【bắt buộc】 là mảng phân loại bạn tự sáng tạo cho bài này.

# Danh sách người của công chúng (họ là đối tượng được bàn tán, không phải người đăng bài)
${JSON.stringify(publicFigures, null, 2)}

# Ví dụ định dạng đầu ra JSON:
[
  {
    "author": "momo",
"title": "Không biết thì hỏi, bộ phim đang hot search dạo này có hay thật không?",
"content": "Ngày nào lướt trang chủ cũng thấy, hơi tò mò mà lại sợ dính phim dở...",
"categories": ["Bàn phim mới"],
    "comments": [
{"author": "Tài khoản đã xóa", "content": "Không hay đâu, đừng xem."}
    ]
  }
]
`;
    // --- ▲▲▲ 更新结束 ▲▲▲ ---

    const messagesForApi = [{ role: "user", content: prompt }];

    try {
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
      const newPostsData = JSON.parse(cleanedContent);

      if (Array.isArray(newPostsData) && newPostsData.length > 0) {
        let totalPosts = 0;
        let totalComments = 0;
        for (const postData of newPostsData) {
          // --- ▼▼▼ 【核心新增】保存分类数据 ---
          const newPost = {
            groupId: groupId,
            title: postData.title,
            content: postData.content,
            author: postData.author,
            timestamp: Date.now() + totalPosts,
            categories: postData.categories || [], // 保存分类
          };
          // --- ▲▲▲ 新增结束 ▲▲▲ ---

          const postId = await db.forumPosts.add(newPost);
          totalPosts++;

          if (postData.comments && Array.isArray(postData.comments)) {
            const commentsToAdd = postData.comments.map((comment) => ({
              postId: postId,
              author: comment.author,
              content: comment.content,
              timestamp: Date.now() + totalPosts + totalComments++,
            }));
            if (commentsToAdd.length > 0) {
              await db.forumComments.bulkAdd(commentsToAdd);
            }
          }
        }
        await renderGroupPosts(groupId);
        await showCustomAlert(
          "Tạo thành công!",
          `Đã tạo ${totalPosts} bài viết mới và ${totalComments} bình luận cho nhóm giải trí.`,
        );
      } else {
        throw new Error("Dữ liệu AI trả về sai định dạng.");
      }
    } catch (error) {
      console.error("生成娱乐小组内容失败:", error);
      await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 用这块【V4 | 最终原创分类版】代码，完整替换旧的 generateDreamPost 函数 ▼▼▼

  /**
   * 【全新修正版 | V4】为“梦角小组”生成专属帖子的核心函数
   */
  async function generateDreamPost(groupId) {
    await showCustomAlert("Vui lòng chờ...", "Đang dệt một giấc mơ ngọt ngào cho user...");

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      alert("Hãy cấu hình xong trong Cài đặt API mới tạo được nội dung nhé!");
      return;
    }

    const allChars = Object.values(state.chats).filter((c) => !c.isGroup);
    if (allChars.length === 0) {
      alert("Chưa có nhân vật nào, không thể đăng giấc mơ.");
      return;
    }

    const postingChar = allChars[Math.floor(Math.random() * allChars.length)];
    const userPersona = state.qzoneSettings.persona || "Một người bình thường, dịu dàng.";
    const userNickname = state.qzoneSettings.nickname || "{{user}}";

    // --- ▼▼▼ 【核心修改】彻底重写Prompt指令 ---
    const prompt = `
# Nhiệm vụ: Nhập vai và sáng tác bài viết (kèm bình luận và phân loại)
Bây giờ bạn 【chính là】 nhân vật "${postingChar.name}". Bạn đang ở trong một diễn đàn bí mật tên là "Nhóm nhân vật trong mơ".
Nhóm này là nơi các nhân vật như các bạn lén khoe khoang, tâm sự với nhau về tình yêu và những mộng tưởng dành cho người yêu chung của các bạn — người dùng "${userNickname}".

# Quy tắc cốt lõi
1.  **Góc nhìn ngôi thứ nhất**: Bạn 【bắt buộc】 dùng góc nhìn ngôi thứ nhất của nhân vật "${postingChar.name}" để viết nội dung bài.
2.  **Chủ đề bài viết**: Nội dung bài viết là lời bày tỏ tình yêu hoặc mộng tưởng của bạn dành cho người yêu "${userNickname}".
3.  **【【【Quy tắc sắt về phân loại】】】**: Bạn 【bắt buộc】 dựa vào nội dung cụ thể của giấc mơ để 【tự sáng tạo】 1-2 nhãn phân loại liên quan mật thiết cho bài này. Tuyệt đối không dùng danh sách có sẵn nào. Ví dụ, nếu nội dung là thường ngày ngọt ngào, phân loại có thể là ["Thường ngày ngọt ngào"].
4.  **Tạo bình luận**: Sau khi viết xong bài, bạn còn cần lập tức chuyển sang góc nhìn của "các thành viên khác trong nhóm" để tạo 【2-3】 bình luận hợp tình huống cho bài này.
5.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, có các trường "title", "content", "categories" và "comments". Viết bằng tiếng Việt.
- Trường "categories" 【bắt buộc】 là mảng phân loại bạn tự sáng tạo cho bài này.

# Thông tin của bạn
-   Tên của bạn: ${postingChar.name}
-   Thiết lập nhân vật của bạn: ${postingChar.settings.aiPersona}

# Thông tin người yêu của bạn
-   Tên người yêu: ${userNickname}
-   Thiết lập của người yêu: ${userPersona}

# Ví dụ định dạng đầu ra JSON:
{
"title": "Về thói quen nhỏ lúc ngủ của người ấy",
"content": "Lén kể mọi người nghe nè, ${userNickname} lúc ngủ thích ôm một góc gối...",
"categories": ["Thường ngày ngọt ngào", "Thói quen nhỏ"],
  "comments": [
{"author": "Người qua đường A", "content": "Oa, ngọt quá!"}
  ]
}
`;
    // --- ▲▲▲ 更新结束 ▲▲▲ ---

    const messagesForApi = [{ role: "user", content: prompt }];

    try {
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
      const postData = JSON.parse(cleanedContent);

      if (postData.title && postData.content) {
        // --- ▼▼▼ 【核心新增】保存分类数据 ---
        const newPost = {
          groupId: groupId,
          title: postData.title,
          content: postData.content,
          author: postingChar.name,
          timestamp: Date.now(),
          categories: postData.categories || [], // 保存分类
        };
        // --- ▲▲▲ 新增结束 ▲▲▲ ---

        const postId = await db.forumPosts.add(newPost);

        if (postData.comments && Array.isArray(postData.comments)) {
          const commentsToAdd = postData.comments.map((c, i) => ({
            postId,
            author: c.author,
            content: c.content,
            timestamp: Date.now() + i + 1,
          }));
          await db.forumComments.bulkAdd(commentsToAdd);
        }

        await renderGroupPosts(groupId);
        await showCustomAlert(
          "Đăng thành công!",
          `"${postingChar.name}" đã đăng một giấc mơ mới.`,
        );
      } else {
        throw new Error("Dữ liệu AI trả về sai định dạng.");
      }
    } catch (error) {
      console.error("生成梦角帖子失败:", error);
      await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 用这块【已修复】的代码，完整替换你旧的 openForumFilterModal 函数 ▼▼▼
  /**
   * 【总入口】打开分类筛选模态框 (V3 - 已分离小组和帖子的分类)
   * @param {'global' | 'group'} type - 筛选类型：'global'为主页筛选小组，'group'为小组内筛选帖子
   * @param {number|null} id - 如果是小组内筛选，则为小组的ID
   */
  async function openForumFilterModal(type, id = null) {
    currentFilterContext = { type, id };
    const modal = document.getElementById("forum-filter-modal");
    const listEl = document.getElementById("forum-filter-category-list");
    listEl.innerHTML = "";

    // --- ▼▼▼ 核心修正：根据上下文，从不同的地方收集分类 ▼▼▼ ---
    let availableCategories = new Set(); // 使用Set来自动去重

    try {
      if (type === "global") {
        // 如果是在“圈子”主页，我们只关心【小组】的分类
        console.log("正在为小组列表收集分类...");
        const allGroups = await db.forumGroups.toArray();
        allGroups.forEach((group) => {
          if (group.categories) {
            group.categories.forEach((cat) => availableCategories.add(cat));
          }
        });
      } else if (type === "group" && id) {
        // 如果是在具体的“小组”页面，我们只关心该小组下【帖子】的分类
        console.log(`正在为小组 ID: ${id} 的帖子列表收集分类...`);
        const postsInGroup = await db.forumPosts
          .where("groupId")
          .equals(id)
          .toArray();
        postsInGroup.forEach((post) => {
          if (post.categories) {
            post.categories.forEach((cat) => availableCategories.add(cat));
          }
        });
      }
    } catch (error) {
      console.error("收集分类标签时出错:", error);
    }
    // --- ▲▲▲ 修复结束 ▲▲▲ ---

    const categoryArray = Array.from(availableCategories).sort(); // 转换为数组并排序

    if (categoryArray.length === 0) {
      listEl.innerHTML =
        '<p style="color: var(--text-secondary); padding: 20px;">Hiện không có nhãn phân loại nào khả dụng.</p>';
    } else {
      const activeFilters =
        type === "global"
          ? activeForumFilters.global
          : activeForumFilters.group[id] || [];

      categoryArray.forEach((catName, index) => {
        const isChecked = activeFilters.includes(catName);
        const label = document.createElement("label");
        const inputId = `filter-cat-${type}-${index}`; // 创建唯一的ID
        label.setAttribute("for", inputId);
        label.innerHTML = `
                <input type="checkbox" id="${inputId}" value="${catName}" ${isChecked ? "checked" : ""}>
                <span>${catName}</span>
            `;
        listEl.appendChild(label);
      });
    }

    modal.classList.add("visible");
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 应用筛选条件并刷新列表
   */
  async function applyForumFilter() {
    const { type, id } = currentFilterContext;
    const selectedCategories = Array.from(
      document.querySelectorAll("#forum-filter-category-list input:checked"),
    ).map((cb) => cb.value);

    const filterBtnId =
      type === "global" ? "forum-filter-btn" : "group-filter-btn";
    const filterBtn = document.getElementById(filterBtnId);

    if (type === "global") {
      activeForumFilters.global = selectedCategories;
      await renderForumScreen();
    } else if (type === "group" && id) {
      if (!activeForumFilters.group[id]) activeForumFilters.group[id] = [];
      activeForumFilters.group[id] = selectedCategories;
      await renderGroupPosts(id);
    }

    // 根据是否应用了筛选，更新图标状态
    if (selectedCategories.length > 0) {
      filterBtn.classList.add("active");
    } else {
      filterBtn.classList.remove("active");
    }

    document.getElementById("forum-filter-modal").classList.remove("visible");
  }

  async function followSeries(seriesId) {
    if (!seriesId) return;
    const series = await db.forumSeries.get(seriesId);
    if (!series) {
      alert("Không tìm thấy truyện dài kỳ tương ứng");
      return;
    }
    if (series.isFollowed) {
      await showCustomAlert(
        "Đã theo dõi truyện",
        `《${series.title || "Bộ truyện dài kỳ này"}》 đã có trong kệ sách rồi.`,
      );
      return;
    }
    const now = Date.now();
    await db.forumSeries.update(seriesId, {
      isFollowed: true,
      bookshelfAddedAt: now,
    });
    await showCustomAlert(
      "Theo dõi truyện thành công",
      `Đã thêm 《${series.title || "Bộ truyện dài kỳ này"}》 vào kệ sách hội nhóm, và sẽ tự động viết tiếp cho bạn.`,
    );
    await renderForumBookshelf();
    await generateNextSeriesChapter(seriesId);
  }

  async function generateNextSeriesChapter(seriesId) {
    if (!seriesId) return;
    if (ongoingSeriesTasks.has(seriesId)) {
      await showCustomAlert("Đang viết tiếp", "Chương trước vẫn đang được tạo, vui lòng chờ chút~");
      return;
    }
    const series = await db.forumSeries.get(seriesId);
    if (!series) {
      alert("Không tìm thấy truyện dài kỳ tương ứng");
      return;
    }
    const chapters = await db.forumChapters
      .where("seriesId")
      .equals(seriesId)
      .sortBy("chapterIndex");
    if (chapters.length === 0) {
      alert("Chưa có chương nào để viết tiếp");
      return;
    }

    const targetGroupId = series.groupId || window.activeGroupId;
    if (!targetGroupId) {
      ongoingSeriesTasks.delete(seriesId);
      alert("Không tìm thấy nhóm sở hữu, không thể viết tiếp");
      return;
    }
    if (series.isFinished) {
      ongoingSeriesTasks.delete(seriesId);
      await showCustomAlert(
        "Đã hoàn thành",
        `《${series.title || "Bộ truyện dài kỳ này"}》 đã được đánh dấu hoàn thành, không thể viết tiếp nữa.`,
      );
      return;
    }
    const seriesAuthor =
      series.seriesAuthor ||
      getRandomItem([
        "Tác giả nhà bên",
        "Người viết Ngân Hà",
        "Thái thái ẩn danh",
        "Bút danh chưa định",
        "Người nhặt chữ",
      ]) ||
      "Thái thái ẩn danh";

    const seriesTitle = series.title || series.pairing || "Bộ truyện dài kỳ này";
    const lastChapter = chapters[chapters.length - 1];
    const summaryContext = chapters
      .map(
        (ch) =>
          `Chương ${ch.chapterIndex} 《${ch.title || ""}》: ${ch.summary || (ch.content || "").slice(0, 120) || "(Chưa có tóm tắt)"}`,
      )
      .join("\n");
    const nextIndex =
      (series.lastChapterIndex || lastChapter.chapterIndex || chapters.length) +
      1;

    ongoingSeriesTasks.add(seriesId);
    await showCustomAlert("Đang viết tiếp...", `Đang viết chương ${nextIndex}, chờ một chút nhé...`);

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      ongoingSeriesTasks.delete(seriesId);
      alert("Vui lòng cấu hình API trước!");
      return;
    }

    const char1Persona =
      series.char1Persona || getPersonaByName(series.char1Name);
    const char2Persona =
      series.char2Persona || getPersonaByName(series.char2Name);
    const userPersona =
      series.userPersona ||
      state.qzoneSettings.weiboUserPersona ||
      "Một người bình thường";
    const lengthInstruction = series.wordCount
      ? `Độ dài chương này cố gắng gần 【${series.wordCount}】.`
      : "Chương này không dưới 1000 từ.";

    const prompt = `
Bạn là tác giả tiểu thuyết dài kỳ, hãy tiếp tục sáng tác chương ${nextIndex} của 《${seriesTitle}》 bằng tiếng Việt.

# Nhân vật và thiết lập
- Nhân vật A (${series.char1Name || "Nhân vật A"}): ${char1Persona}
- Nhân vật B (${series.char2Name || "Nhân vật B"}): ${char2Persona}
- Người dùng: ${userPersona}

# Yêu cầu viết
- Thể loại/kiểu: ${series.type || "Giữ như phần trước"}
- Văn phong: ${series.style || "Nhất quán với phần trước"}
- Thiết lập thế giới quan/cốt truyện: ${series.worldview || "Giữ thiết lập đã có"}
- ${lengthInstruction}
- Bình luận: tạo 5-8 bình luận/bình luận chạy của độc giả cho chương này, ngôn ngữ tự nhiên, có cảm giác nhập tâm.
- Đánh giá hoàn thành: nếu chương này đã khép lại mâu thuẫn chính, câu chuyện đã kết thúc, hãy đặt isFinished là true; nếu không thì là false, và tiếp tục giữ lại yếu tố hồi hộp để viết tiếp.

# Tóm tắt các chương đã đăng (để bạn nắm mạch chính)
${summaryContext || "Chưa có tóm tắt"}

# Toàn văn chương trước (để nối mạch)
${lastChapter.content || ""}

# Định dạng đầu ra (đối tượng JSON nghiêm ngặt, gồm 5-8 bình luận, và dùng isFinished để đánh dấu đã hoàn thành hay chưa)
{
"chapterTitle": "Chương ${nextIndex} tiêu đề",
"chapterSummary": "tóm tắt chương này, 3-5 câu",
"chapterContent": "toàn bộ nội dung",
"categories": ["nhãn 1","nhãn 2"],
  "comments": [
{"author": "Độc giả A", "content": "bình luận chạy hoặc bình luận ngắn"},
{"author": "Độc giả B", "content": "bình luận chạy hoặc bình luận ngắn"}
  ],
  "isFinished": false
}
Chỉ xuất JSON.`;

    const messagesForApi = [{ role: "user", content: prompt }];
    try {
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
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: "json_object" },
            }),
          });
      if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${response.status}`);

      const data = await response.json();
      const rawContent = isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content;
      let parsed;
      try {
        const cleanedContent = rawContent
          .replace(/^```json\s*|```$/g, "")
          .trim();
        parsed = JSON.parse(cleanedContent);
      } catch (e) {
        console.error("解析追更返回数据失败", e);
        throw new Error("AI trả về định dạng JSON không hợp lệ.");
      }

      const chapterTitle = parsed.chapterTitle || `Chương ${nextIndex}`;
      const chapterContent =
        parsed.chapterContent ||
        parsed.story ||
        parsed.content ||
        "Tạo chương này thất bại, vui lòng thử lại.";
      const chapterSummary = parsed.chapterSummary || "";
      const baseCategories = Array.isArray(parsed.categories)
        ? parsed.categories
        : [];
      const postCategories = Array.from(
        new Set(["Truyện dài", "Truyện dài kỳ", "Theo dõi truyện", ...baseCategories]),
      );
      const timestamp = Date.now();
      const isFinished = !!parsed.isFinished;

      const postId = await db.forumPosts.add({
        groupId: targetGroupId,
        title: `【Truyện dài kỳ】${seriesTitle} - Chương ${nextIndex} ${chapterTitle.replace(/^(?:第\d+章|Chương\s*\d+[:：.\-]?)\s*/i, "")}`,
        content: chapterContent,
        author: seriesAuthor,
        timestamp,
        categories: postCategories,
        lengthType: "long",
        seriesId,
        chapterIndex: nextIndex,
      });

      if (parsed.comments && Array.isArray(parsed.comments)) {
        const commentsToAdd = parsed.comments
          .filter((c) => c && c.content)
          .map((c, idx) => ({
            postId,
            author: c.author || "Người qua đường",
            content: c.content,
            timestamp: timestamp + idx + 1,
          }));
        if (commentsToAdd.length > 0) {
          await db.forumComments.bulkAdd(commentsToAdd);
        }
      }

      const chapterId = await db.forumChapters.add({
        seriesId,
        chapterIndex: nextIndex,
        title: chapterTitle,
        summary: chapterSummary,
        content: chapterContent,
        createdAt: timestamp,
        postId,
      });

      await db.forumSeries.update(seriesId, {
        lastChapterId: chapterId,
        lastChapterIndex: nextIndex,
        updatedAt: timestamp,
        isFinished,
      });

      if (targetGroupId) {
        await renderGroupPosts(targetGroupId);
      }
      await renderForumBookshelf();
      if (activeSeriesId === seriesId) {
        await renderSeriesDetail(seriesId);
      }
      await showCustomAlert("Viết tiếp xong", `Chương ${nextIndex} đã viết xong, vào xem đi!`);
    } catch (error) {
      console.error("追更失败:", error);
      await showCustomAlert("Viết tiếp thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    } finally {
      ongoingSeriesTasks.delete(seriesId);
    }
  }

  async function openForumBookshelf() {
    await renderForumBookshelf();
    showScreen("forum-bookshelf-screen");
  }

  async function renderForumBookshelf() {
    const listEl = document.getElementById("forum-bookshelf-list");
    if (!listEl) return;
    const allSeries = await db.forumSeries.toArray();
    const followed = allSeries.filter((s) => s.isFollowed);

    if (followed.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: #8a8a8a; padding: 40px 0;">Kệ sách trống trơn, đi theo dõi một bộ truyện dài đi!</p>';
      return;
    }

    followed.sort(
      (a, b) =>
        (b.updatedAt || b.bookshelfAddedAt || 0) -
        (a.updatedAt || a.bookshelfAddedAt || 0),
    );

    const cards = [];
    for (const series of followed) {
      const chapters = await db.forumChapters
        .where("seriesId")
        .equals(series.id)
        .sortBy("chapterIndex");
      const lastChapter = chapters[chapters.length - 1];
      const lastTitle = lastChapter
        ? `Chương ${lastChapter.chapterIndex} ${lastChapter.title || ""}`
        : "Chưa có chương";
      const lastPostId = lastChapter?.postId || "";
      const isFinished = !!series.isFinished;
      const continueText = isFinished ? "Đã hoàn thành" : "Theo dõi truyện";

      cards.push(`
        <div class="forum-bookshelf-card" data-series-id="${series.id}">
          <div class="series-card-header">
            <div class="series-card-title">${series.title || series.pairing || "Truyện dài kỳ chưa đặt tên"}</div>
            <div class="series-card-meta">${series.pairing || ""}</div>
<div class="series-card-meta">Mới nhất: ${lastTitle} · ${isFinished ? "Đã hoàn thành" : "Đang ra"}</div>
          </div>
          <div class="series-card-actions">
<button class="mini-btn primary" data-series-action="read-latest" data-series-id="${series.id}" data-post-id="${lastPostId}">Đọc</button>
<button class="mini-btn" data-series-action="open-detail" data-series-id="${series.id}">Mục lục</button>
            <button class="mini-btn ${isFinished ? "disabled" : ""}" data-series-action="continue" data-series-id="${series.id}" ${isFinished ? "disabled" : ""}>${continueText}</button>
<button class="mini-btn" data-series-action="share" data-series-id="${series.id}">Chia sẻ</button>
          </div>
        </div>
      `);
    }

    listEl.innerHTML = cards.join("");
  }

  async function openSeriesDetail(seriesId) {
    activeSeriesId = seriesId;
    await renderSeriesDetail(seriesId);
    showScreen("forum-series-detail-screen");
  }

  async function renderSeriesDetail(seriesId) {
    const metaEl = document.getElementById("forum-series-meta");
    const listEl = document.getElementById("forum-series-chapter-list");
    if (!metaEl || !listEl) return;

    const series = await db.forumSeries.get(seriesId);
    if (!series) {
      metaEl.innerHTML = '<p style="padding: 15px;">Không tìm thấy truyện dài kỳ.</p>';
      listEl.innerHTML = "";
      return;
    }
    const isFinished = !!series.isFinished;

    document.getElementById("forum-series-detail-title").textContent =
      series.title || "Chi tiết truyện dài kỳ";

    const chapters = await db.forumChapters
      .where("seriesId")
      .equals(seriesId)
      .sortBy("chapterIndex");
    const nextIndex = (series.lastChapterIndex || chapters.length) + 1;
    const metaLines = [
      `<div class="series-meta-line">CP：${series.pairing || `${series.char1Name || ""}x${series.char2Name || ""}`}</div>`,
      `<div class="series-meta-line">Trạng thái: ${isFinished ? "Đã hoàn thành" : `Đã cập nhật tới chương ${series.lastChapterIndex || chapters.length || 1}`}</div>`,
      `<div class="series-meta-line">Thể loại: ${series.type || "Chưa đặt"} · Văn phong: ${series.style || "Chưa đặt"}</div>`,
    ];
    metaEl.innerHTML = `<div class="forum-series-card">${metaLines.join("")}</div>`;

    const nextBtn = document.getElementById("series-next-chapter-btn");
    if (nextBtn) {
      nextBtn.dataset.seriesId = seriesId;
      nextBtn.textContent = isFinished ? "Đã hoàn thành" : `Viết tiếp chương ${nextIndex}`;
      nextBtn.disabled = isFinished;
      nextBtn.classList.toggle("disabled", isFinished);
    }

    if (chapters.length === 0) {
      listEl.innerHTML =
        '<p style="padding: 15px; color: var(--text-secondary);">Chưa có chương nào.</p>';
      return;
    }

    listEl.innerHTML = chapters
      .map(
        (ch) => `
        <div class="forum-chapter-item" data-post-id="${ch.postId || ""}" data-series-id="${seriesId}">
<div class="chapter-title">Chương ${ch.chapterIndex} ${ch.title || ""}</div>
          <div class="chapter-summary">${(ch.summary || "").replace(/\n/g, "<br>") || "Chưa có tóm tắt"}</div>
          <div class="chapter-actions">
<button class="mini-btn" data-series-action="open-post" data-series-id="${seriesId}" data-post-id="${ch.postId || ""}">Đọc</button>
          </div>
        </div>`,
      )
      .join("");
  }

  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】论坛功能事件监听器 ▼▼▼

  // 2. 当用户点击“圈子”App图标时，渲染小组列表
  document
    .querySelector(".desktop-app-icon[onclick=\"showScreen('forum-screen')\"]")
    .addEventListener("click", renderForumScreen);

  // 3. 绑定小组页和帖子页的返回按钮
  document
    .getElementById("back-to-forum-list")
    .addEventListener("click", () => showScreen("forum-screen"));
  document
    .getElementById("back-to-group-screen")
    .addEventListener("click", () => {
      if (postReturnContext === "bookshelf") {
        showScreen("forum-bookshelf-screen");
      } else if (postReturnContext === "series-detail" && activeSeriesId) {
        renderSeriesDetail(activeSeriesId);
        showScreen("forum-series-detail-screen");
      } else {
        openGroup(
          window.activeGroupId,
          document.getElementById("group-screen-title").textContent,
        );
      }
      postReturnContext = "group";
    });

  // 4. 绑定帖子评论区的发送按钮
  document
    .getElementById("send-post-comment-btn")
    .addEventListener("click", handleAddComment);

  // 绑定所有小组头部通用的“生成”按钮
  document
    .getElementById("generate-group-content-btn")
    .addEventListener("click", handleGenerateGroupContent);
  // ▲▲▲ 替换结束 ▲▲▲

  // 6. 绑定帖子详情页的“转载”按钮
  document
    .getElementById("repost-to-chat-btn")
    .addEventListener("click", repostToChat);

  // ▼▼▼ 在 init() 函数中，用【这一行】替换旧的 create-group-btn 监听器 ▼▼▼
  document
    .getElementById("create-group-btn")
    .addEventListener("click", openGroupCreator);
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 用这块新代码替换 ▼▼▼
  document
    .getElementById("create-forum-post-btn")
    .addEventListener("click", () => {
      // 【核心修改】我们不再弹窗提示，而是调用一个新函数来打开真正的发帖窗口
      openCreateForumPostModal();
    });
  // 使用事件委托，为帖子详情页的“生成评论”按钮 和 “删除评论”按钮 绑定事件
  document
    .getElementById("post-detail-content")
    .addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const seriesId = parseInt(actionBtn.dataset.seriesId);
        if (
          actionBtn.classList.contains("disabled") ||
          actionBtn.hasAttribute("disabled")
        )
          return;
        if (actionBtn.dataset.action === "follow-series") {
          if (!isNaN(seriesId)) {
            await followSeries(seriesId);
            if (activeForumPostId) await renderPostDetails(activeForumPostId);
          }
          return;
        }
        if (actionBtn.dataset.action === "continue-series") {
          if (!isNaN(seriesId)) {
            await generateNextSeriesChapter(seriesId);
            if (activeForumPostId) await renderPostDetails(activeForumPostId);
          }
          return;
        }
      }
      // 1. 处理生成评论
      if (e.target.id === "generate-forum-comments-btn") {
        generateForumComments();
        return;
      }

      // 2. ★ 新增：处理删除评论
      if (e.target.classList.contains("forum-comment-delete-btn")) {
        e.stopPropagation(); // 阻止冒泡，防止触发回复功能
        const commentId = parseInt(e.target.dataset.id);

        if (isNaN(commentId)) return;

        // 弹出确认框
        const confirmed = await showCustomConfirm(
          "Xóa bình luận",
          "Bạn có chắc muốn xóa bình luận này?",
          {
            confirmButtonClass: "btn-danger",
          },
        );

        if (confirmed) {
          try {
            await db.forumComments.delete(commentId);
            // 刷新当前帖子详情页
            if (activeForumPostId) {
              await renderPostDetails(activeForumPostId);
            }
            // (可选) 如果你希望删除评论后列表页的评论数也刷新，可以解开下面这行
            // if (activeGroupId) await renderGroupPosts(activeGroupId);
          } catch (error) {
            console.error("Xóa thất bại", error);
            alert("Xóa thất bại: " + error.message);
          }
        }
      }
    });

  // 在用户手动输入评论后，如果输入框为空就失去焦点时，自动取消回复状态
  document
    .getElementById("post-comment-input")
    .addEventListener("blur", (e) => {
      const input = e.target;
      if (input.value.trim() === "") {
        input.placeholder = "Viết bình luận của bạn...";
        delete input.dataset.replyTo;
      }
    });
  // ▲▲▲ 新代码粘贴结束 ▲▲▲
  // ▼▼▼ 在 init() 函数的事件监听器区域末尾，粘贴下面这整块新代码 ▼▼▼

  // 使用事件委托，为所有转载的帖子卡片添加点击事件
  document.getElementById("chat-messages").addEventListener("click", (e) => {
    const repostCard = e.target.closest(".link-share-card[data-post-id]");
    if (repostCard) {
      const postId = parseInt(repostCard.dataset.postId);
      if (!isNaN(postId)) {
        // 调用你已经写好的“打开帖子”函数
        openPost(postId);
      }
    }
  });

  // ▲▲▲ 新增代码结束 ▲▲▲
  // ▼▼▼ 【全新】论坛帖子列表事件委托 ▼▼▼
  document
    .getElementById("group-post-list")
    .addEventListener("click", async (e) => {
      const postItem = e.target.closest(".forum-post-item");
      if (!postItem) return;

      // 检查点击的是否是删除按钮
      if (e.target.classList.contains("forum-post-delete-btn")) {
        const postId = postItem.dataset.postId;
        if (!postId) return;

        const post = await db.forumPosts.get(parseInt(postId));
        if (!post) return;

        const confirmed = await showCustomConfirm(
          "Xóa bài viết",
          `Bạn có chắc muốn xóa bài viết 《${post.title}》? Thao tác này sẽ xóa luôn mọi bình luận dưới bài, và không thể khôi phục.`,
          { confirmButtonClass: "btn-danger" },
        );

        if (confirmed) {
          try {
            // 使用数据库事务来确保帖子和评论被同时删除
            await db.transaction(
              "rw",
              db.forumPosts,
              db.forumComments,
              async () => {
                // 1. 删除所有与该帖子关联的评论
                await db.forumComments
                  .where("postId")
                  .equals(parseInt(postId))
                  .delete();
                // 2. 删除帖子本身
                await db.forumPosts.delete(parseInt(postId));
              },
            );

            await showCustomAlert("Xóa thành công", "Đã xóa bài viết cùng mọi bình luận.");
            // 刷新帖子列表
            await renderGroupPosts(activeGroupId);
          } catch (error) {
            console.error("删除帖子失败:", error);
            await showCustomAlert("Xóa thất bại", `Thao tác thất bại: ${error.message}`);
          }
        }
      } else {
        // 如果点击的不是删除按钮，那就是点击了帖子本身，执行跳转逻辑
        const postId = postItem.dataset.postId;
        if (postId) {
          openPost(parseInt(postId));
        }
      }
    });
  // ▲▲▲ 新事件监听器结束 ▲▲▲
  // ▼▼▼ 【全新】圈子/小组高级功能事件监听 ▼▼▼

  // 1. 为“圈子”主页右上角的“+”按钮，绑定创建小组的事件
  document
    .getElementById("create-group-btn")
    .addEventListener("click", openGroupCreator);

  // 2. 为小组编辑器弹窗的“保存”和“取消”按钮绑定事件
  document
    .getElementById("save-group-editor-btn")
    .addEventListener("click", saveGroupSettings);
  document
    .getElementById("cancel-group-editor-btn")
    .addEventListener("click", () => {
      document
        .getElementById("forum-group-editor-modal")
        .classList.remove("visible");
    });

  // 3. 为分类管理弹窗的按钮绑定事件
  document
    .getElementById("add-new-forum-category-btn")
    .addEventListener("click", addNewForumCategory);
  document
    .getElementById("close-forum-category-manager-btn")
    .addEventListener("click", () => {
      document
        .getElementById("forum-category-manager-modal")
        .classList.remove("visible");
    });

  // 4. 使用事件委托，为分类列表中的“删除”按钮绑定事件
  document
    .getElementById("existing-forum-categories-list")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-group-btn")) {
        // 复用样式
        const categoryId = parseInt(e.target.dataset.id);
        deleteForumCategory(categoryId);
      }
    });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // ▼▼▼ 【全新】圈子/小组分类筛选功能事件监听 ▼▼▼
  // 1. 绑定主页和小组页的筛选按钮
  document
    .getElementById("forum-filter-btn")
    .addEventListener("click", () => openForumFilterModal("global"));
  // 筛选按钮
  document.getElementById("group-filter-btn").addEventListener("click", () => {
    openForumFilterModal("group", window.activeGroupId); // 【修改】
  });

  // 2. 绑定筛选弹窗内的按钮
  document
    .getElementById("apply-forum-filter-btn")
    .addEventListener("click", applyForumFilter);
  document
    .getElementById("cancel-forum-filter-btn")
    .addEventListener("click", () => {
      document.getElementById("forum-filter-modal").classList.remove("visible");
    });
  document
    .getElementById("reset-forum-filter-btn")
    .addEventListener("click", async () => {
      // 清空复选框并应用
      document
        .querySelectorAll("#forum-filter-category-list input:checked")
        .forEach((cb) => (cb.checked = false));
      await applyForumFilter();
    });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // --- 同人文控制台事件绑定 ---
  document
    .getElementById("fanfic-bar-header")
    .addEventListener("click", toggleFanficBar);

  document
    .getElementById("save-fanfic-preset-btn")
    .addEventListener("click", saveCurrentFanficPreset);

  document
    .getElementById("delete-fanfic-preset-btn")
    .addEventListener("click", deleteFanficPreset);

  document
    .getElementById("fanfic-preset-select")
    .addEventListener("change", applyFanficPreset);

  const forumBookshelfBtn = document.getElementById("open-forum-bookshelf-btn");
  if (forumBookshelfBtn) {
    forumBookshelfBtn.addEventListener("click", openForumBookshelf);
  }

  const backFromBookshelfBtn = document.getElementById(
    "back-from-forum-bookshelf",
  );
  if (backFromBookshelfBtn) {
    backFromBookshelfBtn.addEventListener("click", () =>
      showScreen("forum-screen"),
    );
  }

  const backFromSeriesDetailBtn = document.getElementById(
    "back-from-series-detail",
  );
  if (backFromSeriesDetailBtn) {
    backFromSeriesDetailBtn.addEventListener("click", () =>
      showScreen("forum-bookshelf-screen"),
    );
  }

  const seriesNextBtn = document.getElementById("series-next-chapter-btn");
  if (seriesNextBtn) {
    seriesNextBtn.addEventListener("click", async () => {
      if (seriesNextBtn.disabled) return;
      const seriesId = parseInt(
        seriesNextBtn.dataset.seriesId || activeSeriesId,
      );
      if (!isNaN(seriesId)) {
        await generateNextSeriesChapter(seriesId);
      }
    });
  }

  const bookshelfListEl = document.getElementById("forum-bookshelf-list");
  if (bookshelfListEl) {
    bookshelfListEl.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-series-action]");
      if (!actionBtn) return;
      const seriesId = parseInt(actionBtn.dataset.seriesId);
      if (isNaN(seriesId)) return;
      if (
        actionBtn.classList.contains("disabled") ||
        actionBtn.hasAttribute("disabled")
      )
        return;
      const series = await db.forumSeries.get(seriesId);
      if (series?.groupId) window.activeGroupId = series.groupId;
      activeSeriesId = seriesId;
      const action = actionBtn.dataset.seriesAction;
      if (action === "read-latest") {
        const postId = parseInt(actionBtn.dataset.postId);
        postReturnContext = "bookshelf";
        if (!isNaN(postId)) {
          openPost(postId, "bookshelf", seriesId);
        } else {
          openSeriesDetail(seriesId);
        }
      } else if (action === "open-detail") {
        await openSeriesDetail(seriesId);
      } else if (action === "continue") {
        await generateNextSeriesChapter(seriesId);
      } else if (action === "share") {
        await shareSeriesToChat(seriesId);
      }
    });
  }

  const seriesChapterList = document.getElementById(
    "forum-series-chapter-list",
  );
  if (seriesChapterList) {
    seriesChapterList.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-series-action]");
      if (!actionBtn) return;
      if (actionBtn.dataset.seriesAction === "open-post") {
        const seriesId = parseInt(actionBtn.dataset.seriesId);
        const postId = parseInt(actionBtn.dataset.postId);
        if (isNaN(postId)) return;
        const series = await db.forumSeries.get(seriesId);
        if (series?.groupId) window.activeGroupId = series.groupId;
        activeSeriesId = seriesId;
        postReturnContext = "series-detail";
        openPost(postId, "series-detail", seriesId);
      }
    });
  }

  // ▲▲▲ 论坛事件监听器结束 ▲▲▲
});
