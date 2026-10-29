let activeLoversSpaceCharId = null; // 当前情侣空间对应的角色ID
let activeLoveLetter = null; // 当前查看或回复的情书对象
let activeQuestionId = null; // 当前正在回答的问题ID
let currentDiaryDate = null; // 当前编辑或查看的日记日期
let tempUploadedPhotos = []; // 暂存待上传的照片数据
let lsActivityTimer = null; // 今日足迹定时器ID
let pomodoroCustomPlaylist = [];
// 情侣空间音乐播放器状态管理器
let lsMusicState = {
  playlist: [], // 播放列表
  currentIndex: -1, // 当前播放歌曲索引
  isPlaying: false, // 是否正在播放
};

let pomodoroState = {
  isActive: false,
  isPaused: false,
  timerId: null,
  periodicTalkTimerId: null,
  currentSession: null,
  timeTracker: 0,
  breakHistory: [],

  // === BGM 相关 ===
  bgmAudio: new Audio(),
  bgmPlaylist: [],
  bgmIndex: 0,
  bgmSource: "none",
};

// 配置循环播放逻辑 (自动播下一首)
pomodoroState.bgmAudio.addEventListener("ended", () => {
  playNextPomoMusic();
});
// 监听播放状态改变图标
pomodoroState.bgmAudio.addEventListener("play", updatePomoMusicUI);
pomodoroState.bgmAudio.addEventListener("pause", updatePomoMusicUI);

// 网络请求工具函数
if (typeof Http_Get_External === "undefined") {
  window.Http_Get_External = function (url) {
    return new Promise((resolve) => {
      fetch(url)
        .then((res) => res.json().catch(() => res.text()))
        .then(resolve)
        .catch(() => resolve(null));
    });
  };
}

/**
 * 发起HTTP GET请求
 * @param {string} url - 请求地址
 * @returns {Promise} 请求结果
 */
async function Http_Get(url) {
  return await Http_Get_External(url);
}

/**
 * 检查音频链接是否可以播放
 * @param {string} url - 音频链接
 * @returns {Promise<boolean>} 是否可以播放
 */
function checkAudioAvailability(url) {
  return new Promise((resolve) => {
    const tester = new Audio();
    tester.addEventListener("loadedmetadata", () => resolve(true), {
      once: true,
    });
    tester.addEventListener("error", () => resolve(false), { once: true });
    tester.src = url;
  });
}

/**
 * 获取网络歌曲歌词
 * @param {string} songId - 歌曲ID
 * @param {string} source - 音乐平台来源(netease/tencent)
 * @returns {Promise<string>} 歌词内容
 */
async function getLyricsForSong(songId, source) {
  const url =
    source === "netease"
      ? `https://api.vkeys.cn/v2/music/netease/lyric?id=${songId}`
      : `https://api.vkeys.cn/v2/music/tencent/lyric?id=${songId}`;

  const response = await Http_Get(url);
  if (response?.data) {
    const lrc = response.data.lrc || response.data.lyric || "";
    const tlyric = response.data.trans || response.data.tlyric || "";
    return lrc + "\\n" + tlyric;
  }
  return "";
}

/**
 * 解析LRC歌词格式
 * @param {string} lrcContent - LRC歌词内容
 * @returns {Array} 解析后的歌词数组[{time, text}]
 */
function parseLRC(lrcContent) {
  if (!lrcContent) return [];
  const lines = lrcContent.split("\n");
  const lyrics = [];
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;

  for (const line of lines) {
    const text = line.replace(timeRegex, "").trim();
    if (!text) continue;
    timeRegex.lastIndex = 0;
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      lyrics.push({ time, text });
    }
  }
  return lyrics.sort((a, b) => a.time - b.time);
}

/**
 * 格式化音乐时间显示
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间(mm:ss)
 */
function formatMusicTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * 更新音乐播放进度条
 */
function updateMusicProgressBar() {
  const currentTimeEl = document.getElementById("music-current-time");
  const totalTimeEl = document.getElementById("music-total-time");
  const progressFillEl = document.getElementById("music-progress-fill");
  if (!audioPlayer.duration) {
    currentTimeEl.textContent = "0:00";
    totalTimeEl.textContent = "0:00";
    progressFillEl.style.width = "0%";
    return;
  }
  const progressPercent =
    (audioPlayer.currentTime / audioPlayer.duration) * 100;
  progressFillEl.style.width = `${progressPercent}%`;
  currentTimeEl.textContent = formatMusicTime(audioPlayer.currentTime);
  totalTimeEl.textContent = formatMusicTime(audioPlayer.duration);
  updateActiveLyric(audioPlayer.currentTime);
}

/**
 * 搜索网易云音乐歌曲
 * @param {string} name - 歌曲名
 * @param {string} singer - 歌手名
 * @returns {Promise<Array>} 搜索结果数组
 */
async function searchNeteaseMusic(name, singer) {
  try {
    let searchTerm = name.replace(/\s/g, "");
    if (singer) {
      searchTerm += ` ${singer.replace(/\s/g, "")}`;
    }

    const apiUrl = `https://api.vkeys.cn/v2/music/netease?word=${encodeURIComponent(
      searchTerm,
    )}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const result = await response.json();

    if (result.code !== 200 || !result.data || result.data.length === 0) {
      console.log("vkeys API返回无结果:", result);
      return [];
    }

    return result.data
      .map((song) => ({
        name: song.song,
        artist: song.singer,
        id: song.id,
        cover:
          song.cover ||
          "https://i.postimg.cc/pT2xKzP-album-cover-placeholder.png",
        source: "netease",
      }))
      .slice(0, 15);
  } catch (e) {
    console.error("【vkeys API 直连】搜索失败:", e);
    await showCustomAlert(
      "Kết nối trực tiếp tới NetEase Cloud thất bại",
      `Nếu console trình duyệt (F12) báo lỗi CORS, nghĩa là API này cấm truy cập trực tiếp. Lỗi: ${e.message}`,
    );
    return [];
  }
}

/**
 * 搜索QQ音乐歌曲
 * @param {string} name - 歌曲名
 * @returns {Promise<Array>} 搜索结果数组
 */
async function searchTencentMusic(name) {
  try {
    name = name.replace(/\s/g, "");
    const result = await Http_Get(
      `https://api.vkeys.cn/v2/music/tencent?word=${encodeURIComponent(name)}`,
    );
    if (!result?.data?.length) return [];
    return result.data
      .map((song) => ({
        name: song.song,
        artist: song.singer,
        id: song.id,
        cover:
          song.cover ||
          "https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png",
        source: "tencent",
      }))
      .slice(0, 5);
  } catch (e) {
    console.error("QQ音乐搜索API失败:", e);
    return [];
  }
}
/**
 * 【新增】打开高级分享详情弹窗 (萌系版 - 带头像)
 */
function openAdvancedShareDetail(shareData) {
  const modal = document.getElementById("ls-share-detail-modal");
  const contentBox = modal.querySelector(".modal-content");

  // 元素获取
  const avatarEl = document.getElementById("ls-share-char-avatar");
  const iconEl = document.getElementById("ls-share-badge-icon");
  const titleEl = document.getElementById("ls-share-detail-title");
  const tagEl = document.getElementById("ls-share-type-text");
  const summaryEl = document.getElementById("ls-share-summary");
  const thoughtsEl = document.getElementById("ls-share-thoughts");

  // 1. 获取当前角色的头像
  // activeLoversSpaceCharId 是一个全局变量，记录了当前正在查看哪个情侣空间
  const chat = state.chats[activeLoversSpaceCharId];
  if (chat) {
    avatarEl.src = chat.settings.aiAvatar || defaultAvatar;
  } else {
    avatarEl.src = defaultAvatar;
  }

  // 配置数据 (定义图标、文字和配色主题)
  const configMap = {
    movie: { icon: "🎬", label: "Giới thiệu phim", class: "theme-movie" },
    book: { icon: "📖", label: "Chia sẻ sách hay", class: "theme-book" },
    game: { icon: "🎮", label: "Giới thiệu game", class: "theme-game" },
  };

  // 如果类型未知，默认用电影样式
  const config = configMap[shareData.shareType] || configMap.movie;

  // 2. 清除旧的主题Class，添加新的主题Class
  contentBox.classList.remove("theme-movie", "theme-book", "theme-game");
  contentBox.classList.add(config.class);

  // 3. 填充内容
  iconEl.textContent = config.icon;
  titleEl.textContent = shareData.title || "Tiêu đề không xác định";
  tagEl.textContent = config.label;

  // 如果有作者/歌手信息，加到标题后面
  if (shareData.artist) {
    titleEl.textContent += ` - ${shareData.artist}`;
  }

  // 简介内容
  summaryEl.textContent = shareData.summary || "(Người ấy thật bí ẩn, chẳng viết giới thiệu gì cả...)";

  // 感想内容 - "Char说..."
  thoughtsEl.textContent =
    shareData.thoughts || `Giới thiệu bạn xem thử 《${shareData.title}》 nè!`;

  // 4. 显示弹窗
  modal.classList.add("visible");
}

/**
 * 显示选择操作模态框
 * @param {string} title - 模态框标题
 * @param {Array} options - 选项数组[{text, value}]
 * @returns {Promise<string|null>} 用户选择的值或null
 */
function showChoiceModal(title, options) {
  return new Promise((resolve) => {
    const modal = document.getElementById("preset-actions-modal");
    const footer = modal.querySelector(".custom-modal-footer");

    footer.innerHTML = "";

    options.forEach((option) => {
      const button = document.createElement("button");
      button.textContent = option.text;
      button.onclick = () => {
        modal.classList.remove("visible");
        resolve(option.value);
      };
      footer.appendChild(button);
    });

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Hủy";
    cancelButton.style.marginTop = "8px";
    cancelButton.style.borderRadius = "8px";
    cancelButton.style.backgroundColor = "#f0f0f0";
    cancelButton.onclick = () => {
      modal.classList.remove("visible");
      resolve(null);
    };
    footer.appendChild(cancelButton);

    modal.classList.add("visible");
  });
}

/**
 * 打开情侣空间入口 - 根据角色数量决定直接进入或选择角色
 */
async function openLoversSpaceEntry() {
  const singleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );
  if (singleChats.length === 0) {
    alert("Bạn chưa có nhân vật nào để lập Không gian tình nhân cả, hãy tạo một người trước đã!");
    return;
  }
  if (singleChats.length === 1) {
    openLoversSpace(singleChats[0].id);
  } else {
    openCharSelectorForLoversSpace();
  }
}

/**
 * 打开情侣空间角色选择器 - 显示角色列表及情侣空间开通状态
 */
async function openCharSelectorForLoversSpace() {
  const modal = document.getElementById("ls-char-selector-modal");
  const listEl = document.getElementById("ls-char-selector-list");
  listEl.innerHTML = "";
  const singleChats = Object.values(state.chats).filter(
    (chat) => !chat.isGroup,
  );

  singleChats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "chat-list-item";
    item.style.borderBottom = "1px solid var(--border-color)";
    item.dataset.chatId = chat.id;

    const isLoversSpaceActive = !!chat.loversSpaceData;
    const statusText = isLoversSpaceActive
      ? '<span style="color: green; font-weight: bold;">Đã mở</span>'
      : '<span style="color: #8a8a8a;">Chưa mở</span>';

    item.innerHTML = `
            <img src="${
              chat.settings.aiAvatar || defaultAvatar
            }" class="avatar">
            <div class="info" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="name">${chat.name}</span>
                <div class="last-msg">${statusText}</div>
            </div>
        `;
    listEl.appendChild(item);
  });

  modal.classList.add("visible");
}

/**
 * 打开指定角色的情侣空间
 * @param {string} charId - 角色ID
 */
async function openLoversSpace(charId) {
  activeLoversSpaceCharId = charId;
  const chat = state.chats[charId];
  if (!chat) return;

  if (!chat.loversSpaceData) {
    chat.loversSpaceData = {
      background: "https://i.postimg.cc/k495F4W5/profile-banner.jpg",
      relationshipStartDate: null,
      moments: [],
      albums: [],
      photos: [],
      loveLetters: [],
      shares: [],
      questions: [],
      emotionDiaries: {},
      dailyActivity: {},
    };
    await db.chats.put(chat);
  }

  await renderLoversSpace(chat);
  showScreen("lovers-space-screen");
}

/**
 * 更新情侣空间在一起天数显示
 * @param {object} chat - 聊天对象
 */
function updateLoversSpaceDaysCounter(chat) {
  const counterEl = document.getElementById("ls-days-counter");
  const startDateString = chat.loversSpaceData.relationshipStartDate;

  if (startDateString) {
    const startDate = new Date(startDateString);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    counterEl.textContent = `Chúng ta đã bên nhau ${diffDays} ngày rồi`;
  } else {
    counterEl.innerHTML = `<a>Bấm "Cài đặt" ở góc trên bên phải để ghi lại ngày đầu tiên nhé</a>`;
  }
}

/**
 * 渲染情侣空间界面
 * @param {object} chat - 聊天对象
 */
async function renderLoversSpace(chat) {
  document.getElementById("lovers-space-screen").style.backgroundImage =
    `url(${chat.loversSpaceData.background})`;

  const userNickname = state.qzoneSettings.nickname || "{{user}}";
  document.getElementById("ls-char-name").textContent =
    `${userNickname} & ${chat.name}`;

  document.getElementById("ls-user-avatar").src =
    chat.settings.myAvatar || defaultAvatar;
  document.getElementById("ls-char-avatar").src =
    chat.settings.aiAvatar || defaultAvatar;

  updateLoversSpaceDaysCounter(chat);

  switchLoversSpaceTab("ls-moments-view");
  document.querySelector(".ls-tab-item.active").classList.remove("active");
  document
    .querySelector('.ls-tab-item[data-view="ls-moments-view"]')
    .classList.add("active");

  renderLSMoments(chat.loversSpaceData.moments, chat);
  renderLSPhotos(chat.loversSpaceData.photos, chat);
  renderLSLetters(chat.loversSpaceData.loveLetters, chat);
  renderLSShares(chat.loversSpaceData.shares, chat);
  document.getElementById("ls-shares-list").innerHTML =
    '<p class="ls-empty-placeholder">Người ấy chưa chia sẻ nội dung nào cả~</p>';
}

/**
 * 切换情侣空间页签
 * @param {string} viewId - 视图ID
 */
function switchLoversSpaceTab(viewId) {
  if (lsActivityTimer) {
    clearInterval(lsActivityTimer);
    lsActivityTimer = null;
  }

  document
    .querySelectorAll(".ls-view")
    .forEach((v) => (v.style.display = "none"));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.style.display = "block";

  const fabMoment = document.getElementById("ls-add-moment-btn");
  const fabAlbum = document.getElementById("ls-add-album-btn");
  const fabLetter = document.getElementById("ls-add-letter-btn");
  const fabQuestion = document.getElementById("ls-add-question-btn");
  if (fabMoment) fabMoment.style.display = "none";
  if (fabAlbum) fabAlbum.style.display = "none";
  if (fabLetter) fabLetter.style.display = "none";
  if (fabQuestion) fabQuestion.style.display = "none";
  if (viewId === "ls-moments-view" && fabMoment)
    fabMoment.style.display = "block";
  else if (viewId === "ls-album-view" && fabAlbum)
    fabAlbum.style.display = "block";
  else if (viewId === "ls-letters-view" && fabLetter)
    fabLetter.style.display = "block";
  else if (viewId === "ls-questions-view" && fabQuestion)
    fabQuestion.style.display = "block";

  if (viewId === "ls-activity-view") {
    const chat = state.chats[activeLoversSpaceCharId];
    renderLSDailyActivity(chat);
  }
}

/**
 * 渲染今日足迹页面 - 默认显示当天
 * @param {object} chat - 聊天对象
 */
function renderLSDailyActivity(chat) {
  currentActivityDate = new Date();
  renderLSDailyActivityForDate(chat, currentActivityDate);
}

/**
 * 根据指定日期渲染每日足迹界面
 * @param {object} chat - 聊天对象
 * @param {Date} date - 指定日期
 */
function renderLSDailyActivityForDate(chat, date) {
  const viewEl = document.getElementById("ls-activity-view");
  viewEl.innerHTML = "";

  if (!chat || !chat.loversSpaceData) {
    viewEl.innerHTML =
      '<p class="ls-empty-placeholder">Lỗi dữ liệu, không tải được dấu chân.</p>';
    return;
  }

  const header = document.createElement("div");
  header.className = "ls-activity-header";
  const dateStr = date.toISOString().split("T")[0];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let dateDisplay = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  if (dateStr === todayStr) {
    dateDisplay += " (hôm nay)";
  }

  const calendarIconSvg = `
    <svg id="ls-activity-calendar-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2V5" stroke="#4A4A4A" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 2V5" stroke="#4A4A4A" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.5 9.08997H20.5" stroke="#4A4A4A" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke="#4A4A4A" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.6947 13.7H15.7037" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15.6947 16.7H15.7037" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11.9955 13.7H12.0045" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11.9955 16.7H12.0045" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.29431 13.7H8.30331" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.29431 16.7H8.30331" stroke="#ff8fab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `;

  header.innerHTML = `
    <span class="ls-activity-date-display">${dateDisplay}</span>
    ${calendarIconSvg}
    `;
  viewEl.appendChild(header);
  header.querySelector("#ls-activity-calendar-icon").onclick =
    openActivityCalendar;

  const activitiesForDate = chat.loversSpaceData.dailyActivity?.[dateStr];
  const contentContainer = document.createElement("div");
  viewEl.appendChild(contentContainer);

  if (!activitiesForDate) {
    if (dateStr === todayStr) {
      contentContainer.innerHTML = `
        <div class="ls-activity-generate-container">
<p>Dấu chân hôm nay vẫn còn trống...</p>
<button id="ls-generate-activity-btn">Tạo dấu chân hôm nay</button>
<p class="hint">(thao tác này mỗi ngày chỉ làm được một lần)</p>
        </div>
    `;
      contentContainer.querySelector("#ls-generate-activity-btn").onclick =
        () => handleGenerateDailyActivity(chat);
    } else {
      contentContainer.innerHTML = `<p class="ls-empty-placeholder" style="margin-top: 50px;">Ngày này không để lại dấu chân nào cả~</p>`;
    }
  } else {
    const listContainer = document.createElement("div");
    listContainer.id = "ls-activity-list";
    contentContainer.appendChild(listContainer);

    if (lsActivityTimer) clearInterval(lsActivityTimer);
    lsActivityTimer = null;

    displayDailyActivities(activitiesForDate);

    if (dateStr === todayStr) {
      const hasAllDisplayed = displayDailyActivities(activitiesForDate);
      if (!hasAllDisplayed) {
        lsActivityTimer = setInterval(() => {
          const allDone = displayDailyActivities(activitiesForDate);
          if (allDone) {
            clearInterval(lsActivityTimer);
            lsActivityTimer = null;
          }
        }, 60 * 1000);
      }
    }
  }
}

/**
 * 打开每日足迹日历弹窗
 * 初始化并显示足迹日历，支持月份切换和日期选择
 */
function openActivityCalendar() {
  const modal = document.getElementById("ls-activity-calendar-modal");
  const body = document.getElementById("ls-activity-calendar-body");
  const chat = state.chats[activeLoversSpaceCharId];

  const year = currentActivityDate.getFullYear();
  const month = currentActivityDate.getMonth() + 1;
  body.innerHTML = renderActivityCalendar(
    year,
    month,
    chat.loversSpaceData.dailyActivity || {},
  );

  // 使用事件委托处理弹窗内所有点击事件
  body.onclick = (e) => {
    const target = e.target;

    // 处理月份切换按钮点击
    if (
      target.closest("#ls-activity-cal-prev-btn") ||
      target.closest("#ls-activity-cal-next-btn")
    ) {
      const currentDisplay = body.querySelector(
        "#ls-activity-cal-month-display",
      ).textContent;
      const [y, m] = currentDisplay.match(/\d+/g).map(Number);
      let newDate = new Date(y, m - 1, 1);

      if (target.closest("#ls-activity-cal-prev-btn")) {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      body.innerHTML = renderActivityCalendar(
        newDate.getFullYear(),
        newDate.getMonth() + 1,
        chat.loversSpaceData.dailyActivity || {},
      );
      return;
    }

    // 处理日期格子点击
    const dayCell = target.closest(".ls-calendar-day:not(.empty)");
    if (dayCell && dayCell.dataset.date) {
      const [y, m, d] = dayCell.dataset.date.split("-").map(Number);
      currentActivityDate = new Date(y, m - 1, d);
      renderLSDailyActivityForDate(chat, currentActivityDate);
      modal.classList.remove("visible");
      return;
    }

    // 处理关闭按钮点击
    if (target.closest("#ls-activity-cal-close-btn")) {
      modal.classList.remove("visible");
    }
  };

  modal.classList.add("visible");
}

/**
 * 生成足迹日历HTML
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {object} activityData - 活动数据
 * @returns {string} 日历HTML字符串
 */
function renderActivityCalendar(year, month, activityData) {
  const date = new Date(year, month - 1, 1);
  const firstDay = date.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  let calendarHtml = `
    <div class="ls-calendar-wrapper">
        <div class="ls-calendar-header">
            <button id="ls-activity-cal-prev-btn">‹</button>
<span id="ls-activity-cal-month-display">Tháng ${month} ${year}</span>
            <button id="ls-activity-cal-next-btn">›</button>
        </div>
        <div class="ls-calendar-weekdays">
<div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
        </div>
    <div class="ls-calendar-grid">
    `;

  for (let i = 0; i < firstDay; i++) {
    calendarHtml += '<div class="ls-calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
    const hasActivity = !!activityData[dateStr];
    const isToday = dateStr === todayStr;

    let classes = "ls-calendar-day";
    if (isToday) classes += " today";
    if (hasActivity) classes += " has-activity";

    calendarHtml += `
        <div class="${classes}" data-date="${dateStr}" style="cursor: pointer;">
            <div class="day-number">${day}</div>
            ${hasActivity ? '<span class="activity-dot">🐾</span>' : ""}
        </div>
        `;
  }
  calendarHtml += `</div></div>
    <div class="modal-footer" style="padding-top: 15px;">
<button class="save" id="ls-activity-cal-close-btn" style="width: 100%;">Đóng</button>
    </div>
    `;
  return calendarHtml;
}

/**
 * 显示当天的活动列表
 * @param {Array} activities - 当天所有活动的数组
 * @returns {boolean} - 如果所有活动都已显示，返回 true
 */
function displayDailyActivities(activities) {
  const listEl = document.getElementById("ls-activity-list");
  listEl.innerHTML = "";
  const now = Date.now();

  const visibleActivities = activities.filter((act) => act.timestamp <= now);

  if (visibleActivities.length === 0) {
    listEl.innerHTML =
      '<p class="ls-empty-placeholder">Hôm nay người ấy vẫn chưa bắt đầu hoạt động...</p>';
  } else {
    visibleActivities.forEach((activity) => {
      const itemEl = document.createElement("div");
      itemEl.className = "ls-activity-item";

      const activityTime = new Date(activity.timestamp);
      const timeString = `${String(activityTime.getHours()).padStart(
        2,
        "0",
      )}:${String(activityTime.getMinutes()).padStart(2, "0")}`;

      const durationHtml = activity.duration
        ? `<span class="activity-duration">${activity.duration}</span>`
        : "";

      itemEl.innerHTML = `
                <span class="activity-time">${timeString}</span>
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-content">
                    <p class="activity-description">${activity.description}</p>
                    ${durationHtml}
                </div>
            `;
      listEl.appendChild(itemEl);

      // 渲染HTML小剧场（如果存在）
      if (activity.html_snippet) {
        const snippetEl = document.createElement("div");
        snippetEl.className = "ls-activity-snippet";
        snippetEl.innerHTML = activity.html_snippet;
        listEl.appendChild(snippetEl);
      }
    });
  }

  return visibleActivities.length === activities.length;
}

/**
 * 打开文件选择器并返回本地图片的Base64编码
 * @returns {Promise<string|null>} - 返回图片的Base64 Data URL，如果用户取消则返回null
 */
function uploadImageLocally() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          resolve(readerEvent.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * 触发AI生成一整天的手机活动记录
 * @param {object} chat - 当前角色的聊天对象
 */
async function handleGenerateDailyActivity(chat) {
  await showCustomAlert("Vui lòng chờ...", `AI đang lên kế hoạch cuộc sống một ngày cho "${chat.name}"...`);

  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const systemPrompt = `
        # Nhiệm vụ nhập vai
Bạn là trình mô phỏng hoạt động điện thoại. Nhiệm vụ của bạn là dựa vào thiết lập nhân vật của "${chat.name}", tạo cho người đó bản ghi sử dụng điện thoại chi tiết và chân thật trong cả một ngày (từ 0 giờ đêm đến 23 giờ), giờ thức dậy tùy theo thiết lập nhân vật. Viết mô tả bằng tiếng Việt.

# Thiết lập nhân vật (phải tuân thủ nghiêm ngặt)
        ${chat.settings.aiPersona}

# Quy tắc cốt lõi
1.  **Liền mạch thời gian**: Các bản ghi hoạt động phải xếp theo thứ tự thời gian, phủ cả ngày, cấm chuyển thời gian quá cứng nhắc.
2.  **Đa dạng nội dung**: Loại hoạt động nên phong phú đa dạng, gồm nhưng không giới hạn ở dùng ứng dụng, trạng thái điện thoại, khác (đặt báo thức, xem thời tiết...).
3.  **Phù hợp thiết lập**: Mọi hoạt động đều phải liên quan mật thiết tới tính cách, nghề nghiệp và sở thích của nhân vật.
4.  **【【【Chức năng mới hoàn toàn: Tiểu kịch trường HTML】】】**:
-   Với một số hoạt động cụ thể (ví dụ xem phim, ăn uống, mua sắm), bạn có thể 【ngẫu nhiên và tùy chọn】 tạo thêm một trường tên \`html_snippet\`.
-   Nội dung trường này là 【một đoạn code HTML nhỏ】, dùng để hiển thị một yếu tố thị giác liên quan tới hoạt động, ví dụ cuống vé xem phim, hóa đơn mua sắm...
-   Bạn 【không cần】 tạo trường này cho mọi hoạt động, chỉ cần thêm ngẫu nhiên vào những mốc bạn thấy phù hợp, thú vị, để tăng phần vui.
5.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một bản ghi hoạt động.

# Cấu trúc đối tượng JSON (html_snippet là tùy chọn!)
        {
        "time": "HH:mm",
"description": "mô tả hoạt động",
"duration": "(tùy chọn) thời lượng",
"icon": "một emoji hoặc biểu tượng svg",
"html_snippet": "(tùy chọn) code HTML dùng để tạo tiểu kịch trường"
        }

# Ví dụ định dạng tiểu kịch trường HTML (để bạn tham khảo, bạn có thể tự do sáng tạo):
-   **Xem phim**:
"html_snippet": "<div class='movie-ticket'><div class='ticket-header'>Rạp chiếu phim EPHONE</div><div class='ticket-body'><h3>《Your Name》</h3><p>Suất chiếu: 14:30 | Phòng 7 hàng 8 ghế 5</p></div></div>"
-   **Ăn uống**:
"html_snippet": "<div class='receipt'><div class='receipt-header'>Quán nhỏ ấm cúng</div><ul><li><span>Mì ramen x1</span><span>￥28.00</span></li><li><span>Trứng lòng đào x1</span><span>￥5.00</span></li></ul><div class='receipt-total'><strong>Tổng cộng:</strong><strong>￥33.00</strong></div></div>"

Bây giờ, hãy bắt đầu tạo bản ghi cuộc sống hôm nay cho "${chat.name}".
    `;

  try {
    const messagesForApi = [{ role: "user", content: systemPrompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      systemPrompt,
      messagesForApi,
      isGemini,
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
              temperature: 1.0,
              response_format: { type: "json_object" },
            }),
          },
    );

    if (!response.ok)
      throw new Error(
        `Yêu cầu API thất bại: ${response.status} - ${await response.text()}`,
      );

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();
    console.log("【AI每日足迹 - 原始输出】:", rawContent);
    const generatedActivities = JSON.parse(rawContent);

    if (Array.isArray(generatedActivities)) {
      const today = new Date();
      const todayDateStr = today.toISOString().split("T")[0];

      // 将AI返回的时间字符串转换为完整的时间戳
      const processedActivities = generatedActivities.map((act) => {
        const [hours, minutes] = act.time.split(":").map(Number);
        const activityDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          hours,
          minutes,
        );
        return { ...act, timestamp: activityDate.getTime() };
      });

      // 保存到数据库
      if (!chat.loversSpaceData.dailyActivity) {
        chat.loversSpaceData.dailyActivity = {};
      }
      chat.loversSpaceData.dailyActivity[todayDateStr] = processedActivities;
      await db.chats.put(chat);

      // 重新渲染界面
      renderLSDailyActivity(chat);
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng.");
    }
  } catch (error) {
    console.error("生成今日足迹失败:", error);
    await showCustomAlert("Tạo thất bại", `Đã xảy ra lỗi:\n${error.message}`);
    // 失败时，恢复"生成"按钮的显示
    const viewEl = document.getElementById("ls-activity-view");
    viewEl.innerHTML = `
            <div class="ls-activity-generate-container">
<p style="color:red;">Tạo thất bại, vui lòng thử lại!</p>
<button id="ls-generate-activity-btn">Tạo lại</button>
            </div>
        `;
    document.getElementById("ls-generate-activity-btn").onclick = () =>
      handleGenerateDailyActivity(chat);
  }
}

/**
 * 处理更换情侣空间背景的逻辑
 */
async function handleChangeLoversSpaceBackground() {
  if (!activeLoversSpaceCharId) return;

  // 让用户选择上传方式
  const choice = await showChoiceModal("Đổi nền không gian", [
    { text: "📁 Tải lên từ máy", value: "local" },
    { text: "🌐 Dùng URL trên mạng", value: "url" },
  ]);

  let newBackgroundUrl = null;

  if (choice === "local") {
    // 从本地上传图片
    newBackgroundUrl = await uploadImageLocally();
  } else if (choice === "url") {
    // 使用网络URL
    const currentBg =
      state.chats[activeLoversSpaceCharId].loversSpaceData.background;
    newBackgroundUrl = await showCustomPrompt(
      "Đổi nền",
      "Nhập URL ảnh mới",
      currentBg,
      "url",
    );
  }

  // 处理新背景URL
  if (newBackgroundUrl && newBackgroundUrl.trim()) {
    const chat = state.chats[activeLoversSpaceCharId];
    chat.loversSpaceData.background = newBackgroundUrl.trim();

    // 保存到数据库并重新渲染
    await db.chats.put(chat);
    await renderLoversSpace(chat);

    alert("Đã cập nhật nền Không gian tình nhân!");
  } else if (newBackgroundUrl !== null) {
    alert("Vui lòng nhập một URL hợp lệ hoặc chọn một file!");
  }
}

/**
 * 渲染"说说"列表
 * @param {Array} moments - 说说数组
 * @param {object} chat - 聊天对象
 */
function renderLSMoments(moments, chat) {
  const listEl = document.getElementById("ls-moments-list");
  listEl.innerHTML = "";
  if (!moments || moments.length === 0) {
    listEl.innerHTML =
      '<p class="ls-empty-placeholder">Chưa có lời thì thầm nào, mau đăng lời đầu tiên đi!</p>';
    return;
  }

  // 从新到旧显示说说
  for (let i = moments.length - 1; i >= 0; i--) {
    const moment = moments[i];
    const originalIndex = i;

    const isUser = moment.author === "user";
    const authorName = isUser ? chat.settings.myNickname || "Tôi" : chat.name;
    const authorAvatar = isUser
      ? chat.settings.myAvatar
      : chat.settings.aiAvatar;

    // 构建评论区HTML
    let commentsHtml = "";
    if (moment.comments && moment.comments.length > 0) {
      moment.comments.forEach((comment, commentIndex) => {
        commentsHtml += `
                    <div class="ls-comment-item">
                        <span class="commenter-name">${comment.author}:</span>
                        <span class="comment-text">${comment.text}</span>
                        <button class="ls-comment-delete-btn" data-moment-index="${originalIndex}" data-comment-index="${commentIndex}">×</button>
                    </div>
                `;
      });
    }

    const card = document.createElement("div");
    card.className = "ls-moment-card";
    // 保存原始索引用于删除操作
    card.dataset.momentIndex = originalIndex;

    // 构建说说卡片HTML
    card.innerHTML = `
            <img src="${authorAvatar}" class="avatar">
            <div class="moment-main">
                <span class="author">${authorName}</span>
                <p class="content">${moment.content.replace(/\n/g, "<br>")}</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="timestamp">${formatPostTimestamp(
                      moment.timestamp,
                    )}</span>
                </div>

<!-- Khu bình luận -->
                <div class="ls-moment-footer">
                    <div class="ls-moment-comments-container">
                        ${commentsHtml}
                    </div>
                    <div class="ls-comment-input-area">
<input type="text" placeholder="Thêm bình luận...">
<button class="ls-comment-send-btn">Gửi</button>
                    </div>
                </div>
<!-- Hết khu bình luận -->

            </div>
<!-- Nút xóa trạng thái -->
<button class="ls-moment-delete-btn" title="Xóa trạng thái này">×</button>
        `;
    listEl.appendChild(card);
  }
}

/**
 * 渲染"分享"列表 (萌系升级版)
 * @param {Array} shares - 分享数组
 * @param {object} chat - 聊天对象
 */
function renderLSShares(shares, chat) {
  const listEl = document.getElementById("ls-shares-list");
  listEl.innerHTML = "";

  if (!shares || shares.length === 0) {
    listEl.innerHTML =
      '<div class="ls-empty-state"><span style="font-size:40px;">🎐</span><p>Chưa có chia sẻ nào cả~<br>Bấm góc dưới bên phải để chia sẻ một bộ phim bạn thích nhé!</p></div>';
    return;
  }

  [...shares].reverse().forEach((share) => {
    const item = document.createElement("div");
    item.className = "ls-list-item ls-share-item";
    item.dataset.shareData = JSON.stringify(share);

    // 1. 确定是谁分享的，获取对应头像
    const isUser = share.author === "user";
    const authorName = isUser ? chat.settings.myNickname || "Tôi" : chat.name;
    const avatarSrc = isUser
      ? chat.settings.myAvatar || defaultAvatar
      : chat.settings.aiAvatar || defaultAvatar;

    // 2. 定义不同类型的可爱风格配置
    const styleConfig = {
      song: {
        icon: "🎵",
        color: "#FFF0F5",
        border: "#FFB7B2",
        label: "đã chia sẻ bài hát",
      }, // 粉色系
      movie: {
        icon: "🎬",
        color: "#E3F2FD",
        border: "#64B5F6",
        label: "muốn xem phim",
      }, // 蓝色系
      book: {
        icon: "📖",
        color: "#F1F8E9",
        border: "#AED581",
        label: "đang đọc",
      }, // 绿色系
      game: {
        icon: "🎮",
        color: "#FFF8E1",
        border: "#FFB74D",
        label: "giới thiệu game",
      }, // 橙色系
    };

    const config = styleConfig[share.shareType] || styleConfig.song;

    // 3. 构建内容部分
    let contentHtml = "";

    // 标题部分
    contentHtml += `<div class="share-card-title">${config.icon} ${share.title}</div>`;

    // 歌手/作者/简介信息
    if (share.shareType === "song" && share.artist) {
      contentHtml += `<div class="share-card-meta">Ca sĩ: ${share.artist}</div>`;
    } else if (share.summary) {
      // 限制字数，防止太长
      const summaryText =
        share.summary.length > 60
          ? share.summary.substring(0, 60) + "..."
          : share.summary;
      contentHtml += `<div class="share-card-desc">${summaryText}</div>`;
    }

    // 感想部分 (像便签一样贴在下面)
    let thoughtsHtml = "";
    if (share.thoughts) {
      thoughtsHtml = `
                <div class="share-card-thoughts">
                    <span class="quote-mark">“</span>
                    ${share.thoughts}
                    <span class="quote-mark">”</span>
                </div>
            `;
    }

    // 4. 组装整体HTML (带头像的布局)
    item.innerHTML = `
            <div class="ls-share-wrapper ${isUser ? "is-me" : ""}">
                <img src="${avatarSrc}" class="ls-share-avatar" alt="${authorName}">
                
                <div class="ls-share-bubble" style="background-color: ${config.color}; border: 2px solid ${config.border};">
                    <div class="ls-share-header">
                        <span class="ls-share-label" style="background:${config.border}; color:#fff;">${config.label}</span>
                        <span class="ls-share-time">${formatPostTimestamp(share.timestamp)}</span>
                    </div>
                    
                    <div class="ls-share-content-box">
                        ${contentHtml}
                    </div>
                    
                    ${thoughtsHtml}
                </div>
            </div>
        `;

    listEl.appendChild(item);
  });
}

/**
 * 渲染"照片"列表
 * @param {Array} photos - 照片数组
 * @param {object} chat - 聊天对象
 */
function renderLSPhotos(photos, chat) {
  const listEl = document.getElementById("ls-album-list");
  listEl.innerHTML = "";
  if (!photos || photos.length === 0) {
    listEl.innerHTML =
      '<p class="ls-empty-placeholder" style="grid-column: 1 / -1;">Chưa có tấm ảnh nào, bấm góc dưới bên phải để tải tấm đầu tiên lên nhé!</p>';
    return;
  }

  [...photos].reverse().forEach((photo) => {
    const item = document.createElement("div");
    item.className = "ls-album-item";

    // 为每个照片项添加时间戳，用于标识和操作特定照片
    item.dataset.timestamp = photo.timestamp;

    const imageUrl =
      photo.type === "image"
        ? photo.url
        : "https://i.postimg.cc/KYr2qRCK/1.jpg";

    // 修改点：使用 img 标签代替 background-image，并确保样式正确
    item.innerHTML = `
            <div class="cover" style="position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 8px;">
                <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy">
                <button class="ls-photo-delete-btn">×</button>
            </div>
        `;

    listEl.appendChild(item);
  });
}
// --- 新增函数开始 ---

/**
 * 打开照片详情评论弹窗
 * @param {number} timestamp - 照片的时间戳ID
 */
async function openLSPhotoDetail(timestamp) {
  const chat = state.chats[activeLoversSpaceCharId];
  if (!chat || !chat.loversSpaceData || !chat.loversSpaceData.photos) return;

  const photo = chat.loversSpaceData.photos.find(
    (p) => p.timestamp === timestamp,
  );
  if (!photo) return;

  // 1. 填充基本信息
  const imgEl = document.getElementById("ls-photo-detail-img");
  // 兼容 text_image 类型
  if (photo.type === "text_image") {
    imgEl.src = "https://i.postimg.cc/KYr2qRCK/1.jpg"; // 默认文字图背景
  } else {
    imgEl.src = photo.url;
  }

  document.getElementById("ls-photo-detail-desc").textContent =
    photo.description || "(Không có mô tả)";
  document.getElementById("ls-photo-detail-meta").textContent =
    formatPostTimestamp(photo.timestamp);

  // 2. 暂存当前查看的照片时间戳，供发送按钮使用
  document.getElementById("ls-photo-detail-modal").dataset.currentTimestamp =
    timestamp;

  // 3. 渲染评论
  renderLSPhotoComments(photo);

  // 4. 显示弹窗
  document.getElementById("ls-photo-detail-modal").classList.add("visible");
}

/**
 * 渲染照片评论列表 (萌系版 - 带头像)
 */
function renderLSPhotoComments(photo) {
  const listEl = document.getElementById("ls-photo-comments-list");
  listEl.innerHTML = "";

  if (!photo.comments || photo.comments.length === 0) {
    listEl.innerHTML =
      '<div style="text-align:center; color:#eda; padding:20px; font-size:13px;">(｡•́︿•̀｡) Chưa có ai bình luận, mau vào giành tem~</div>';
    return;
  }

  const chat = state.chats[activeLoversSpaceCharId];
  // 获取"我"的名字
  const myNickname = chat.settings.myNickname || "Tôi";

  photo.comments.forEach((comment) => {
    const item = document.createElement("div");
    const isMe = comment.author === myNickname;

    // 设置样式类名
    item.className = `ls-photo-comment-item ${isMe ? "is-me" : ""}`;

    // 确定头像
    let avatarSrc = defaultAvatar;
    if (isMe) {
      avatarSrc = chat.settings.myAvatar || defaultAvatar;
    } else if (comment.author === chat.name) {
      avatarSrc = chat.settings.aiAvatar || defaultAvatar;
    }

    item.innerHTML = `
            <img src="${avatarSrc}" class="ls-photo-comment-avatar">
            <div class="ls-photo-comment-bubble">
                <span class="ls-comment-author">${comment.author}</span>
                ${comment.text}
            </div>
        `;
    listEl.appendChild(item);
  });

  // 自动滚动到底部
  setTimeout(() => {
    listEl.scrollTop = listEl.scrollHeight;
  }, 100);
}

/**
 * 处理发送照片评论
 */
async function handleSendLSPhotoComment() {
  const modal = document.getElementById("ls-photo-detail-modal");
  const timestamp = parseInt(modal.dataset.currentTimestamp);
  const input = document.getElementById("ls-photo-comment-input");
  const text = input.value.trim();

  if (!text) return alert("Vui lòng nhập nội dung bình luận");
  if (!activeLoversSpaceCharId) return;

  const chat = state.chats[activeLoversSpaceCharId];
  const photo = chat.loversSpaceData.photos.find(
    (p) => p.timestamp === timestamp,
  );
  if (!photo) return;

  // 1. 初始化评论数组
  if (!photo.comments) photo.comments = [];

  // 2. 添加评论
  const myNickname = chat.settings.myNickname || "Tôi";
  photo.comments.push({
    author: myNickname,
    text: text,
    timestamp: Date.now(),
  });

  // 3. 保存并刷新
  await db.chats.put(chat);
  renderLSPhotoComments(photo);
  input.value = ""; // 清空输入框

  // 4. 【核心】触发AI回复
  // 构造一条系统消息通知AI
  const photoDesc = photo.description || "Một tấm ảnh";
  const hiddenMessage = {
    role: "system",
    content: `[Thông báo hệ thống: người dùng đã bình luận một tấm ảnh trong Không gian tình nhân.
Mô tả ảnh: "${photoDesc}".
Bình luận của người dùng: "${text}".
Hãy với thân phận "${chat.name}", phản hồi về tấm ảnh và bình luận của người dùng.]`,
    timestamp: Date.now(),
    isHidden: true,
  };

  chat.history.push(hiddenMessage);
  await db.chats.put(chat); // 再次保存聊天记录
}

// --- 新增函数结束 ---

/**
 * 打开创建说说的弹窗
 * 清空输入框内容并显示说说创建模态框
 */
function openMomentCreator() {
  document.getElementById("ls-moment-content-input").value = "";
  document.getElementById("ls-create-moment-modal").classList.add("visible");
}

/**
 * 用户发布说说
 * 处理用户提交的说说内容，保存到数据库并通知AI
 */
async function handlePostMoment() {
  const content = document
    .getElementById("ls-moment-content-input")
    .value.trim();
  if (!content) {
    alert("Nội dung không được để trống nhé!");
    return;
  }
  const chat = state.chats[activeLoversSpaceCharId];
  const newMoment = {
    author: "user",
    content: content,
    timestamp: Date.now(),
    comments: [], // 为新说说创建一个空的评论数组
  };
  // 确保moments数组存在
  if (!chat.loversSpaceData.moments) {
    chat.loversSpaceData.moments = [];
  }
  chat.loversSpaceData.moments.push(newMoment);
  await db.chats.put(chat);

  renderLSMoments(chat.loversSpaceData.moments, chat);
  document.getElementById("ls-create-moment-modal").classList.remove("visible");

  // 创建一条对用户隐藏，但对AI可见的系统消息
  const hiddenMessage = {
    role: "system",
    content: `[Thông báo hệ thống: người dùng (${chat.settings.myNickname || "Tôi"}) đã đăng một trạng thái mới trong Không gian tình nhân của chúng ta, nội dung là: "${content}". Hãy dựa vào thiết lập nhân vật, dùng chỉ thị 'ls_comment' để bày tỏ cảm nghĩ về trạng thái này.]`,
    timestamp: Date.now(),
    isHidden: true, // 这个标记能让消息对你隐藏，但AI能看见
  };
  chat.history.push(hiddenMessage);
  await db.chats.put(chat); // 再次保存，确保隐藏消息被存入
}

/**
 * 打开上传照片的弹窗
 * 初始化照片上传模态框，重置所有输入和预览内容
 */
function openAlbumCreator() {
  tempUploadedPhotos = [];
  document.getElementById("ls-album-modal-title").textContent = "Tải ảnh lên";
  // 重置所有输入框和预览
  document.getElementById("ls-photo-preview-container").innerHTML = "";
  document.getElementById("ls-photo-desc-input").value = "";
  document.getElementById("ls-text-image-desc-input").value = "";
  document.getElementById("ls-photo-input").value = null;

  // 默认显示"上传图片"模式
  document.getElementById("ls-switch-to-image-mode").click();

  document.getElementById("ls-create-album-modal").classList.add("visible");
}

/**
 * 处理用户选择照片后的预览 (单张版)
 * @param {FileList} files - 用户选择的文件列表
 */
function handlePhotoSelection(files) {
  const previewContainer = document.getElementById(
    "ls-photo-preview-container",
  );
  previewContainer.innerHTML = "";
  tempUploadedPhotos = [];

  const file = files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    tempUploadedPhotos.push({ url: dataUrl }); // 暂存base64

    // 显示预览图
    const previewItem = document.createElement("div");
    previewItem.className = "ls-photo-preview-item";
    previewItem.innerHTML = `<img src="${dataUrl}">`;
    previewContainer.appendChild(previewItem);
  };
  reader.readAsDataURL(file);
}

/**
 * 用户确认上传照片 (这是修复后的版本)
 * 处理用户确认上传照片的逻辑，支持图片和文字图两种模式
 */
async function handleConfirmAlbum() {
  const chat = state.chats[activeLoversSpaceCharId];
  if (!chat) return;

  // 先判断当前是哪种模式
  const isImageMode = document
    .getElementById("ls-image-mode-content")
    .classList.contains("active");
  let newPhoto;

  if (isImageMode) {
    // 如果是"上传图片"模式，执行这里的检查
    if (tempUploadedPhotos.length === 0) {
      alert("Vui lòng chọn một tấm ảnh!"); // 只有在这种模式下，这个提示才是正确的
      return;
    }
    const description = document
      .getElementById("ls-photo-desc-input")
      .value.trim();
    if (!description) {
      alert("Mô tả ảnh không được để trống!");
      return;
    }
    newPhoto = {
      type: "image",
      url: tempUploadedPhotos[0].url,
      description: description,
      timestamp: Date.now(),
    };
  } else {
    // 如果是"使用文字图"模式，执行这里的检查
    const description = document
      .getElementById("ls-text-image-desc-input")
      .value.trim();
    if (!description) {
      alert("Mô tả ảnh chữ không được để trống!");
      return;
    }
    newPhoto = {
      type: "text_image",
      description: description,
      timestamp: Date.now(),
    };
  }

  // 后续的保存和刷新逻辑保持不变
  if (!chat.loversSpaceData.photos) {
    chat.loversSpaceData.photos = [];
  }

  chat.loversSpaceData.photos.push(newPhoto);
  await db.chats.put(chat);

  renderLSPhotos(chat.loversSpaceData.photos, chat);
  document.getElementById("ls-create-album-modal").classList.remove("visible");
}

/**
 * 删除情侣空间中的一张照片
 * @param {number} timestamp - 要删除照片的时间戳
 */
async function handleDeleteLSPhoto(timestamp) {
  // 弹出确认框，防止误删
  const confirmed = await showCustomConfirm(
    "Xóa ảnh",
    "Bạn có chắc muốn xóa ảnh này? Thao tác này không thể khôi phục.",
    {
      confirmButtonClass: "btn-danger",
    },
  );

  if (confirmed) {
    const chat = state.chats[activeLoversSpaceCharId];
    if (!chat || !chat.loversSpaceData || !chat.loversSpaceData.photos) return;

    // 从照片数组中过滤掉要删除的照片
    chat.loversSpaceData.photos = chat.loversSpaceData.photos.filter(
      (p) => p.timestamp !== timestamp,
    );

    // 保存更新后的聊天数据
    await db.chats.put(chat);

    // 重新渲染照片列表，让删除效果立刻生效
    renderLSPhotos(chat.loversSpaceData.photos, chat);

    alert("Đã xóa ảnh.");
  }
}

/**
 * 渲染"情书"列表 (已加入删除功能)
 * @param {Array} letters - 情书数组
 * @param {object} chat - 聊天对象
 */
function renderLSLetters(letters, chat) {
  const listEl = document.getElementById("ls-letters-list");
  listEl.innerHTML = ""; // 先清空
  if (!letters || letters.length === 0) {
    listEl.innerHTML =
      '<p class="ls-empty-placeholder">Chưa có lá thư tình nào, bấm góc dưới bên phải để viết lá đầu tiên nhé!</p>';
    return;
  }

  // 从新到旧排序显示
  [...letters].reverse().forEach((letter) => {
    const item = document.createElement("div");
    item.className = "ls-love-letter-item";
    item.dataset.letterId = letter.id;

    const svgIcon = `
            <svg class="letter-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;

    // 在情书项中加入删除按钮的HTML
    item.innerHTML = `
            <!-- Nút xóa thư tình -->
<button class="ls-letter-delete-btn" title="Xóa lá thư tình này">×</button>

            ${svgIcon}
            <div class="letter-info">
                <div class="letter-recipient">
                    <img src="${letter.recipientAvatar}" class="avatar">
                    <span>To: ${letter.recipientName}</span>
                </div>
                <div class="letter-preview">${letter.content.substring(
                  0,
                  30,
                )}...</div>
            </div>
            <div class="letter-sender">
                <img src="${letter.senderAvatar}" class="avatar">
                <span>From: ${letter.senderName}</span>
            </div>
        `;
    listEl.appendChild(item);
  });
}

/**
 * 格式化时间戳为易读的时间显示
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatPostTimestamp(timestamp) {
  if (!timestamp) return "";
  const now = new Date();
  const date = new Date(timestamp);
  const diffSeconds = Math.floor((now - date) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (now.getFullYear() === year) {
    return `${month}-${day} ${hours}:${minutes}`;
  } else {
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * 打开写情书/回信的弹窗
 * @param {object | null} replyToLetter - 如果是回信，则传入被回复的情书对象
 */
function openLoveLetterEditor(replyToLetter = null) {
  const modal = document.getElementById("ls-create-letter-modal");
  const titleEl = document.getElementById("ls-letter-modal-title");
  const recipientInput = document.getElementById("ls-letter-recipient-input");
  const contentInput = document.getElementById("ls-letter-content-input");

  const chat = state.chats[activeLoversSpaceCharId];

  if (replyToLetter) {
    // 这是回信
    titleEl.textContent = `Hồi âm cho ${replyToLetter.senderName}`;
    recipientInput.value = replyToLetter.senderName;
    contentInput.value = ""; // 清空内容
    contentInput.placeholder = `Hồi âm thư tình của ${replyToLetter.senderName}...`;
    // 暂存被回复的信，以便发送时知道是回复谁
    modal.dataset.replyingTo = JSON.stringify(replyToLetter);
  } else {
    // 这是写新信
    titleEl.textContent = `Viết cho ${chat.name} một lá thư`;
    recipientInput.value = chat.name;
    contentInput.value = "";
    contentInput.placeholder = "Viết tâm ý của bạn tại đây...";
    // 清除可能存在的回复标记
    delete modal.dataset.replyingTo;
  }

  modal.classList.add("visible");
}

/**
 * 处理用户点击"寄出"按钮的逻辑
 * 保存用户撰写的情书并通知AI
 */
async function handlePostLoveLetter() {
  const modal = document.getElementById("ls-create-letter-modal");
  const content = document
    .getElementById("ls-letter-content-input")
    .value.trim();
  if (!content) {
    alert("Nội dung thư tình không được để trống nhé!");
    return;
  }

  const chat = state.chats[activeLoversSpaceCharId];
  const isReply = modal.dataset.replyingTo;

  let newLetter;

  if (isReply) {
    // 如果是回信，发信人和收信人信息要反过来
    const originalLetter = JSON.parse(isReply);
    newLetter = {
      id: "letter_" + Date.now(),
      senderId: "user",
      senderName: chat.settings.myNickname || "Tôi",
      senderAvatar: chat.settings.myAvatar,
      recipientName: originalLetter.senderName, // 收信人是原信的发信人
      recipientAvatar: originalLetter.senderAvatar,
      content: content,
      timestamp: Date.now(),
    };
  } else {
    // 如果是写新信
    newLetter = {
      id: "letter_" + Date.now(),
      senderId: "user",
      senderName: chat.settings.myNickname || "Tôi",
      senderAvatar: chat.settings.myAvatar,
      recipientName: chat.name, // 收信人是当前角色
      recipientAvatar: chat.settings.aiAvatar,
      content: content,
      timestamp: Date.now(),
    };
  }

  // 确保 loveLetters 数组存在
  if (!chat.loversSpaceData.loveLetters) {
    chat.loversSpaceData.loveLetters = [];
  }
  chat.loversSpaceData.loveLetters.push(newLetter);

  await db.chats.put(chat);

  // 如果是用户写的信，就给AI发一个隐藏的系统通知
  if (newLetter.senderId === "user") {
    const hiddenMessage = {
      role: "system",
      content: `[Thông báo hệ thống: người dùng vừa viết cho bạn một lá thư tình trong Không gian tình nhân, nội dung là: "${content}". Hãy dựa vào thiết lập nhân vật, dùng chỉ thị 'ls_letter' để viết thư hồi âm cho người dùng.]`,
      timestamp: Date.now(),
      isHidden: true, // 这个标记能让消息对你隐藏，但AI能看见
    };
    chat.history.push(hiddenMessage);
    await db.chats.put(chat); // 再次保存，确保隐藏消息被存入
  }

  renderLSLetters(chat.loversSpaceData.loveLetters, chat);
  modal.classList.remove("visible");
}

/**
 * 显示情书详情 (信纸样式版)
 * @param {string} letterId - 要显示的情书的ID
 */
async function showLoveLetterDetail(letterId) {
  const chat = state.chats[activeLoversSpaceCharId];
  activeLoveLetter = chat.loversSpaceData.loveLetters.find(
    (l) => l.id === letterId,
  );
  if (!activeLoveLetter) return;

  // 获取新的信纸弹窗元素
  const modal = document.getElementById("ls-letter-viewer-modal");

  // 填充所有数据
  document.getElementById("ls-viewer-recipient-avatar").src =
    activeLoveLetter.recipientAvatar;
  document.getElementById("ls-viewer-recipient-name").textContent =
    activeLoveLetter.recipientName;
  document.getElementById("ls-viewer-body").innerHTML =
    activeLoveLetter.content.replace(/\n/g, "<br>"); // 正文内容
  document.getElementById("ls-viewer-sender-name").textContent =
    `Your dearest, ${activeLoveLetter.senderName}`; // 发信人
  document.getElementById("ls-viewer-timestamp").textContent = new Date(
    activeLoveLetter.timestamp,
  ).toLocaleString(); // 时间

  // 显示弹窗
  modal.classList.add("visible");
}

/**
 * 渲染情绪日记的主界面（日历和心情罐子）
 * @param {number} year - 年份
 * @param {number} month - 月份
 */
async function renderLSDiaryView(year, month) {
  const viewEl = document.getElementById("ls-diary-view");
  const chat = state.chats[activeLoversSpaceCharId];
  if (!viewEl || !chat) return;

  const diaryData = chat.loversSpaceData.emotionDiaries || {};

  // 渲染日历
  viewEl.innerHTML = renderCalendar(year, month, diaryData);

  // 渲染心情罐子
  const jarHtml = renderMoodJar(year, month, diaryData);
  viewEl.insertAdjacentHTML("beforeend", jarHtml);
}

/**
 * 生成日历的HTML
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {object} diaryData - 日记数据
 * @returns {string} 日历HTML字符串
 */
function renderCalendar(year, month, diaryData) {
  const date = new Date(year, month - 1, 1);
  const firstDay = date.getDay(); // 0-6 (周日-周六)
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  let calendarHtml = `
        <div class="ls-calendar-wrapper">
            <div class="ls-calendar-header">
                <button id="ls-prev-month-btn">‹</button>
<span id="ls-current-month-display">Tháng ${month} ${year}</span>
                <button id="ls-next-month-btn">›</button>
            </div>
            <div class="ls-calendar-weekdays">
<div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
            </div>
            <div class="ls-calendar-grid">
    `;

  // 空白格子
  for (let i = 0; i < firstDay; i++) {
    calendarHtml += '<div class="ls-calendar-day empty"></div>';
  }

  // 日期格子
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
    const dayData = diaryData[dateStr] || {};
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() + 1 === month &&
      today.getDate() === day;

    calendarHtml += `
            <div class="ls-calendar-day ${
              isToday ? "today" : ""
            }" data-date="${dateStr}">
                <div class="day-number">${day}</div>
                <div class="mood-emojis">
                    <span class="user-emoji">${dayData.userEmoji || ""}</span>
                    <span class="char-emoji">${dayData.charEmoji || ""}</span>
                </div>
            </div>
        `;
  }
  calendarHtml += "</div></div>";
  return calendarHtml;
}

/**
 * 生成心情罐子的HTML
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {object} diaryData - 日记数据
 * @returns {string} 心情罐子HTML字符串
 */
function renderMoodJar(year, month, diaryData) {
  let allEmojis = [];
  for (const dateStr in diaryData) {
    if (dateStr.startsWith(`${year}-${String(month).padStart(2, "0")}`)) {
      const dayData = diaryData[dateStr];
      if (dayData.userEmoji) allEmojis.push(dayData.userEmoji);
      if (dayData.charEmoji) allEmojis.push(dayData.charEmoji);
    }
  }

  let jarHtml = `
        <div class="ls-mood-jar-wrapper">
<h3>Hũ tâm trạng tháng này</h3>
            <div class="ls-mood-jar">
    `;

  if (allEmojis.length > 0) {
    jarHtml += allEmojis
      .map((emoji) => `<span class="mood-emoji-item">${emoji}</span>`)
      .join("");
  } else {
    jarHtml +=
      '<p style="color: var(--text-secondary); font-size: 13px;">Tháng này chưa ghi tâm trạng nào cả</p>';
  }

  jarHtml += "</div></div>";
  return jarHtml;
}

/**
 * 打开日记编辑/查看弹窗
 * @param {string} dateStr - 日期字符串
 */
function openDiaryModal(dateStr) {
  currentDiaryDate = dateStr;
  const chat = state.chats[activeLoversSpaceCharId];
  const diaryEntry = chat.loversSpaceData.emotionDiaries?.[dateStr];

  // 如果双方都有日记，或只有AI有日记，则打开查看器
  if (diaryEntry && (diaryEntry.userDiary || diaryEntry.charDiary)) {
    openDiaryViewer(dateStr, diaryEntry, chat);
  } else {
    // 否则，打开编辑器
    openDiaryEditor(dateStr, diaryEntry);
  }
}

/**
 * 打开日记编辑器
 * @param {string} dateStr - 日期字符串
 * @param {object} entryData - 日记条目数据
 */
function openDiaryEditor(dateStr, entryData) {
  const modal = document.getElementById("ls-diary-editor-modal");
  document.getElementById("ls-diary-editor-title").textContent =
    `Ghi lại tâm trạng của ${dateStr}`;

  const emojiSelector = document.getElementById("ls-emoji-selector");
  const emojis = ["😊", "😄", "😍", "😢", "😠", "🤔", "😴", "🤢"];
  emojiSelector.innerHTML = emojis
    .map((e) => `<span class="emoji-option" data-emoji="${e}">${e}</span>`)
    .join("");

  // 恢复之前的选择（如果有）
  const contentInput = document.getElementById("ls-diary-content-input");
  if (entryData && entryData.userEmoji) {
    emojiSelector
      .querySelector(`.emoji-option[data-emoji="${entryData.userEmoji}"]`)
      ?.classList.add("selected");
    contentInput.value = entryData.userDiary || "";
  } else {
    contentInput.value = "";
  }

  modal.classList.add("visible");
}

/**
 * 打开日记查看器
 * @param {string} dateStr - 日期字符串
 * @param {object} entryData - 日记条目数据
 * @param {object} chat - 聊天对象
 */
function openDiaryViewer(dateStr, entryData, chat) {
  const modal = document.getElementById("ls-diary-viewer-modal");
  document.getElementById("ls-diary-viewer-title").textContent =
    `Xem nhật ký của ${dateStr}`;
  const bodyEl = document.getElementById("ls-diary-viewer-body");
  bodyEl.innerHTML = "";

  // 显示用户日记
  if (entryData.userDiary) {
    const userBlock = document.createElement("div");
    userBlock.className = "ls-diary-entry-block";
    userBlock.innerHTML = `
            <div class="entry-header">
                <span class="mood-emoji">${entryData.userEmoji}</span>
<span class="author">Nhật ký của ${chat.settings.myNickname || "Tôi"}</span>
            </div>
            <p class="entry-content">${entryData.userDiary.replace(
              /\n/g,
              "<br>",
            )}</p>
        `;
    bodyEl.appendChild(userBlock);
  }

  // 显示角色日记
  if (entryData.charDiary) {
    const charBlock = document.createElement("div");
    charBlock.className = "ls-diary-entry-block";
    charBlock.style.borderColor = "#ff8fab"; // 给角色日记一个不同的颜色
    charBlock.innerHTML = `
            <div class="entry-header">
                <span class="mood-emoji">${entryData.charEmoji}</span>
<span class="author">Nhật ký của ${chat.name}</span>
            </div>
            <p class="entry-content">${entryData.charDiary.replace(
              /\n/g,
              "<br>",
            )}</p>
        `;
    bodyEl.appendChild(charBlock);
  } else {
    // 如果角色还没写，给个提示
    bodyEl.innerHTML += `<p style="text-align: center; color: var(--text-secondary);">Người ấy chưa viết nhật ký tâm trạng hôm nay~</p>`;
  }

  modal.classList.add("visible");
}

/**
 * 保存用户的日记，并触发AI写日记和回应
 */
async function handleSaveUserDiary() {
  const selectedEmojiEl = document.querySelector(
    "#ls-emoji-selector .selected",
  );
  const userEmoji = selectedEmojiEl ? selectedEmojiEl.dataset.emoji : null;
  const userDiary = document
    .getElementById("ls-diary-content-input")
    .value.trim();

  if (!userEmoji) {
    alert("Hãy chọn một biểu tượng đại diện cho tâm trạng hôm nay!");
    return;
  }
  if (!userDiary) {
    alert("Nội dung nhật ký không được để trống nhé!");
    return;
  }

  const chat = state.chats[activeLoversSpaceCharId];
  if (!chat.loversSpaceData.emotionDiaries) {
    chat.loversSpaceData.emotionDiaries = {};
  }

  // 更新或创建当天的日记数据
  if (!chat.loversSpaceData.emotionDiaries[currentDiaryDate]) {
    chat.loversSpaceData.emotionDiaries[currentDiaryDate] = {};
  }
  chat.loversSpaceData.emotionDiaries[currentDiaryDate].userEmoji = userEmoji;
  chat.loversSpaceData.emotionDiaries[currentDiaryDate].userDiary = userDiary;

  // 关闭弹窗
  document.getElementById("ls-diary-editor-modal").classList.remove("visible");
  // --- 核心联动功能开始 ---

  // 准备一条对用户可见的消息，告诉对方你写了日记
  const targetChat = state.chats[activeLoversSpaceCharId];
  if (targetChat) {
    const userNickname = state.qzoneSettings.nickname || "Tôi";

    const notificationMessage = {
      role: "user",
      type: "ls_diary_notification", // 给它一个独一无二的类型
      content: {
        // 内容变成一个对象，方便携带更多信息
        userEmoji: userEmoji, // 把用户选择的表情也带上
        text: "Tôi vừa viết nhật ký tâm trạng hôm nay đó, bạn cũng mau vào xem đi!",
      },
      timestamp: Date.now(),
    };
    targetChat.history.push(notificationMessage);

    // 创建一条对AI可见的【隐藏指令】，这是整个功能的核心
    const hiddenMessage = {
      role: "system",
      content: `[Chỉ thị hệ thống: người dùng vừa viết nhật ký hôm nay trong Không gian tình nhân.
- Tâm trạng của họ là: ${userEmoji}
- Nội dung nhật ký là: "${userDiary}"
Nhiệm vụ của bạn:
1.  【Bắt buộc】 dựa vào thiết lập nhân vật và lịch sử chat hôm nay, cũng viết một trang nhật ký tâm trạng của riêng bạn, và dùng chỉ thị 'ls_diary_entry' để gửi.
2.  【Bắt buộc】 sau khi viết xong nhật ký, lập tức dựa vào nội dung nhật ký hôm nay của người dùng, với giọng của nhân vật, chủ động mở ra một cuộc trò chuyện mới.]`,
      timestamp: Date.now() + 1, // 确保时间戳在后
      isHidden: true, // 这个标记能让消息对用户隐藏，但AI能看见
    };
    targetChat.history.push(hiddenMessage);

    // 保存所有更改到数据库
    await db.chats.put(targetChat);

    // 主动跳转到单聊界面，并触发AI响应
    openChat(activeLoversSpaceCharId);
    triggerAiResponse();
  }

  alert("Đã lưu nhật ký!");
}

/**
 * 渲染"情侣提问"列表
 * @param {Array} questions - 提问数组
 * @param {object} chat - 聊天对象
 */
function renderLSQuestions(questions, chat) {
  const listEl = document.getElementById("ls-questions-list");
  listEl.innerHTML = "";
  if (!questions || questions.length === 0) {
    listEl.innerHTML =
      '<p class="ls-empty-placeholder">Chưa có ai đặt câu hỏi, bấm "+" ở góc dưới bên phải để đặt câu hỏi đầu tiên nhé!</p>';
    return;
  }

  [...questions].reverse().forEach((q) => {
    const isUserQuestioner = q.questioner === "user";
    const questionerName = isUserQuestioner
      ? chat.settings.myNickname || "Tôi"
      : chat.name;
    const questionerAvatar = isUserQuestioner
      ? chat.settings.myAvatar
      : chat.settings.aiAvatar;

    let answerHtml = "";
    if (q.answerText) {
      const isUserAnswerer = q.answerer === "user";
      const answererName = isUserAnswerer
        ? chat.settings.myNickname || "Tôi"
        : chat.name;
      const answererAvatar = isUserAnswerer
        ? chat.settings.myAvatar
        : chat.settings.aiAvatar;
      answerHtml = `
                <div class="ls-answer-section">
                    <img src="${answererAvatar}" class="qa-avatar">
                    <div class="qa-main">
                        <div class="qa-header">
<span class="qa-author">Câu trả lời của ${answererName}</span>
                        </div>
                        <p class="qa-content">${q.answerText.replace(
                          /\n/g,
                          "<br>",
                        )}</p>
                    </div>
                </div>
            `;
    } else if (q.answerer === "user") {
      // 如果轮到用户回答
      answerHtml = `
                <div class="ls-answer-placeholder">
<button class="ls-answer-btn" data-question-id="${q.id}">Trả lời câu hỏi của người ấy</button>
                </div>
            `;
    } else {
      // 如果轮到AI回答
      answerHtml = `
                <div class="ls-answer-placeholder">
<p style="color: var(--text-secondary); font-size: 14px;">Đang chờ người ấy trả lời...</p>
                </div>
            `;
    }

    const card = document.createElement("div");
    card.className = "ls-question-card";

    // 在提问卡片中加入删除按钮
    card.innerHTML = `
            <button class="ls-question-delete-btn" data-question-id="${q.id}" title="Xóa câu hỏi này">×</button>

            <div class="ls-question-section">
                <img src="${questionerAvatar}" class="qa-avatar">
                <div class="qa-main">
                    <div class="qa-header">
<span class="qa-author">Câu hỏi của ${questionerName}</span>
                        <span class="qa-timestamp">${formatPostTimestamp(
                          q.timestamp,
                        )}</span>
                    </div>
                    <p class="qa-content">${q.questionText.replace(
                      /\n/g,
                      "<br>",
                    )}</p>
                </div>
            </div>
            ${answerHtml}
        `;
    listEl.appendChild(card);
  });
}

/**
 * 打开提问弹窗
 * 清空输入框内容并显示提问模态框
 */
function openQuestionAsker() {
  document.getElementById("ls-question-content-input").value = "";
  document.getElementById("ls-ask-question-modal").classList.add("visible");
}

/**
 * 用户发布一个新提问
 * 处理用户提交的提问内容，保存到数据库并通知AI
 */
async function handlePostQuestion() {
  const content = document
    .getElementById("ls-question-content-input")
    .value.trim();
  if (!content) {
    alert("Nội dung câu hỏi không được để trống!");
    return;
  }
  const chat = state.chats[activeLoversSpaceCharId];
  const newQuestion = {
    id: "q_" + Date.now(),
    questioner: "user",
    questionText: content,
    timestamp: Date.now(),
    answerer: "char", // 指定由AI来回答
    answerText: null,
  };

  if (!chat.loversSpaceData.questions) {
    chat.loversSpaceData.questions = [];
  }
  chat.loversSpaceData.questions.push(newQuestion);
  await db.chats.put(chat);

  renderLSQuestions(chat.loversSpaceData.questions, chat);
  document.getElementById("ls-ask-question-modal").classList.remove("visible");

  // 创建一条对用户隐藏，但对AI可见的系统消息
  const hiddenMessage = {
    role: "system",
    content: `[Thông báo hệ thống: người dùng đặt cho bạn một câu hỏi trong Không gian tình nhân: "${content}", ID câu hỏi là "${newQuestion.id}". Hãy dùng chỉ thị 'ls_answer_question' để trả lời.]`,
    timestamp: Date.now(),
    isHidden: true,
  };
  chat.history.push(hiddenMessage);
  await db.chats.put(chat);
}

/**
 * 打开回答问题的弹窗
 * @param {string} questionId - 问题ID
 */
function openAnswerEditor(questionId) {
  const chat = state.chats[activeLoversSpaceCharId];
  const question = chat.loversSpaceData.questions.find(
    (q) => q.id === questionId,
  );
  if (!question) return;

  activeQuestionId = questionId;
  document.getElementById("ls-answer-question-text").textContent =
    question.questionText;
  document.getElementById("ls-answer-content-input").value = "";
  document.getElementById("ls-answer-question-modal").classList.add("visible");
}

/**
 * 用户提交回答
 * 处理用户提交的回答内容，保存到数据库并通知AI
 */
async function handlePostAnswer() {
  if (!activeQuestionId) return;
  const answerText = document
    .getElementById("ls-answer-content-input")
    .value.trim();
  if (!answerText) {
    alert("Nội dung trả lời không được để trống!");
    return;
  }
  const chat = state.chats[activeLoversSpaceCharId];
  const question = chat.loversSpaceData.questions.find(
    (q) => q.id === activeQuestionId,
  );
  if (question) {
    question.answerer = "user"; // 明确回答者是用户
    question.answerText = answerText;
    await db.chats.put(chat);

    const hiddenMessage = {
      role: "system",
      content: `[Thông báo hệ thống: người dùng (${chat.settings.myNickname || "Tôi"}) vừa trả lời câu hỏi bạn đặt trước đó trong Không gian tình nhân. Câu hỏi của bạn là: "${question.questionText}", câu trả lời của người dùng là: "${answerText}".]`,
      timestamp: Date.now(),
      isHidden: true,
    };
    chat.history.push(hiddenMessage);
    await db.chats.put(chat);

    renderLSQuestions(chat.loversSpaceData.questions, chat);
  }
  document
    .getElementById("ls-answer-question-modal")
    .classList.remove("visible");
  activeQuestionId = null;
}

/**
 * 删除一条情侣提问
 * @param {string} questionId - 要删除的提问的ID
 */
async function handleDeleteLSQuestion(questionId) {
  // 弹出确认框，防止误删
  const confirmed = await showCustomConfirm(
    "Xóa câu hỏi",
    "Bạn có chắc muốn xóa câu hỏi này cùng câu trả lời tương ứng? Thao tác này không thể khôi phục.",
    {
      confirmButtonClass: "btn-danger",
    },
  );

  // 如果用户确认删除
  if (confirmed) {
    const chat = state.chats[activeLoversSpaceCharId];
    if (!chat || !chat.loversSpaceData || !chat.loversSpaceData.questions)
      return;

    // 从提问数组中过滤掉要删除的提问
    chat.loversSpaceData.questions = chat.loversSpaceData.questions.filter(
      (q) => q.id !== questionId,
    );

    // 保存更新后的聊天数据
    await db.chats.put(chat);

    // 重新渲染提问列表，让删除效果立刻生效
    renderLSQuestions(chat.loversSpaceData.questions, chat);

    alert("Đã xóa câu hỏi.");
  }
}

/**
 * 当用户在情侣空间点击一首分享的歌曲时触发
 * @param {object} shareData - 包含歌曲信息的分享对象
 */
async function openLoversSpaceMusicPlayer(shareData) {
  await showCustomAlert(
    "Vui lòng chờ...",
    `Đang tìm nguồn phát cho 《${shareData.title}》...`,
  );

  // 检查播放列表是否已经有这首歌了
  const existingIndex = lsMusicState.playlist.findIndex(
    (song) => song.name === shareData.title && song.artist === shareData.artist,
  );

  if (existingIndex > -1) {
    // 如果已经存在，直接播放并打开播放器
    playLSSong(existingIndex);
    document.getElementById("ls-music-player-overlay").classList.add("visible");
    return;
  }

  // 如果不存在，开始搜索
  let songData = null;
  const songName = shareData.title;
  const artistName = shareData.artist || "";

  // 策略1：优先用网易云搜索 (通常结果更准)
  const neteaseResults = await searchNeteaseMusic(songName, artistName);
  if (neteaseResults.length > 0) {
    songData = neteaseResults[0];
  } else {
    // 策略2：如果网易云找不到，再用QQ音乐搜一次
    const tencentResults = await searchTencentMusic(songName);
    if (tencentResults.length > 0) {
      songData = tencentResults[0];
    }
  }

  if (!songData) {
    await showCustomAlert(
      "Phát thất bại",
      `Xin lỗi, không tìm thấy nguồn phát được cho 《${songName}》 trên cả NetEase Cloud và QQ Music.`,
    );
    return;
  }

  // 获取播放链接
  const apiUrl =
    songData.source === "netease"
      ? `https://api.vkeys.cn/v2/music/netease?id=${songData.id}`
      : `https://api.vkeys.cn/v2/music/tencent?id=${songData.id}`;

  const result = await Http_Get(apiUrl);

  if (!result?.data?.url || !(await checkAudioAvailability(result.data.url))) {
    await showCustomAlert(
      "Lấy thất bại",
      `Đã tìm thấy 《${songName}》 nhưng không lấy được link phát hợp lệ.`,
    );
    return;
  }

  // 获取歌词
  const lrcContent =
    (await getLyricsForSong(songData.id, songData.source)) || "";

  // 创建新的歌曲对象并添加到播放列表
  const newSong = {
    name: songData.name,
    artist: songData.artist,
    src: result.data.url,
    cover: songData.cover,
    lrcContent: lrcContent,
  };

  lsMusicState.playlist.push(newSong);

  // 播放这首新添加的歌曲
  playLSSong(lsMusicState.playlist.length - 1);

  // 打开播放器
  document.getElementById("ls-music-player-overlay").classList.add("visible");
}

/**
 * 播放指定索引的歌曲
 * @param {number} index - 歌曲在播放列表中的索引
 */
async function playLSSong(index) {
  if (index < 0 || index >= lsMusicState.playlist.length) return;

  lsMusicState.currentIndex = index;
  const track = lsMusicState.playlist[index];
  const lsAudioPlayer = document.getElementById("ls-audio-player");

  // 解析和渲染歌词
  track.parsedLyrics = parseLRC(track.lrcContent || ""); // 复用已有的歌词解析函数
  track.currentLyricIndex = -1;
  renderLSLyrics(track);

  lsAudioPlayer.src = track.src;
  try {
    await lsAudioPlayer.play();
    lsMusicState.isPlaying = true;
  } catch (error) {
    console.error("情侣空间音乐播放失败:", error);
    lsMusicState.isPlaying = false;
  }

  renderLSMusicPlayerUI();
  renderLSMusicPlaylist();
}

/**
 * 切换播放/暂停状态 (情侣空间版)
 */
function toggleLSMusicPlayPause() {
  const lsAudioPlayer = document.getElementById("ls-audio-player");
  if (lsMusicState.currentIndex === -1 && lsMusicState.playlist.length > 0) {
    // 如果列表有歌但还没开始播，点击播放就从第一首开始
    playLSSong(0);
    return;
  }

  if (lsAudioPlayer.paused) {
    lsAudioPlayer.play();
    lsMusicState.isPlaying = true;
  } else {
    lsAudioPlayer.pause();
    lsMusicState.isPlaying = false;
  }
  renderLSMusicPlayerUI();
}

/**
 * 播放下一首 (情侣空间版)
 */
function playNextLSSong() {
  if (lsMusicState.playlist.length === 0) return;
  const newIndex =
    (lsMusicState.currentIndex + 1) % lsMusicState.playlist.length;
  playLSSong(newIndex);
}

/**
 * 播放上一首 (情侣空间版)
 */
function playPrevLSSong() {
  if (lsMusicState.playlist.length === 0) return;
  const newIndex =
    (lsMusicState.currentIndex - 1 + lsMusicState.playlist.length) %
    lsMusicState.playlist.length;
  playLSSong(newIndex);
}

/**
 * 更新播放器界面 (情侣空间版)
 */
function renderLSMusicPlayerUI() {
  const track = lsMusicState.playlist[lsMusicState.currentIndex];

  if (track) {
    document.getElementById("ls-album-cover").src = track.cover;
    document.getElementById("ls-song-title").textContent = track.name;
    document.getElementById("ls-artist").textContent = track.artist;
  } else {
    document.getElementById("ls-album-cover").src =
      "https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png";
    document.getElementById("ls-song-title").textContent = "Chưa có bài hát";
    document.getElementById("ls-artist").textContent = "...";
  }

  document.getElementById("ls-play-pause-btn").textContent =
    lsMusicState.isPlaying ? "❚❚" : "▶";
}

/**
 * 更新进度条 (情侣空间版)
 */
function updateLSProgressBar() {
  const lsAudioPlayer = document.getElementById("ls-audio-player");
  const currentTimeEl = document.getElementById("ls-current-time");
  const totalTimeEl = document.getElementById("ls-total-time");
  const progressFillEl = document.getElementById("ls-progress-fill");

  if (!lsAudioPlayer.duration) {
    currentTimeEl.textContent = "0:00";
    totalTimeEl.textContent = "0:00";
    progressFillEl.style.width = "0%";
    return;
  }

  const progressPercent =
    (lsAudioPlayer.currentTime / lsAudioPlayer.duration) * 100;
  progressFillEl.style.width = `${progressPercent}%`;
  currentTimeEl.textContent = formatMusicTime(lsAudioPlayer.currentTime);
  totalTimeEl.textContent = formatMusicTime(lsAudioPlayer.duration);
  updateLSCurrentLyric(lsAudioPlayer.currentTime);
}

/**
 * 渲染播放列表 (情侣空间版)
 */
function renderLSMusicPlaylist() {
  const playlistBody = document.getElementById("ls-playlist-body");
  playlistBody.innerHTML = "";

  if (lsMusicState.playlist.length === 0) {
    playlistBody.innerHTML =
      '<p style="text-align:center; padding: 20px; color: #888;">Danh sách phát trống</p>';
    return;
  }

  lsMusicState.playlist.forEach((track, index) => {
    const item = document.createElement("div");
    item.className = "playlist-item";
    if (index === lsMusicState.currentIndex) {
      item.classList.add("playing");
    }
    item.innerHTML = `
            <div class="playlist-item-info">
                <div class="title">${track.name}</div>
                <div class="artist">${track.artist}</div>
            </div>
            <div class="playlist-item-actions">
                <span class="playlist-action-btn delete-track-btn" data-index="${index}">×</span>
            </div>
        `;
    item
      .querySelector(".playlist-item-info")
      .addEventListener("click", () => playLSSong(index));
    playlistBody.appendChild(item);
  });
}

/**
 * 渲染歌词列表 (情侣空间版)
 * @param {object} track - 歌曲对象
 */
function renderLSLyrics(track) {
  const lyricsList = document.getElementById("ls-lyrics-list");
  lyricsList.innerHTML = "";
  if (!track.parsedLyrics || track.parsedLyrics.length === 0) {
    lyricsList.innerHTML = '<div class="lyric-line active">♪ Chưa có lời bài hát ♪</div>';
    return;
  }
  track.parsedLyrics.forEach((line, index) => {
    const lineEl = document.createElement("div");
    lineEl.className = "lyric-line";
    lineEl.textContent = line.text;
    lineEl.dataset.index = index;
    lyricsList.appendChild(lineEl);
  });
  lyricsList.style.transform = `translateY(45%)`; // 初始位置
}

/**
 * 更新当前高亮的歌词 (情侣空间版)
 * @param {number} currentTime - 当前播放时间
 */
function updateLSCurrentLyric(currentTime) {
  const track = lsMusicState.playlist[lsMusicState.currentIndex];
  if (!track || !track.parsedLyrics || track.parsedLyrics.length === 0) return;

  let newLyricIndex = -1;
  for (let i = 0; i < track.parsedLyrics.length; i++) {
    if (currentTime >= track.parsedLyrics[i].time) {
      newLyricIndex = i;
    } else {
      break;
    }
  }

  if (newLyricIndex !== track.currentLyricIndex) {
    track.currentLyricIndex = newLyricIndex;

    const lyricsList = document.getElementById("ls-lyrics-list");
    const container = document.getElementById("ls-lyrics-container");

    lyricsList
      .querySelectorAll(".lyric-line")
      .forEach((line) => line.classList.remove("active"));

    if (newLyricIndex > -1) {
      const activeLine = lyricsList.querySelector(
        `.lyric-line[data-index="${newLyricIndex}"]`,
      );
      if (activeLine) {
        activeLine.classList.add("active");
        // 计算滚动偏移量，让高亮行垂直居中
        const offset =
          container.offsetHeight / 2 -
          activeLine.offsetTop -
          activeLine.offsetHeight / 2;
        lyricsList.style.transform = `translateY(${offset}px)`;
      }
    }
  }
}

/**
 * 清空播放列表 (情侣空间版)
 */
function clearLSMusicPlaylist() {
  const lsAudioPlayer = document.getElementById("ls-audio-player");
  lsAudioPlayer.pause();
  lsAudioPlayer.src = "";

  lsMusicState.playlist = [];
  lsMusicState.currentIndex = -1;
  lsMusicState.isPlaying = false;

  renderLSMusicPlayerUI();
  renderLSMusicPlaylist();
}

/**
 * 打开番茄钟主页并渲染历史记录
 */
async function openPomodoroScreen() {
  if (!activeLoversSpaceCharId) return;
  await renderPomodoroHistory(activeLoversSpaceCharId);

  // 确保显示的是主页，而不是计时器界面
  document.getElementById("ls-pomodoro-home").style.display = "flex";
  document.getElementById("ls-pomodoro-timer-active").style.display = "none";
}

/**
 * 渲染指定角色的番茄钟历史记录 (已修改：添加删除功能)
 */
async function renderPomodoroHistory(charId) {
  const listEl = document.getElementById("ls-pomodoro-history-list");
  listEl.innerHTML = "";
  const sessions = await db.pomodoroSessions
    .where("chatId")
    .equals(charId)
    .reverse()
    .sortBy("startTime");

  if (sessions.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); font-size: 14px;">Chưa có bản ghi tập trung nào</p>';
    return;
  }

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "pomodoro-history-item";
    // 设为 relative 方便定位删除按钮
    item.style.position = "relative";
    item.dataset.sessionId = session.id;

    // ★★★ 修改点：添加删除按钮 HTML ★★★
    item.innerHTML = `
            <div class="task">${session.task}</div>
            <div class="meta">
${new Date(
                  session.startTime,
                ).toLocaleString()} | Tập trung ${Math.round(
                  session.duration / 60,
                )} phút
            </div>
<button class="pomodoro-delete-btn" style="
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: transparent;
                border: 1px solid #ff3b30;
                color: #ff3b30;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 12px;
                cursor: pointer;
            ">Xóa</button>
        `;

    // 点击卡片主体查看详情
    item.addEventListener("click", (e) => {
      // 如果点的是删除按钮，不要触发查看详情
      if (e.target.classList.contains("pomodoro-delete-btn")) return;
      showPomodoroHistoryDetail(session.id);
    });

    // ★★★ 修改点：绑定删除事件 ★★★
    const deleteBtn = item.querySelector(".pomodoro-delete-btn");
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // 阻止冒泡
      const confirmed = await showCustomConfirm(
        "Xóa bản ghi",
        "Bạn có chắc muốn xóa bản ghi tập trung này?",
        { confirmButtonClass: "btn-danger" },
      );
      if (confirmed) {
        await db.pomodoroSessions.delete(session.id);
        await renderPomodoroHistory(charId); // 重新渲染列表
      }
    });

    listEl.appendChild(item);
  });
}

/**
 * 显示指定历史记录的聊天详情 (已修改：支持专注/休息 分页查看)
 */
async function showPomodoroHistoryDetail(sessionId) {
  const session = await db.pomodoroSessions.get(sessionId);
  if (!session) return;

  const modal = document.getElementById("ls-pomodoro-history-viewer-modal");
  const titleEl = document.getElementById("pomodoro-history-viewer-title");
  const contentEl = document.getElementById("pomodoro-history-viewer-content");

  titleEl.textContent = `"${session.task}"`;

  // ★★★ 修改点：重写 contentEl 的内部结构，加入页签和列表容器 ★★★
  contentEl.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
<button id="pomo-tab-focus" style="flex:1; padding: 8px; border:none; background: #e0f7fa; color: #006064; border-radius: 8px; font-weight:bold;">Trong lúc tập trung</button>
<button id="pomo-tab-break" style="flex:1; padding: 8px; border:none; background: #f5f5f5; color: #666; border-radius: 8px;">Nghỉ ngơi tán gẫu</button>
    </div>
    <div id="pomo-detail-list" style="flex:1; overflow-y: auto;"></div>
  `;

  const listContainer = document.getElementById("pomo-detail-list");
  const tabFocus = document.getElementById("pomo-tab-focus");
  const tabBreak = document.getElementById("pomo-tab-break");

  // 渲染列表的辅助函数
  const renderList = (logs, emptyText) => {
    listContainer.innerHTML = "";
    if (!logs || logs.length === 0) {
      listContainer.innerHTML = `<p style="text-align:center; color: var(--text-secondary); margin-top:20px;">${emptyText}</p>`;
      return;
    }
    logs.forEach((logEntry) => {
      const bubble = document.createElement("div");
      // 简单的样式区分用户和AI (如果数据里有role)
      const isUser = logEntry.role === "user";
      bubble.className = "pomodoro-log-bubble";
      bubble.style.alignSelf = isUser ? "flex-end" : "flex-start";
      bubble.style.background = isUser ? "#d1e7dd" : "#fff";
      bubble.style.maxWidth = "80%";
      bubble.style.padding = "8px 12px";
      bubble.style.borderRadius = "12px";
      bubble.style.marginBottom = "8px";
      bubble.style.fontSize = "14px";

      // 兼容旧数据（旧数据 logEntry 可能没有 role，只有 content）
      let text = logEntry.content || logEntry;
      if (typeof logEntry === "string") text = logEntry;

      bubble.textContent = text;

      // 给列表容器设为 flex 布局方便左右对齐
      listContainer.style.display = "flex";
      listContainer.style.flexDirection = "column";

      listContainer.appendChild(bubble);
    });
  };

  // 绑定页签点击事件
  tabFocus.onclick = () => {
    tabFocus.style.background = "#e0f7fa";
    tabFocus.style.color = "#006064";
    tabBreak.style.background = "#f5f5f5";
    tabBreak.style.color = "#666";
    renderList(session.log, "Không có lịch sử chat trong lúc tập trung.");
  };

  tabBreak.onclick = () => {
    tabBreak.style.background = "#fff3cd";
    tabBreak.style.color = "#856404";
    tabFocus.style.background = "#f5f5f5";
    tabFocus.style.color = "#666";
    // 读取我们在第一步保存的 breakLogs
    renderList(session.breakLogs, "Không có lịch sử chat trong lúc nghỉ.");
  };

  // 默认显示专注记录
  renderList(session.log, "Không có lịch sử chat trong lúc tập trung.");

  modal.classList.add("visible");
}

/**
 * 打开番茄钟设置弹窗
 */
function openPomodoroSetup() {
  document.getElementById("pomodoro-task-input").value = "";
  document.getElementById("pomodoro-duration-input").value = "25";
  document.getElementById("pomodoro-talk-interval-input").value = "5";
  document.getElementById("pomodoro-bg-url-input").value = "";

  // 每次打开时，清空上一次本地上传的临时数据
  pomodoroState.tempBgDataUrl = null;
  // === [新增] 初始化 BGM UI ===
  const sourceSelect = document.getElementById("pomodoro-bgm-source-select");
  const customPanel = document.getElementById("pomodoro-custom-playlist-panel");

  sourceSelect.value = "none"; // 默认静音
  customPanel.style.display = "none";

  // 如果之前存过自定义歌单，渲染一下
  renderPomodoroCustomListUI();
  document.getElementById("ls-pomodoro-setup-modal").classList.add("visible");
}
// [新增] 渲染设置弹窗里的自定义歌单列表
function renderPomodoroCustomListUI() {
  const listEl = document.getElementById("pomodoro-custom-list");
  listEl.innerHTML = "";

  if (pomodoroCustomPlaylist.length === 0) {
    listEl.innerHTML =
      '<p style="color:#999; text-align:center; margin: 10px 0;">Chưa có bài hát</p>';
    return;
  }

  pomodoroCustomPlaylist.forEach((track, index) => {
    const item = document.createElement("div");
    item.style.cssText =
      "display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #eee;";
    item.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">${track.name}</span>
            <span style="cursor:pointer; color:#ff3b30;" onclick="removePomodoroCustomSong(${index})">×</span>
        `;
    listEl.appendChild(item);
  });
}

// [新增] 移除自定义歌曲
window.removePomodoroCustomSong = function (index) {
  pomodoroCustomPlaylist.splice(index, 1);
  renderPomodoroCustomListUI();
};

// [新增] 播放当前的 BGM
async function playPomodoroBGM() {
  if (pomodoroState.bgmPlaylist.length === 0) return;

  const track = pomodoroState.bgmPlaylist[pomodoroState.bgmIndex];
  if (!track) return;

  // 如果是 Blob 对象（本地文件），生成 URL
  if (track.isLocal && track.src instanceof File) {
    pomodoroState.bgmAudio.src = URL.createObjectURL(track.src);
  } else {
    pomodoroState.bgmAudio.src = track.src;
  }

  pomodoroState.bgmAudio.volume = 0.5; // 默认音量 50%
  try {
    await pomodoroState.bgmAudio.play();
  } catch (e) {
    console.error("番茄钟BGM播放失败:", e);
  }
}

/**
 * 开始番茄钟专注会话 (已修改：支持暂停功能)
 */
async function startPomodoroSession() {
  const task = document.getElementById("pomodoro-task-input").value.trim();
  // 获取用户选择的计时模式
  const timerType = document.querySelector(
    'input[name="pomodoro-mode"]:checked',
  ).value;
  const durationMinutes = parseInt(
    document.getElementById("pomodoro-duration-input").value,
  );
  const talkIntervalMinutes = parseInt(
    document.getElementById("pomodoro-talk-interval-input").value,
  );
  const bgUrl =
    pomodoroState.tempBgDataUrl ||
    document.getElementById("pomodoro-bg-url-input").value.trim();
  // === [修改] 获取 BGM 设置 ===
  const bgmSource = document.getElementById("pomodoro-bgm-source-select").value;
  pomodoroState.bgmSource = bgmSource;
  pomodoroState.bgmPlaylist = [];
  pomodoroState.bgmIndex = 0;

  // 根据选择填充播放列表
  if (bgmSource === "global") {
    // 从 main-app.js 的全局 state 获取（排除保活音频）
    pomodoroState.bgmPlaylist = (window.state.musicState.playlist || []).filter(
      (t) => !t.isKeepAlive,
    );
  } else if (bgmSource === "custom") {
    pomodoroState.bgmPlaylist = [...pomodoroCustomPlaylist];
  }

  if (bgmSource !== "none" && pomodoroState.bgmPlaylist.length === 0) {
    alert("Danh sách nhạc bạn chọn đang trống, sẽ bắt đầu ở chế độ tắt tiếng.");
  }

  if (!task) {
    alert("Vui lòng nhập một nhiệm vụ tập trung!");
    return;
  }
  // 如果是倒计时模式，才需要检查时长是否有效
  if (
    timerType === "countdown" &&
    (isNaN(durationMinutes) || durationMinutes < 1)
  ) {
    alert("Ở chế độ đếm ngược, vui lòng nhập thời lượng tập trung hợp lệ!");
    return;
  }

  const chat = state.chats[activeLoversSpaceCharId];
  // 根据模式，设置总时长（正计时模式总时长为0，因为它会一直增加）
  const durationSeconds = timerType === "countdown" ? durationMinutes * 60 : 0;

  // --- 1. 初始化状态 (新增 isPaused 和 breakHistory) ---
  pomodoroState.currentSession = {
    chatId: activeLoversSpaceCharId,
    task: task,
    duration: durationSeconds,
    timerType: timerType, // 把计时模式也保存到会话记录里
    startTime: Date.now(),
    log: [],
  };
  pomodoroState.isPaused = false; // 【新增】重置暂停状态
  pomodoroState.breakHistory = []; // 【新增】重置休息聊天记录

  // --- 2. UI 界面切换 ---
  const timerView = document.getElementById("ls-pomodoro-timer-active");
  document.getElementById("ls-pomodoro-home").style.display = "none";
  timerView.style.display = "flex";

  // 设置背景图
  if (bgUrl) {
    timerView.style.backgroundImage = `url(${bgUrl})`;
  } else {
    timerView.style.backgroundImage = `url(${chat.settings.aiAvatar})`;
  }

  // 设置头像和任务名
  document.getElementById("pomodoro-char-avatar").src = chat.settings.aiAvatar;
  document.getElementById("pomodoro-current-task").textContent = task;

  // --- 【新增】重置暂停按钮的状态 ---
  // 防止上次结束后按钮还停留在"继续"的状态
  const pauseBtn = document.getElementById("pomodoro-pause-btn");
  if (pauseBtn) {
    pauseBtn.textContent = "Tạm dừng / Nghỉ";
    pauseBtn.style.backgroundColor = "#ffca28";
  }

  // --- 3. 核心计时逻辑 (已修改支持暂停) ---

  // 将 timeTracker 存储在全局状态中，方便暂停/恢复时读取
  pomodoroState.timeTracker = timerType === "countdown" ? durationSeconds : 0;
  updatePomodoroTimerDisplay(pomodoroState.timeTracker);

  pomodoroState.timerId = setInterval(() => {
    // 【核心修改】如果处于暂停状态，直接跳过本次计时
    if (pomodoroState.isPaused) return;

    // 根据模式决定是增加还是减少时间
    if (timerType === "countdown") {
      pomodoroState.timeTracker--;
      if (pomodoroState.timeTracker <= 0) {
        updatePomodoroTimerDisplay(0); // 确保显示00:00
        endPomodoroSession(true); // 倒计时结束
      }
    } else {
      // 'countup'
      pomodoroState.timeTracker++;
    }

    // 只有没暂停的时候才更新UI显示，避免闪烁
    if (!pomodoroState.isPaused) {
      updatePomodoroTimerDisplay(pomodoroState.timeTracker);
    }
  }, 1000);

  // --- 4. 角色定时说话逻辑 (已修改支持暂停) ---
  if (talkIntervalMinutes > 0) {
    pomodoroState.periodicTalkTimerId = setInterval(
      () => {
        // 【核心修改】暂停时不触发主动说话，以免打扰休息
        if (!pomodoroState.isPaused) {
          triggerPomodoroAIResponse("periodic_encouragement");
        }
      },
      talkIntervalMinutes * 60 * 1000,
    );
  }
  // === [修改] 开始播放音乐 ===
  if (bgmSource !== "none" && pomodoroState.bgmPlaylist.length > 0) {
    // 暂停主播放器
    const mainAudio = document.getElementById("audio-player");
    const lsAudio = document.getElementById("ls-audio-player");
    if (mainAudio) mainAudio.pause();
    if (lsAudio) lsAudio.pause();

    // 播放第一首
    playPomodoroTrack(0);
  } else {
    // 确保清理旧源
    pomodoroState.bgmAudio.pause();
    pomodoroState.bgmAudio.src = "";
  }

  // --- 5. 完成启动 ---
  pomodoroState.isActive = true;
  document
    .getElementById("ls-pomodoro-setup-modal")
    .classList.remove("visible");

  // 向主聊天记录写入开始消息
  const hiddenMessage = {
    role: "system",
    content: `[Chỉ thị hệ thống: người dùng vừa cùng bạn bắt đầu một nhiệm vụ tập trung Pomodoro: "${task}", thời lượng ${durationMinutes} phút. Trong lúc tập trung, bạn có thể dùng chỉ thị "pomodoro_talk" để động viên người dùng.]`,
    timestamp: Date.now(),
    isHidden: true,
  };
  chat.history.push(hiddenMessage);
  await db.chats.put(chat);
}
function togglePomodoroPause() {
  if (!pomodoroState.isActive) return;

  const pauseBtn = document.getElementById("pomodoro-pause-btn");

  // 切换状态
  pomodoroState.isPaused = !pomodoroState.isPaused;

  if (pomodoroState.isPaused) {
    // === 进入暂停状态 ===
    pauseBtn.textContent = "Tiếp tục tập trung";
    pauseBtn.style.backgroundColor = "#4CAF50"; // 变为绿色

    // 自动打开休息聊天窗口
    openPomodoroBreakChat();
    pomodoroState.bgmAudio.pause();
  } else {
    // === 恢复专注状态 ===
    pauseBtn.textContent = "Tạm dừng / Nghỉ";
    pauseBtn.style.backgroundColor = "#ffca28"; // 变回黄色
    // [新增] 恢复 BGM
    if (pomodoroState.bgmPlaylist.length > 0) {
      pomodoroState.bgmAudio.play().catch((e) => console.error(e));
    }
  }
}
// 打开休息聊天窗口
function openPomodoroBreakChat() {
  const modal = document.getElementById("pomodoro-break-modal");
  const messagesEl = document.getElementById("pomodoro-break-messages");

  // 如果是第一次打开且没有记录，清空（保留提示语）
  if (pomodoroState.breakHistory.length === 0) {
    messagesEl.innerHTML =
      '<div style="text-align: center; color: #999; font-size: 13px; margin-bottom:10px;">Mệt rồi à? Trò chuyện với tôi đi~</div>';
  }

  modal.classList.add("visible");
}

// 关闭休息聊天窗口（不等于恢复专注，只是关窗口）
function closePomodoroBreakChat() {
  document.getElementById("pomodoro-break-modal").classList.remove("visible");
}

async function sendPomodoroBreakMessage() {
  const input = document.getElementById("pomodoro-break-input");
  const text = input.value.trim();
  if (!text) return;

  const chat = state.chats[activeLoversSpaceCharId];
  const messagesEl = document.getElementById("pomodoro-break-messages");

  // --- 获取用户头像 ---
  const userAvatar = chat.settings.myAvatar || defaultAvatar;

  // --- 构建带头像的消息 HTML ---
  const rowDiv = document.createElement("div");
  rowDiv.className = "break-message-row user";
  rowDiv.innerHTML = `
        <img src="${userAvatar}" class="break-avatar">
        <div class="pomodoro-break-bubble user">${text.replace(
          /\n/g,
          "<br>",
        )}</div>
    `;
  messagesEl.appendChild(rowDiv);

  // 记录历史
  pomodoroState.breakHistory.push({ role: "user", content: text });

  input.value = "";
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // 触发AI回复
  await triggerPomodoroBreakResponse(text);
}

async function triggerPomodoroBreakResponse(userText) {
  const chat = state.chats[activeLoversSpaceCharId];
  if (!chat) return;

  const messagesEl = document.getElementById("pomodoro-break-messages");
  const aiAvatar = chat.settings.aiAvatar || defaultAvatar;

  // --- 1. 显示 Loading 状态 ---
  const loadingRow = document.createElement("div");
  loadingRow.className = "break-message-row ai loading-temp";
  loadingRow.innerHTML = `
        <img src="${aiAvatar}" class="break-avatar">
        <div class="pomodoro-break-bubble ai">...</div>
    `;
  messagesEl.appendChild(loadingRow);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // --- 2. 准备上下文 ---

  // 2.1 世界书
  let worldBookContext = "";
  if (
    chat.settings.linkedWorldBookIds &&
    chat.settings.linkedWorldBookIds.length > 0
  ) {
    const linkedContents = chat.settings.linkedWorldBookIds
      .map((id) => {
        const book = state.worldBooks.find((b) => b.id === id);
        return book && book.content
          ? `\n\n## Mục Sách thế giới: ${book.name}\n${book.content}`
          : "";
      })
      .filter(Boolean)
      .join("");
    if (linkedContents) {
      worldBookContext = `\n# Thiết lập thế giới quan cốt lõi (phải tham khảo)\n${linkedContents}\n`;
    }
  }

  // 2.2 用户信息
  const userNickname = chat.settings.myNickname || "Tôi";
  const userPersona = chat.settings.myPersona || "Không có thiết lập đặc biệt";

  // --- 3. 构建强化的 Prompt ---
  const { proxyUrl, apiKey, model } = state.apiConfig;

  const systemPrompt = `
    # Bối cảnh
Bây giờ bạn là nhân vật "${chat.name}".
Bạn đang cùng người dùng làm nhiệm vụ tập trung Pomodoro, giờ là 【thời gian nghỉ】.
Người dùng vừa nói với bạn: "${userText}"

# Thiết lập cốt lõi của bạn (phải tuân thủ nghiêm ngặt, từ chối OOC)
    ${chat.settings.aiPersona}

# Thiết lập đối tượng chat (người dùng)
- Tên: ${userNickname}
- Thiết lập: ${userPersona}
(hãy dựa vào thiết lập của người dùng và quan hệ giữa hai bạn để điều chỉnh giọng điệu và cách xưng hô)

    ${worldBookContext}

# Nhiệm vụ của bạn
1.  **Nhập vai sâu**: Phải hoàn toàn nhập vào thiết lập nhân vật, dùng giọng, từ cảm thán, cách nói quen thuộc của bạn để trả lời bằng tiếng Việt. Nếu là kiểu lạnh lùng thì ngắn gọn, nếu là kiểu dễ thương thì hoạt bát hơn.
2.  **Trả lời nhiều tin**: Mô phỏng người thật chat, **đừng** nhét hết vào một bong bóng. Hãy chia câu trả lời thành **2 đến 5 tin** ngắn gọn, tự nhiên.
3.  **Chủ đề**: Đây là giờ nghỉ, có thể nói về nhiệm vụ vừa rồi, hỏi han người dùng có mệt không, hoặc tán gẫu tùy ý, thậm chí làm nũng hay trêu chọc.

# 【Quy tắc sắt về định dạng】 (phải tuân thủ)
Câu trả lời của bạn 【bắt buộc và chỉ được】 là một **mảng JSON** nghiêm ngặt, định dạng như sau:
    [
{"content": "câu đầu tiên muốn nói"},
{"content": "câu thứ hai muốn nói (tùy chọn)"},
{"content": "câu thứ ba muốn nói (tùy chọn)"}
    ]
Đừng kèm bất kỳ ký hiệu markdown hay chữ giải thích nào khác.
    `;

  // 这里的 messagesForApi 需要符合 API 的上下文结构
  const contextMessages = pomodoroState.breakHistory.slice(-5).map((msg) => ({
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content,
  }));

  const messagesForApi = [
    { role: "system", content: systemPrompt },
    ...contextMessages,
  ];

  try {
    let isGemini = proxyUrl.includes("generativelanguage");
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
            temperature: 0.85, // 稍微再调高一点点温度，让闲聊更有趣
          }),
        });

    if (!response.ok) throw new Error("API Error");

    const data = await response.json();
    let aiRawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    ).trim();

    // --- 4. 解析与渲染 ---

    // 移除 loading
    loadingRow.remove();

    // 净化 JSON
    aiRawContent = aiRawContent
      .replace(/^```json\s*/, "")
      .replace(/```$/, "")
      .trim();

    let messagesArray = [];
    try {
      messagesArray = JSON.parse(aiRawContent);
      if (!Array.isArray(messagesArray)) {
        messagesArray = [messagesArray];
      }
    } catch (e) {
      console.warn("休息时间 JSON 解析失败，回退到纯文本模式", e);
      messagesArray = [{ content: aiRawContent }];
    }

    // 遍历数组，逐条发送
    for (const msg of messagesArray) {
      if (!msg.content) continue;

      const aiRow = document.createElement("div");
      aiRow.className = "break-message-row ai";
      aiRow.innerHTML = `
            <img src="${aiAvatar}" class="break-avatar">
            <div class="pomodoro-break-bubble ai">${msg.content.replace(
              /\n/g,
              "<br>",
            )}</div>
        `;
      messagesEl.appendChild(aiRow);

      // 存入历史
      pomodoroState.breakHistory.push({
        role: "assistant",
        content: msg.content,
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;

      // 模拟打字延迟
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch (e) {
    console.error(e);
    loadingRow.remove();
    const errorRow = document.createElement("div");
    errorRow.className = "break-message-row ai";
    errorRow.innerHTML = `
            <img src="${aiAvatar}" class="break-avatar">
<div class="pomodoro-break-bubble ai" style="color:red;">(Huhu... hình như mạng bị kẹt rồi)</div>
        `;
    messagesEl.appendChild(errorRow);
  }
}

/**
 * 更新番茄钟的倒计时显示
 * @param {number} secondsLeft - 剩余秒数
 */
function updatePomodoroTimerDisplay(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  document.getElementById("pomodoro-time").textContent = `${String(
    minutes,
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
/**
 * 结束番茄钟专注会话 (已修改：保存休息记录)
 */
async function endPomodoroSession(isCompleted = false) {
  if (!pomodoroState.isActive) return;

  clearInterval(pomodoroState.timerId);
  clearInterval(pomodoroState.periodicTalkTimerId);
  // === [新增] 停止音乐 ===
  pomodoroState.bgmAudio.pause();
  pomodoroState.bgmAudio.src = "";
  // 1. 计算最终时长
  if (pomodoroState.currentSession.timerType === "countup") {
    pomodoroState.currentSession.duration = Math.floor(
      (Date.now() - pomodoroState.currentSession.startTime) / 1000,
    );
  }

  pomodoroState.currentSession.endTime = Date.now();

  // ★★★ 修改点 1：将休息时的聊天记录单独保存到数据库对象中 ★★★
  pomodoroState.currentSession.breakLogs = [...pomodoroState.breakHistory];

  await db.pomodoroSessions.add(pomodoroState.currentSession);

  document.getElementById("ls-pomodoro-timer-active").style.display = "none";
  document.getElementById("ls-pomodoro-home").style.display = "flex";

  // 刷新列表
  await renderPomodoroHistory(activeLoversSpaceCharId);

  pomodoroState = {
    isActive: false,
    isPaused: false,
    timerId: null,
    periodicTalkTimerId: null,
    currentSession: null,
    breakHistory: [],
    timeTracker: 0,
    // 保留BGM Audio对象，但清空播放列表
    bgmAudio: pomodoroState.bgmAudio,
    bgmPlaylist: [],
    bgmIndex: 0,
    bgmSource: "none",
  };

  const chat = state.chats[activeLoversSpaceCharId];
  const endReason = isCompleted ? "Hết giờ, nhiệm vụ đã hoàn thành" : "Bị người dùng dừng thủ công";
  const hiddenMessage = {
    role: "system",
    content: `[Chỉ thị hệ thống: nhiệm vụ tập trung Pomodoro đã kết thúc. Lý do kết thúc: ${endReason}.]`,
    timestamp: Date.now(),
    isHidden: true,
  };
  chat.history.push(hiddenMessage);
  await db.chats.put(chat);

  if (isCompleted) {
    showCustomAlert("Hoàn thành tập trung!", "Chúc mừng bạn đã hoàn thành một phiên tập trung, nghỉ ngơi chút đi!");
  } else {
    showCustomAlert("Kết thúc tập trung", "Bạn đã dừng phiên tập trung này.");
  }
}
// 播放指定索引的歌曲
async function playPomodoroTrack(index) {
  if (pomodoroState.bgmPlaylist.length === 0) return;

  // 越界保护
  if (index >= pomodoroState.bgmPlaylist.length) index = 0;
  if (index < 0) index = pomodoroState.bgmPlaylist.length - 1;

  pomodoroState.bgmIndex = index;
  const track = pomodoroState.bgmPlaylist[index];

  // 处理源
  if (track.isLocal && track.src instanceof File) {
    pomodoroState.bgmAudio.src = URL.createObjectURL(track.src);
  } else {
    pomodoroState.bgmAudio.src = track.src;
  }

  pomodoroState.bgmAudio.volume = 0.5;

  try {
    await pomodoroState.bgmAudio.play();
  } catch (e) {
    console.error("BGM播放失败:", e);
  }
  updatePomoMusicUI();
}

// 播放/暂停切换
function togglePomoMusic() {
  if (pomodoroState.bgmAudio.paused) {
    if (pomodoroState.bgmAudio.src) pomodoroState.bgmAudio.play();
    else playPomodoroTrack(pomodoroState.bgmIndex); // 如果还没源，重新加载
  } else {
    pomodoroState.bgmAudio.pause();
  }
  updatePomoMusicUI();
}

// 下一首
function playNextPomoMusic() {
  playPomodoroTrack(pomodoroState.bgmIndex + 1);
}

// 上一首
function playPrevPomoMusic() {
  playPomodoroTrack(pomodoroState.bgmIndex - 1);
}
// 更新弹窗 UI
function updatePomoMusicUI() {
  const titleEl = document.getElementById("pomo-music-title");
  const artistEl = document.getElementById("pomo-music-artist");
  const coverEl = document.getElementById("pomo-music-cover");
  const discAnim = document.getElementById("pomo-disc-anim");

  // 图标切换
  const iconPlay = document.getElementById("pomo-icon-play");
  const iconPause = document.getElementById("pomo-icon-pause");

  // 1. 更新顶部信息
  if (pomodoroState.bgmPlaylist.length > 0) {
    const currentTrack = pomodoroState.bgmPlaylist[pomodoroState.bgmIndex];
    titleEl.textContent = currentTrack.name || "Bài hát không xác định";
    artistEl.textContent = currentTrack.artist || "Nghệ sĩ không xác định";
    // 如果有封面就用封面，没有就用默认占位图
    coverEl.src =
      currentTrack.cover ||
      "https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png";
  } else {
    titleEl.textContent = "Danh sách trống";
    artistEl.textContent = "";
    coverEl.src = "https://i.postimg.cc/pT2xKzPz/album-cover-placeholder.png";
  }

  // 2. 更新播放状态 (图标 + 旋转动画)
  if (pomodoroState.bgmAudio.paused) {
    iconPlay.style.display = "block";
    iconPause.style.display = "none";
    discAnim.classList.remove("playing"); // 停止旋转
  } else {
    iconPlay.style.display = "none";
    iconPause.style.display = "block";
    discAnim.classList.add("playing"); // 开始旋转
  }

  // 3. 更新列表高亮
  if (
    document
      .getElementById("pomodoro-music-modal")
      .classList.contains("visible")
  ) {
    renderPomoMusicList();
  }
}
// 渲染播放列表
function renderPomoMusicList() {
  const listEl = document.getElementById("pomo-music-list");
  listEl.innerHTML = "";

  if (pomodoroState.bgmPlaylist.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center;color:#999;font-size:13px;margin-top:20px;">Danh sách đang trống</p>';
    return;
  }

  pomodoroState.bgmPlaylist.forEach((track, index) => {
    const item = document.createElement("div");
    item.className = "pomo-playlist-item";
    if (index === pomodoroState.bgmIndex) {
      item.classList.add("active");
    }

    // 使用一个动态的小图标 GIF (或者 emoji) 表示正在播放
    const playingIndicator =
      index === pomodoroState.bgmIndex && !pomodoroState.bgmAudio.paused
        ? "🎵"
        : `${index + 1}`;

    item.innerHTML = `
            <div class="index" style="text-align:center; font-weight:bold; ${index === pomodoroState.bgmIndex ? "color:#ff9a9e;" : ""}">${playingIndicator}</div>
            <div class="info">
                <div class="title">${track.name}</div>
                <div class="artist">${track.artist || "Không xác định"}</div>
            </div>
        `;
    // 点击切歌
    item.addEventListener("click", () => {
      playPomodoroTrack(index);
    });

    listEl.appendChild(item);
  });
}

// 打开 BGM 控制面板
function openPomodoroMusicModal() {
  if (!pomodoroState.isActive) return;

  // 渲染 UI
  updatePomoMusicUI();
  renderPomoMusicList();

  document.getElementById("pomodoro-music-modal").classList.add("visible");
}

/**
 * 触发番茄钟期间的AI互动
 * @param {string} triggerType - 触发类型, 'user_click' 或 'periodic_encouragement'
 */
async function triggerPomodoroAIResponse(triggerType) {
  if (!pomodoroState.isActive || !activeLoversSpaceCharId) return;

  const chat = state.chats[activeLoversSpaceCharId];
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    console.warn("番茄钟AI互动失败：API未配置。");
    return;
  }

  const elapsedSeconds = Math.floor(
    (Date.now() - pomodoroState.currentSession.startTime) / 1000,
  );
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const timeContext = `Người dùng đã tập trung liên tục ${elapsedMinutes} phút.`;
  const triggerReason =
    triggerType === "user_click"
      ? "Người dùng vừa bấm vào ảnh đại diện của bạn, có vẻ cần chút động viên."
      : "Đã tới lúc bạn chủ động động viên người dùng.";

  const systemPrompt = `
# Nhiệm vụ
Bạn đang cùng người dùng tập trung Pomodoro.
- Nhiệm vụ hai bạn đang làm là: "${pomodoroState.currentSession.task}"
- ${timeContext}
- Lý do kích hoạt cuộc trò chuyện này là: ${triggerReason}
- Thiết lập nhân vật của bạn: ${chat.settings.aiPersona}
- Thiết lập đối tượng chat (người dùng) của bạn: ${chat.settings.myPersona}

# Quy tắc cốt lõi
1.  **Giữ tập trung**: Câu trả lời của bạn nên phong phú, có nội dung hơn, khoảng 50 từ, viết bằng tiếng Việt, mục đích là giúp người dùng tiếp tục tập trung vào nhiệm vụ, chứ không phải tán gẫu.
2.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một đối tượng JSON nghiêm ngặt, định dạng như sau: \`{"type": "pomodoro_talk", "content": "lời động viên của bạn..."}\`

Bây giờ, hãy tạo lời động viên của bạn.`;

  const userMessage = {
    role: "user",
    content: `Hãy dựa vào thiết lập nhân vật của bạn và của tôi, nói một đoạn động viên cho nhiệm vụ "${pomodoroState.currentSession.task}" mà tôi đang làm.`,
  };

  try {
    let isGemini = proxyUrl === GEMINI_API_URL;

    let requestBody;
    let requestUrl = `${proxyUrl}/v1/chat/completions`;
    let requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRandomValue(apiKey)}`,
    };

    if (isGemini) {
      requestUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${getRandomValue(
        apiKey,
      )}`;
      requestHeaders = { "Content-Type": "application/json" };
      requestBody = {
        contents: [userMessage],
        generationConfig: {
          temperature: parseFloat(state.apiConfig.temperature) || 0.8,
          response_mime_type: "application/json",
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      };
    } else {
      requestBody = {
        model: model,
        messages: [{ role: "system", content: systemPrompt }, userMessage],
        temperature: parseFloat(state.apiConfig.temperature) || 0.8,
        response_format: { type: "json_object" },
      };
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Yêu cầu API thất bại: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawContent = (
      isGemini
        ? data.candidates[0].content.parts[0].text
        : data.choices[0].message.content
    )
      .replace(/^```json\s*|```$/g, "")
      .trim();
    const responseObj = JSON.parse(rawContent);

    if (responseObj.type === "pomodoro_talk" && responseObj.content) {
      const logEntry = { timestamp: Date.now(), content: responseObj.content };
      pomodoroState.currentSession.log.push(logEntry);

      const logEl = document.getElementById("pomodoro-char-log");
      logEl.textContent = responseObj.content;
      logEl.classList.add("visible");
      setTimeout(() => {
        logEl.classList.remove("visible");
      }, 4000);
    }
  } catch (error) {
    console.error("番茄钟AI互动失败:", error);
    const logEl = document.getElementById("pomodoro-char-log");
    logEl.textContent = `[Lỗi: gọi API thất bại, hãy kiểm tra console F12]`;
    logEl.classList.add("visible");
    setTimeout(() => {
      logEl.classList.remove("visible");
    }, 10000);
  }
}

/**
 * 发送情侣空间邀请
 * @param {string} targetChatId - 被邀请的角色ID
 */
async function sendLoversSpaceInvitation(targetChatId) {
  const chat = state.chats[targetChatId];
  if (!chat) return;

  const myNickname = state.qzoneSettings.nickname || "Tôi";

  // 创建对用户可见的"邀请卡片"消息
  const visibleMessage = {
    role: "user",
    senderName: myNickname,
    type: "lovers_space_invitation",
    content: `${myNickname} đã gửi lời mời Không gian tình nhân tới ${chat.name}`,
    timestamp: Date.now(),
    status: "pending", // 状态：pending, accepted, rejected
  };
  chat.history.push(visibleMessage);

  // 创建对AI可见的"隐藏指令"消息
  const hiddenMessage = {
    role: "system",
    content: `[Chỉ thị hệ thống: người dùng vừa gửi cho bạn lời mời "mở Không gian tình nhân". Hãy dựa vào thiết lập nhân vật để quyết định có đồng ý hay không, và dùng chỉ thị 'lovers_space_response' để phản hồi.]`,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  // 保存并触发AI响应
  await db.chats.put(chat);
  triggerAiResponse();
}

/**
 * 处理用户对情侣空间邀请的回应
 * @param {number} timestamp - 被回应的邀请消息的时间戳
 * @param {string} choice - 用户的选择, 'accepted' 或 'rejected'
 */
async function handleLoversSpaceResponse(timestamp, choice) {
  const chat = state.chats[state.activeChatId];
  if (!chat) return;

  const invitationMsg = chat.history.find((m) => m.timestamp === timestamp);
  if (!invitationMsg || invitationMsg.status !== "pending") return;

  // 更新原始邀请卡片的状态
  invitationMsg.status = choice;

  // 根据用户的选择执行操作
  if (choice === "accepted") {
    // 如果同意，就为这个角色创建情侣空间数据
    chat.loversSpaceData = {
      background: "https://i.postimg.cc/k495F4W5/profile-banner.jpg",
      relationshipStartDate: null,
      moments: [],
      albums: [],
      loveLetters: [],
      shares: [],
      questions: [],
    };

    // 创建一条对用户可见的系统通知
    const systemNotice = {
      role: "system",
      type: "pat_message",
      content: `[Hệ thống: Không gian tình nhân của bạn và "${chat.name}" đã mở thành công!]`,
      timestamp: Date.now(),
    };
    chat.history.push(systemNotice);
  }

  // 创建一条对用户隐藏，但对AI可见的系统指令，告诉AI你的决定
  const hiddenMessage = {
    role: "system",
    content: `[Chỉ thị hệ thống: người dùng đã ${choice === "accepted" ? "đồng ý" : "từ chối"} lời mời mở Không gian tình nhân của bạn.]`,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  // 保存所有更改到数据库
  await db.chats.put(chat);

  // 刷新聊天界面，并触发AI的回应
  renderChatInterface(state.activeChatId);
  triggerAiResponse();
}

/**
 * 初始化情侣空间功能
 * 绑定所有相关事件监听器
 */
function initLoversSpace() {
  document
    .getElementById("ls-change-bg-btn")
    .addEventListener("click", handleChangeLoversSpaceBackground);

  // 绑定主屏幕App图标的点击事件
  document
    .getElementById("lovers-space-app-icon")
    .addEventListener("click", openLoversSpaceEntry);

  document
    .getElementById("ls-char-selector-list")
    .addEventListener("click", async (e) => {
      const item = e.target.closest(".chat-list-item");
      if (item && item.dataset.chatId) {
        const chatId = item.dataset.chatId;
        const chat = state.chats[chatId];

        // 关闭选择弹窗
        document
          .getElementById("ls-char-selector-modal")
          .classList.remove("visible");

        // 判断情侣空间状态
        if (chat.loversSpaceData) {
          // 如果已开通，直接进入
          openLoversSpace(chatId);
        } else {
          // 如果未开通，弹窗确认是否发送邀请
          const confirmed = await showCustomConfirm(
            "Mời mở Không gian tình nhân",
            `Không gian tình nhân của bạn và "${chat.name}" chưa mở, có muốn mời người ấy ngay không?`,
          );
          if (confirmed) {
            // 如果用户确认，发送邀请并跳转到聊天界面
            await sendLoversSpaceInvitation(chatId);
            openChat(chatId);
          }
        }
      }
    });

  document
    .getElementById("ls-cancel-switch-char-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-char-selector-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-switch-char-btn")
    .addEventListener("click", openCharSelectorForLoversSpace);

  // 绑定页签切换事件
  document.getElementById("ls-tab-bar").addEventListener("click", (e) => {
    const tab = e.target.closest(".ls-tab-item");
    if (tab && tab.dataset.view) {
      const viewId = tab.dataset.view;
      // 切换高亮和视图
      document
        .querySelectorAll(".ls-tab-item")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      switchLoversSpaceTab(viewId);

      // 根据点击的页签，渲染对应的内容
      const chat = state.chats[activeLoversSpaceCharId];
      if (!chat) return;

      if (viewId === "ls-moments-view") {
        renderLSMoments(chat.loversSpaceData.moments, chat);
      } else if (viewId === "ls-album-view") {
        renderLSPhotos(chat.loversSpaceData.photos, chat);
      } else if (viewId === "ls-letters-view") {
        renderLSLetters(chat.loversSpaceData.loveLetters, chat);
      } else if (viewId === "ls-questions-view") {
        renderLSQuestions(chat.loversSpaceData.questions, chat);
      } else if (viewId === "ls-diary-view") {
        const now = new Date();
        renderLSDiaryView(now.getFullYear(), now.getMonth() + 1);
      } else if (viewId === "ls-shares-view") {
        renderLSShares(chat.loversSpaceData.shares, chat);
      } else if (viewId === "ls-pomodoro-view") {
        openPomodoroScreen();
      }
    }
  });

  // 绑定"说说"功能的按钮
  document
    .getElementById("ls-add-moment-btn")
    .addEventListener("click", openMomentCreator);
  document
    .getElementById("ls-cancel-moment-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-create-moment-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-confirm-moment-btn")
    .addEventListener("click", handlePostMoment);

  // 绑定"相册"功能的按钮
  document
    .getElementById("ls-add-album-btn")
    .addEventListener("click", openAlbumCreator);
  document
    .getElementById("ls-select-photos-btn")
    .addEventListener("click", () => {
      document.getElementById("ls-photo-input").click();
    });
  document.getElementById("ls-photo-input").addEventListener("change", (e) => {
    handlePhotoSelection(e.target.files);
  });
  // 绑定新弹窗里的模式切换按钮
  const lsImageModeBtn = document.getElementById("ls-switch-to-image-mode");
  const lsTextImageModeBtn = document.getElementById(
    "ls-switch-to-text-image-mode",
  );
  const lsImageModeContent = document.getElementById("ls-image-mode-content");
  const lsTextImageModeContent = document.getElementById(
    "ls-text-image-mode-content",
  );
  lsImageModeBtn.addEventListener("click", () => {
    lsImageModeBtn.classList.add("active");
    lsTextImageModeBtn.classList.remove("active");
    lsImageModeContent.classList.add("active");
    lsTextImageModeContent.classList.remove("active");
    lsImageModeContent.style.display = "block";
    lsTextImageModeContent.style.display = "none";
  });

  lsTextImageModeBtn.addEventListener("click", () => {
    lsTextImageModeBtn.classList.add("active");
    lsImageModeBtn.classList.remove("active");
    lsTextImageModeContent.classList.add("active");
    lsImageModeContent.classList.remove("active");
    lsTextImageModeContent.style.display = "block";
    lsImageModeContent.style.display = "none";
  });

  document
    .getElementById("ls-cancel-album-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-create-album-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-confirm-album-btn")
    .addEventListener("click", handleConfirmAlbum);

  // 情侣空间设置功能事件监听
  document.getElementById("ls-settings-btn").addEventListener("click", () => {
    const chat = state.chats[activeLoversSpaceCharId];
    if (chat && chat.loversSpaceData) {
      // 将已保存的日期加载到输入框中
      document.getElementById("ls-start-date-input").value =
        chat.loversSpaceData.relationshipStartDate || "";
    }
    document.getElementById("ls-settings-modal").classList.add("visible");
  });

  document
    .getElementById("ls-settings-cancel-btn")
    .addEventListener("click", () => {
      document.getElementById("ls-settings-modal").classList.remove("visible");
    });

  document
    .getElementById("ls-settings-save-btn")
    .addEventListener("click", async () => {
      const chat = state.chats[activeLoversSpaceCharId];
      if (!chat) return;

      const newDate = document.getElementById("ls-start-date-input").value;
      chat.loversSpaceData.relationshipStartDate = newDate;

      await db.chats.put(chat); // 保存到数据库

      // 重新渲染整个空间以显示更新
      await renderLoversSpace(chat);

      document.getElementById("ls-settings-modal").classList.remove("visible");
      alert("Đã lưu ngày kỷ niệm!");
    });

  // 情侣空间相册事件监听
  document.getElementById("ls-album-list").addEventListener("click", (e) => {
    // 1. 查找被点击的项目
    const item = e.target.closest(".ls-album-item");
    if (!item) return;

    const timestamp = parseInt(item.dataset.timestamp);
    if (isNaN(timestamp)) return;

    // 2. 检查点击的是否是删除按钮
    if (e.target.classList.contains("ls-photo-delete-btn")) {
      handleDeleteLSPhoto(timestamp);
    } else {
      // 3. 【修改点】点击图片本身，打开新的详情评论弹窗
      openLSPhotoDetail(timestamp);
    }
  });

  // 情侣空间说说互动功能事件监听
  document
    .getElementById("ls-moments-list")
    .addEventListener("click", async (e) => {
      const target = e.target;
      const momentCard = target.closest(".ls-moment-card");
      if (!momentCard) return;

      // 从被点击的卡片上获取正确的索引
      const momentIndex = parseInt(momentCard.dataset.momentIndex);
      const chat = state.chats[activeLoversSpaceCharId];
      // 安全检查，确保能找到对应的数据
      if (
        !chat ||
        !chat.loversSpaceData ||
        !chat.loversSpaceData.moments[momentIndex]
      )
        return;

      const moment = chat.loversSpaceData.moments[momentIndex];

      // 处理"发送评论"按钮
      if (target.classList.contains("ls-comment-send-btn")) {
        const input = momentCard.querySelector(".ls-comment-input-area input");
        const commentText = input.value.trim();
        if (!commentText) {
          alert("Nội dung bình luận không được để trống!");
          return;
        }

        const newComment = {
          author: chat.settings.myNickname || "Tôi",
          text: commentText,
        };

        if (!moment.comments) {
          moment.comments = [];
        }
        moment.comments.push(newComment);

        await db.chats.put(chat); // 保存到数据库
        renderLSMoments(chat.loversSpaceData.moments, chat); // 刷新界面
      }

      // 处理"删除说说"按钮
      if (target.classList.contains("ls-moment-delete-btn")) {
        const confirmed = await showCustomConfirm(
          "Xóa trạng thái",
          "Bạn có chắc muốn xóa trạng thái này?",
          {
            confirmButtonClass: "btn-danger",
          },
        );
        if (confirmed) {
          chat.loversSpaceData.moments.splice(momentIndex, 1);
          await db.chats.put(chat);
          renderLSMoments(chat.loversSpaceData.moments, chat);
        }
      }

      // 处理"删除评论"按钮
      if (target.classList.contains("ls-comment-delete-btn")) {
        const commentIndex = parseInt(target.dataset.commentIndex);
        const confirmed = await showCustomConfirm(
          "Xóa bình luận",
          "Bạn có chắc muốn xóa bình luận này?",
          {
            confirmButtonClass: "btn-danger",
          },
        );
        if (confirmed) {
          moment.comments.splice(commentIndex, 1);
          await db.chats.put(chat);
          renderLSMoments(chat.loversSpaceData.moments, chat);
        }
      }
    });

  // 情侣空间情书功能事件监听

  // 绑定"写情书"的浮动按钮
  document
    .getElementById("ls-add-letter-btn")
    .addEventListener("click", () => openLoveLetterEditor());

  // 绑定写信弹窗的"取消"和"寄出"按钮
  document
    .getElementById("ls-cancel-letter-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-create-letter-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-confirm-letter-btn")
    .addEventListener("click", handlePostLoveLetter);

  // 使用事件委托，为情书列表中的所有卡片和按钮绑定点击事件
  document
    .getElementById("ls-letters-list")
    .addEventListener("click", async (e) => {
      const letterItem = e.target.closest(".ls-love-letter-item");
      if (!letterItem) return;

      // 检查点击的是否是删除按钮
      if (e.target.classList.contains("ls-letter-delete-btn")) {
        const letterId = letterItem.dataset.letterId;
        const chat = state.chats[activeLoversSpaceCharId];
        const letter = chat.loversSpaceData.loveLetters.find(
          (l) => l.id === letterId,
        );

        const confirmed = await showCustomConfirm(
          "Xóa thư tình",
          `Bạn có chắc muốn xóa lá thư tình gửi "${letter.recipientName}" này?`,
          {
            confirmButtonClass: "btn-danger",
          },
        );

        if (confirmed) {
          chat.loversSpaceData.loveLetters =
            chat.loversSpaceData.loveLetters.filter((l) => l.id !== letterId);
          await db.chats.put(chat);
          renderLSLetters(chat.loversSpaceData.loveLetters, chat);
          alert("Đã xóa thư tình.");
        }
      }
      // 否则，就是点击了卡片本身，执行查看详情的逻辑
      else if (letterItem.dataset.letterId) {
        showLoveLetterDetail(letterItem.dataset.letterId);
      }
    });

  // 情书查看器按钮事件监听
  document
    .getElementById("ls-close-letter-viewer-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-letter-viewer-modal")
        .classList.remove("visible");
      activeLoveLetter = null; // 关闭时清理暂存的数据
    });

  document
    .getElementById("ls-reply-letter-btn")
    .addEventListener("click", () => {
      // 先关闭查看器
      document
        .getElementById("ls-letter-viewer-modal")
        .classList.remove("visible");
      // 然后打开回复编辑器
      if (activeLoveLetter) {
        openLoveLetterEditor(activeLoveLetter);
      }
      activeLoveLetter = null; // 清理
    });

  // 情侣空间-情侣提问功能事件监听

  // 绑定"提问"的浮动按钮
  document
    .getElementById("ls-add-question-btn")
    .addEventListener("click", openQuestionAsker);

  // 绑定提问弹窗的按钮
  document.getElementById("ls-cancel-ask-btn").addEventListener("click", () => {
    document
      .getElementById("ls-ask-question-modal")
      .classList.remove("visible");
  });
  document
    .getElementById("ls-confirm-ask-btn")
    .addEventListener("click", handlePostQuestion);

  // 绑定回答弹窗的按钮
  document
    .getElementById("ls-cancel-answer-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-answer-question-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-confirm-answer-btn")
    .addEventListener("click", handlePostAnswer);

  // 使用事件委托，为所有"回答"和"删除"按钮绑定点击事件
  document
    .getElementById("ls-questions-list")
    .addEventListener("click", (e) => {
      // 处理"回答"按钮的逻辑
      if (e.target.classList.contains("ls-answer-btn")) {
        const questionId = e.target.dataset.questionId;
        if (questionId) {
          openAnswerEditor(questionId);
        }
      }

      // 处理"删除"按钮的逻辑
      if (e.target.classList.contains("ls-question-delete-btn")) {
        const questionId = e.target.dataset.questionId;
        if (questionId) {
          handleDeleteLSQuestion(questionId);
        }
      }
    });

  // 情侣空间专属播放器事件监听器

  // 监听主播放器内的所有按钮
  document
    .getElementById("ls-close-player-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-music-player-overlay")
        .classList.remove("visible");
    });
  document.getElementById("ls-playlist-btn").addEventListener("click", () => {
    renderLSMusicPlaylist();
    document.getElementById("ls-music-playlist-panel").classList.add("visible");
  });
  document
    .getElementById("ls-play-pause-btn")
    .addEventListener("click", toggleLSMusicPlayPause);
  document
    .getElementById("ls-next-btn")
    .addEventListener("click", playNextLSSong);
  document
    .getElementById("ls-prev-btn")
    .addEventListener("click", playPrevLSSong);

  // 监听播放列表面板内的所有按钮
  document
    .getElementById("ls-close-playlist-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-music-playlist-panel")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-clear-playlist-btn")
    .addEventListener("click", async () => {
      const confirmed = await showCustomConfirm(
        "Xóa sạch danh sách",
        "Bạn có chắc muốn xóa sạch danh sách phát của Không gian tình nhân?",
        {
          confirmButtonClass: "btn-danger",
        },
      );
      if (confirmed) {
        clearLSMusicPlaylist();
      }
    });
  document.getElementById("ls-playlist-body").addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-track-btn")) {
      const index = parseInt(e.target.dataset.index);
      lsMusicState.playlist.splice(index, 1);

      // 如果删除的是正在播放的歌曲
      if (index === lsMusicState.currentIndex) {
        playNextLSSong();
      } else if (index < lsMusicState.currentIndex) {
        lsMusicState.currentIndex--; // 修正索引
      }
      renderLSMusicPlaylist();
    }
  });

  // 监听音频播放器的状态
  const lsAudioPlayer = document.getElementById("ls-audio-player");
  lsAudioPlayer.addEventListener("timeupdate", updateLSProgressBar);
  lsAudioPlayer.addEventListener("ended", playNextLSSong);
  lsAudioPlayer.addEventListener("play", () => {
    lsMusicState.isPlaying = true;
    renderLSMusicPlayerUI();
  });
  lsAudioPlayer.addEventListener("pause", () => {
    lsMusicState.isPlaying = false;
    renderLSMusicPlayerUI();
  });

  // 监听进度条的点击
  document.getElementById("ls-progress-bar").addEventListener("click", (e) => {
    if (!lsAudioPlayer.duration) return;
    const progressBar = e.currentTarget;
    const barWidth = progressBar.clientWidth;
    const clickX = e.offsetX;
    lsAudioPlayer.currentTime = (clickX / barWidth) * lsAudioPlayer.duration;
  });

  // 拦截情侣空间分享列表的点击事件
  document
    .getElementById("ls-shares-list")
    .addEventListener("click", async (e) => {
      const item = e.target.closest(".ls-share-item");
      if (!item || !item.dataset.shareData) return;

      const shareData = JSON.parse(item.dataset.shareData);

      // 如果是歌曲，保持原样，打开播放器
      if (shareData.shareType === "song") {
        openLoversSpaceMusicPlayer(shareData);
      }
      // 如果是电影、书籍、游戏，使用新的高级弹窗！
      else if (["movie", "book", "game"].includes(shareData.shareType)) {
        openAdvancedShareDetail(shareData); // <--- 这里调用新函数
      }
    });

  // 绑定新弹窗的关闭按钮
  const shareCloseBtn = document.getElementById("ls-share-detail-close-btn");
  if (shareCloseBtn) {
    shareCloseBtn.addEventListener("click", () => {
      document
        .getElementById("ls-share-detail-modal")
        .classList.remove("visible");
    });
  }

  // 点击新弹窗的遮罩层也能关闭
  document
    .getElementById("ls-share-detail-modal")
    .addEventListener("click", (e) => {
      if (e.target.id === "ls-share-detail-modal") {
        e.target.classList.remove("visible");
      }
    });

  // 情侣空间播放器封面/歌词切换事件
  document.getElementById("ls-display-area").addEventListener("click", () => {
    document.getElementById("ls-display-area").classList.toggle("show-lyrics");
  });

  // 情侣番茄钟事件监听器

  // 绑定"开启新的专注时光"按钮
  document
    .getElementById("ls-pomodoro-start-btn-container")
    .addEventListener("click", openPomodoroSetup);

  // 绑定设置弹窗的按钮
  document
    .getElementById("pomodoro-cancel-setup-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-pomodoro-setup-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("pomodoro-confirm-setup-btn")
    .addEventListener("click", startPomodoroSession);

  // 为我们新增的"本地上传"按钮绑定事件
  document
    .getElementById("pomodoro-bg-local-upload-btn")
    .addEventListener("click", () => {
      document.getElementById("pomodoro-bg-file-input").click();
    });
  document
    .getElementById("pomodoro-bg-file-input")
    .addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          pomodoroState.tempBgDataUrl = event.target.result; // 将本地图片转为DataURL暂存起来
          document.getElementById("pomodoro-bg-url-input").value =
            `[Ảnh từ máy: ${file.name}]`; // 在输入框里给个提示
        };
        reader.readAsDataURL(file);
      }
    });

  // 绑定计时器界面上的元素
  document
    .getElementById("pomodoro-char-avatar")
    .addEventListener("click", () => {
      triggerPomodoroAIResponse("user_click");
    });
  document.getElementById("pomodoro-end-btn").addEventListener("click", () => {
    endPomodoroSession(false); // false表示是用户手动中断
  });

  // 绑定历史详情弹窗的关闭按钮
  document
    .getElementById("pomodoro-close-history-viewer-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-pomodoro-history-viewer-modal")
        .classList.remove("visible");
    });

  // 为番茄钟计时模式新增的交互代码
  document
    .querySelector("#ls-pomodoro-setup-modal")
    .addEventListener("change", (e) => {
      if (e.target.name === "pomodoro-mode") {
        const durationGroup = document.getElementById(
          "pomodoro-duration-input",
        ).parentElement;
        if (e.target.value === "countup") {
          // 如果选择正计时，就隐藏时长输入框
          durationGroup.style.display = "none";
        } else {
          // 否则（选择倒计时），就显示它
          durationGroup.style.display = "block";
        }
      }
    });

  // 处理情侣空间邀请卡片的点击事件
  document
    .getElementById("chat-messages")
    .addEventListener("click", async (e) => {
      const card = e.target.closest(".waimai-card");
      if (!card) return;
      const messageBubble = card.closest(".message-bubble");
      const invitationMsg = state.chats[state.activeChatId].history.find(
        (m) => m.timestamp === parseInt(messageBubble.dataset.timestamp),
      );

      if (
        invitationMsg &&
        invitationMsg.type === "lovers_space_invitation" &&
        invitationMsg.status === "pending"
      ) {
        const choice = e.target.dataset.choice; // 'accepted' or 'rejected'
        if (choice) {
          // 更新邀请卡片的状态
          invitationMsg.status = choice;
          const chat = state.chats[state.activeChatId];

          // 判断用户的选择
          if (choice === "accepted") {
            // 如果同意，创建情侣空间数据
            chat.loversSpaceData = {
              background: "https://i.postimg.cc/k495F4W5/profile-banner.jpg",
              relationshipStartDate: null,
              moments: [],
              albums: [],
              photos: [],
              loveLetters: [],
              shares: [],
              questions: [],
            };

            // 创建对用户可见的系统通知
            const visibleNotice = {
              role: "system",
              type: "pat_message",
              content: `[Hệ thống: Không gian tình nhân của bạn và "${chat.name}" đã mở thành công!]`,
              timestamp: Date.now(),
            };
            chat.history.push(visibleNotice);

            // 创建给AI看的隐藏指令
            const hiddenMessage = {
              role: "system",
              content: `[Chỉ thị hệ thống: người dùng đã đồng ý lời mời mở Không gian tình nhân của bạn.]`,
              timestamp: Date.now() + 1,
              isHidden: true,
            };
            chat.history.push(hiddenMessage);

            await db.chats.put(chat);
            renderChatInterface(state.activeChatId);
          } else {
            // 如果拒绝 (choice === 'rejected')

            // 创建一条对用户可见的系统通知
            const visibleNotice = {
              role: "system",
              type: "pat_message", // 复用灰色居中气泡样式
              content: `[Hệ thống: bạn đã từ chối lời mời Không gian tình nhân của "${chat.name}".]`,
              timestamp: Date.now(),
            };
            chat.history.push(visibleNotice);

            // 创建一条给AI看的隐藏指令，告诉它被拒绝了
            const hiddenMessage = {
              role: "system",
              content: `[Chỉ thị hệ thống: người dùng đã từ chối lời mời mở Không gian tình nhân của bạn.]`,
              timestamp: Date.now() + 1,
              isHidden: true,
            };
            chat.history.push(hiddenMessage);

            // 保存所有更改到数据库
            await db.chats.put(chat);

            // 刷新聊天界面，让卡片状态和新的系统通知都显示出来
            renderChatInterface(state.activeChatId);
          }
        }
      }
    });

  // 处理情侣空间邀请卡片的点击事件
  document
    .getElementById("chat-messages")
    .addEventListener("click", async (e) => {
      // 寻找被点击的元素是否在邀请卡片内
      const card = e.target.closest(".waimai-card");
      if (!card) return;
      const messageBubble = card.closest(".message-bubble");
      // 通过时间戳找到对应的消息数据
      const invitationMsg = state.chats[state.activeChatId].history.find(
        (m) => m.timestamp === parseInt(messageBubble.dataset.timestamp),
      );

      // 确保这是一条待处理的情侣空间邀请
      if (
        invitationMsg &&
        invitationMsg.type === "lovers_space_invitation" &&
        invitationMsg.status === "pending"
      ) {
        const choice = e.target.dataset.choice; // 获取点击的是 'accepted' 还是 'rejected'
        if (choice) {
          // 调用我们刚刚创建的处理器函数
          handleLoversSpaceResponse(invitationMsg.timestamp, choice);
        }
      }
    });

  // 情侣空间-情绪日记事件监听
  document
    .getElementById("lovers-space-screen")
    .addEventListener("click", (e) => {
      const chat = state.chats[activeLoversSpaceCharId];
      if (!chat) return;

      // 日历月份切换
      if (
        e.target.id === "ls-prev-month-btn" ||
        e.target.id === "ls-next-month-btn"
      ) {
        const currentDisplay = document.getElementById(
          "ls-current-month-display",
        ).textContent;
        const [year, month] = currentDisplay.match(/\d+/g).map(Number);
        let newDate = new Date(year, month - 1, 1);

        if (e.target.id === "ls-prev-month-btn") {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setMonth(newDate.getMonth() + 1);
        }
        renderLSDiaryView(newDate.getFullYear(), newDate.getMonth() + 1);
        return;
      }

      // 点击日历格子
      const dayCell = e.target.closest(".ls-calendar-day:not(.empty)");
      if (dayCell) {
        openDiaryModal(dayCell.dataset.date);
      }
    });

  // 日记编辑弹窗事件
  document
    .getElementById("ls-emoji-selector")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("emoji-option")) {
        document
          .querySelectorAll("#ls-emoji-selector .emoji-option")
          .forEach((el) => el.classList.remove("selected"));
        e.target.classList.add("selected");
      }
    });
  document
    .getElementById("ls-cancel-diary-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-diary-editor-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("ls-save-diary-btn")
    .addEventListener("click", handleSaveUserDiary);

  // 日记查看弹窗关闭按钮
  document
    .getElementById("ls-close-diary-viewer-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-diary-viewer-modal")
        .classList.remove("visible");
    });
  // --- 绑定新增加的番茄钟事件 ---

  // 1. 暂停按钮
  const pauseBtn = document.getElementById("pomodoro-pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", togglePomodoroPause);
  }

  // 2. 休息聊天弹窗关闭按钮
  document
    .getElementById("close-pomodoro-break-btn")
    .addEventListener("click", closePomodoroBreakChat);

  // 3. 休息聊天发送按钮
  document
    .getElementById("pomodoro-break-send-btn")
    .addEventListener("click", sendPomodoroBreakMessage);

  // 4. 休息聊天输入框回车发送
  document
    .getElementById("pomodoro-break-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPomodoroBreakMessage();
      }
    });

  // 5. 修改结束按钮逻辑：如果暂停中结束，要确保清理状态
  const originalEndBtn = document.getElementById("pomodoro-end-btn");
  // 最好不要 removeEventListener，因为匿名函数很难移除。
  // 我们在 endPomodoroSession 函数内部确保清理 isPaused 即可 (已在上方代码修改中隐式包含，因为 endPomodoroSession 会重置 state)
  // --- 番茄钟 BGM 设置事件 ---
  const bgmSourceSelect = document.getElementById("pomodoro-bgm-source-select");
  const customPlaylistPanel = document.getElementById(
    "pomodoro-custom-playlist-panel",
  );

  if (bgmSourceSelect) {
    bgmSourceSelect.addEventListener("change", (e) => {
      // 只有选择自定义时才显示面板
      customPlaylistPanel.style.display =
        e.target.value === "custom" ? "block" : "none";
    });
  }

  // 绑定添加本地音乐按钮
  const addBgmLocalBtn = document.getElementById("pomo-add-bgm-local");
  const bgmFileInput = document.getElementById("pomo-bgm-file-input");
  if (addBgmLocalBtn) {
    addBgmLocalBtn.addEventListener("click", () => bgmFileInput.click());
  }
  if (bgmFileInput) {
    bgmFileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        // 存入自定义列表
        pomodoroCustomPlaylist.push({
          name: file.name,
          src: file, // 这是一个 File 对象
          isLocal: true,
        });
      });
      renderPomodoroCustomListUI();
      e.target.value = null;
    });
  }

  // 绑定添加URL按钮
  const addBgmUrlBtn = document.getElementById("pomo-add-bgm-url");
  if (addBgmUrlBtn) {
    addBgmUrlBtn.addEventListener("click", async () => {
      const url = await showCustomPrompt(
        "Thêm nhạc",
        "Nhập link nhạc trên mạng (URL):",
      );
      if (url && url.trim()) {
        const name = await showCustomPrompt("Tên nhạc", "Đặt tên cho bài hát này:");
        pomodoroCustomPlaylist.push({
          name: name || "Bài hát không xác định",
          src: url.trim(),
          isLocal: false,
        });
        renderPomodoroCustomListUI();
      }
    });
  }

  // 绑定清空按钮
  const clearBgmBtn = document.getElementById("pomo-clear-bgm");
  if (clearBgmBtn) {
    clearBgmBtn.addEventListener("click", () => {
      pomodoroCustomPlaylist = [];
      renderPomodoroCustomListUI();
    });
  }
  // --- 番茄钟 BGM 运行时控制事件 ---

  // 1. 计时界面的音乐按钮
  const musicMenuBtn = document.getElementById("pomodoro-music-btn");
  if (musicMenuBtn) {
    musicMenuBtn.addEventListener("click", openPomodoroMusicModal);
  }

  // 2. 音乐面板内的控制按钮
  document
    .getElementById("close-pomo-music-modal")
    .addEventListener("click", () => {
      document
        .getElementById("pomodoro-music-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("pomo-music-prev")
    .addEventListener("click", playPrevPomoMusic);
  document
    .getElementById("pomo-music-next")
    .addEventListener("click", playNextPomoMusic);
  document
    .getElementById("pomo-music-play")
    .addEventListener("click", togglePomoMusic);
  // --- 绑定照片详情弹窗事件 ---
  document
    .getElementById("ls-photo-detail-close-btn")
    .addEventListener("click", () => {
      document
        .getElementById("ls-photo-detail-modal")
        .classList.remove("visible");
    });

  document
    .getElementById("ls-photo-comment-send-btn")
    .addEventListener("click", handleSendLSPhotoComment);
}
