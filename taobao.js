let currentEditingProductId = null; // 用于追踪正在编辑的商品ID
let currentEditingFoodId = null;
let logisticsUpdateTimers = [];
let isSelectionMode = false;
let notificationTimeout;
let imageGenerationQueue = []; // 全局的图片生成任务队列
let isProcessingImage = false; // 一个开关，防止队列被重复处理
// 物流时间线模板 (delay单位是毫秒)
// 你可以随意修改这里的文本和延迟时间，打造你自己的物流故事！
const logisticsTimelineTemplate = [
  { text: "Đơn hàng của bạn đã được gửi", delay: 1000 * 2 }, // 2秒
  { text: "Thanh toán thành công, chờ người bán đóng gói", delay: 1000 * 10 }, // 10秒后
  { text: "【Kho {city}】 đã đóng gói, chờ đơn vị vận chuyển lấy hàng", delay: 1000 * 60 * 5 }, // 5分钟后
  { text: "【Chuyển phát {city}】 đã lấy hàng", delay: 1000 * 60 * 20 }, // 20分钟后
  { text: "Kiện hàng đã đến 【Trung tâm phân loại {city}】", delay: 1000 * 60 * 60 * 2 }, // 2小时后
  {
    text: "【Trung tâm phân loại {city}】 đã xuất hàng, trạm tiếp theo 【{next_city}】",
    delay: 1000 * 60 * 60 * 8,
  }, // 8小时后
  { text: "Kiện hàng đã đến 【Trung tâm trung chuyển {user_city}】", delay: 1000 * 60 * 60 * 20 }, // 20小时后
  {
    text: "Kiện hàng đang được giao, người giao: Thỏ Thỏ Shipper, điện thoại: 123-4567-8910, vui lòng giữ máy",
    delay: 1000 * 60 * 60 * 24,
  }, // 24小时后
  {
    text: "Kiện hàng của bạn đã được ký nhận, cảm ơn bạn đã mua sắm tại Đào Bảo, mong được phục vụ bạn lần sau!",
    delay: 1000 * 60 * 60 * 28,
  }, // 28小时后
];
/* --- 娃娃机逻辑开始 --- */

// 1. 默认娃娃图片列表 (在这里替换你想给用户的默认图片URL)
const DEFAULT_DOLL_IMAGES = [
  "https://i.postimg.cc/3rCsgRTN/tkwwj2.png",
  "https://i.postimg.cc/yxB2MqFB/tkwwj.png",
  "https://i.postimg.cc/3xnr91QF/tkwwj12.png",
  "https://i.postimg.cc/8ztkw4gH/tkwwj11.png",
  "https://i.postimg.cc/dV4Qn6c9/tkwwj10.png",
  "https://i.postimg.cc/9MvHk9DZ/wwj6.png",
];

// 2. 奖励等级配置
const REWARD_TIERS = [
  { type: "coin_small", value: 10, label: "Tiền lẻ", prob: 40, color: "#edd1d1" },
  { type: "coin_mid", value: 50, label: "Lì xì", prob: 30, color: "#d4a5a5" },
  { type: "coin_big", value: 100, label: "Khoản tiền khủng", prob: 15, color: "#b58e8e" },
  { type: "bad_luck", value: -20, label: "Trừ tiền", prob: 10, color: "#9e9e9e" },
  { type: "mystery", value: 0, label: "Bí ẩn", prob: 5, color: "#c9c0bb" },
];

let clawState = {
  x: 50,
  y: 0,
  isGrabbing: false,
  joystickInterval: null,
};

async function initClawMachineData() {
  const count = await db.clawMachineDolls.count();
  if (count === 0) {
    console.log("初始化默认娃娃图片...");
    const dollObjects = DEFAULT_DOLL_IMAGES.map((url) => ({ url: url }));
    await db.clawMachineDolls.bulkAdd(dollObjects);
  }
}

async function openClawMachine() {
  await initClawMachineData();
  const modal = document.getElementById("claw-machine-modal");
  modal.classList.add("visible");
  updateClawBalanceDisplay();
  await resetClawMachine(); // 重置并生成新娃娃
  initJoystick();
}

function updateClawBalanceDisplay() {
  document.getElementById("claw-machine-balance").textContent = (
    state.globalSettings.userBalance || 0
  ).toFixed(2);
}

// ★★★ 核心修改：渲染实时统计饼图 ★★★
// 这个函数现在不读配置表，而是读取 #doll-pool 里的实际元素
function renderRealTimeStats() {
  const pieChart = document.getElementById("prob-pie-chart");
  const legendEl = document.getElementById("prob-legend");
  legendEl.innerHTML = "";

  const dolls = document.querySelectorAll("#doll-pool .game-doll");
  const totalCount = dolls.length;

  if (totalCount === 0) {
    pieChart.style.background = "#eee";
    legendEl.innerHTML = "Không có thú bông";
    return;
  }

  // 1. 统计当前池子里每种类型的数量
  const counts = {};
  dolls.forEach((d) => {
    const type = d.dataset.type;
    counts[type] = (counts[type] || 0) + 1;
  });

  // 2. 生成饼图 CSS 和 图例
  let gradientStr = "";
  let currentDeg = 0;

  // 遍历配置表是为了保证颜色和顺序一致，但数据用的是上面统计的 counts
  let hasData = false;

  REWARD_TIERS.forEach((tier, index) => {
    const count = counts[tier.type] || 0;
    if (count > 0) {
      hasData = true;
      const percent = count / totalCount;
      const degrees = percent * 360;
      const endDeg = currentDeg + degrees;

      // 拼接 CSS
      gradientStr += `${tier.color} ${currentDeg}deg ${endDeg}deg`;
      // 如果不是最后一段，加逗号
      // 这里有个小逻辑问题：forEach里面很难判断是不是最后一个有数据的tier
      // 所以我们加个简单的逗号处理逻辑：在每次添加前检查是否需要加逗号

      currentDeg = endDeg;

      // 生成图例
      const legendItem = document.createElement("div");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `
                <div class="legend-dot" style="background: ${tier.color}"></div>
<span>${tier.label} ${count} con</span>
            `;
      legendEl.appendChild(legendItem);
    }
  });

  // 修复 CSS 逗号问题：简单的做法是直接用逗号拼接，最后如果有逗号不影响（CSS宽容度），
  // 或者更严谨地处理。这里我们重组一下 gradientStr
  // 上面的循环直接拼会有问题，我们改用 map + join

  let gradients = [];
  currentDeg = 0;
  REWARD_TIERS.forEach((tier) => {
    const count = counts[tier.type] || 0;
    if (count > 0) {
      const percent = count / totalCount;
      const degrees = percent * 360;
      const endDeg = currentDeg + degrees;
      gradients.push(`${tier.color} ${currentDeg}deg ${endDeg}deg`);
      currentDeg = endDeg;
    }
  });

  if (gradients.length > 0) {
    pieChart.style.background = `conic-gradient(${gradients.join(", ")})`;
  } else {
    pieChart.style.background = "#eee";
  }
}

function getRandomRewardTier() {
  const totalWeight = REWARD_TIERS.reduce((sum, item) => sum + item.prob, 0);
  let randomNum = Math.random() * totalWeight;
  for (let tier of REWARD_TIERS) {
    if (randomNum < tier.prob) return tier;
    randomNum -= tier.prob;
  }
  return REWARD_TIERS[0];
}

// 重置/刷新娃娃机
async function resetClawMachine() {
  // 增加刷新动画反馈
  const pool = document.getElementById("doll-pool");
  pool.style.opacity = "0";

  clawState.x = 50;
  clawState.y = 0;
  clawState.isGrabbing = false;
  updateClawPosition();

  await new Promise((r) => setTimeout(r, 200)); // 稍作停顿
  pool.innerHTML = "";

  const availableImages = await db.clawMachineDolls.toArray();
  if (availableImages.length === 0) {
    pool.innerHTML =
      '<div style="text-align:center; padding-top:100px; color:#fff;">Không có kho ảnh...<br>Hãy bấm ⚙️ để thêm</div>';
    pool.style.opacity = "1";
    return;
  }

  const count = Math.floor(Math.random() * 6) + 10; // 10-15个

  for (let i = 0; i < count; i++) {
    const tierConfig = getRandomRewardTier();
    const imageObj =
      availableImages[Math.floor(Math.random() * availableImages.length)];

    const doll = document.createElement("div");
    doll.className = "game-doll";
    doll.dataset.type = tierConfig.type;
    doll.dataset.value = tierConfig.value;
    doll.dataset.label = tierConfig.label;

    doll.style.backgroundImage = `url(${imageObj.url})`;
    doll.style.left = Math.random() * 80 + "%";
    doll.style.bottom = Math.random() * 40 + "px";
    doll.style.transform = `rotate(${Math.random() * 60 - 30}deg)`;

    pool.appendChild(doll);
  }

  pool.style.opacity = "1";
  document.getElementById("claw-grab-btn").disabled = false;

  // ★★★ 关键：生成完娃娃后，立即计算并渲染饼图 ★★★
  renderRealTimeStats();
}

function updateClawPosition() {
  const claw = document.getElementById("machine-claw");
  clawState.x = Math.max(5, Math.min(95, clawState.x));
  claw.style.left = `${clawState.x}%`;
}

function initJoystick() {
  const joystick = document.getElementById("machine-joystick");
  const newJoystick = joystick.cloneNode(true);
  joystick.parentNode.replaceChild(newJoystick, joystick);

  const activeJoystick = document.getElementById("machine-joystick");
  let isDragging = false;
  let startX = 0;

  const startMove = (e) => {
    if (clawState.isGrabbing) return;
    isDragging = true;
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    activeJoystick.style.transition = "none";
  };

  const move = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.type.includes("mouse")
      ? e.clientX
      : e.touches[0].clientX;
    const deltaX = currentX - startX;
    const maxDist = 20;
    const moveX = Math.max(-maxDist, Math.min(maxDist, deltaX));
    activeJoystick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;
    if (Math.abs(moveX) > 5) {
      clawState.x += moveX * 0.05;
      updateClawPosition();
    }
  };

  const endMove = () => {
    isDragging = false;
    activeJoystick.style.transition = "transform 0.2s";
    activeJoystick.style.transform = `translate(-50%, -50%)`;
  };

  activeJoystick.addEventListener("mousedown", startMove);
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", endMove);
  activeJoystick.addEventListener("touchstart", startMove);
  document.addEventListener("touchmove", move);
  document.addEventListener("touchend", endMove);
}

// 刷新按钮功能
async function handleRestartClaw() {
  // 可以设置是否扣费刷新，这里暂定为免费
  // 如果要扣费：
  /*
    if (state.globalSettings.userBalance < 5) { alert('余额不足5元，无法刷新'); return; }
    await updateUserBalanceAndLogTransaction(-5, "刷新娃娃机");
    updateClawBalanceDisplay();
    */

  const btn = document.getElementById("claw-restart-btn");
  btn.classList.add("rotating"); // 加一个旋转动画class效果更好
  await resetClawMachine();
  setTimeout(() => btn.classList.remove("rotating"), 500);
}

async function handleGrab() {
  if (clawState.isGrabbing) return;
  clawState.isGrabbing = true;

  // 每次抓取扣除 2 元 (在此处实现投币逻辑)
  // if ((state.globalSettings.userBalance || 0) < 2) {
  //     alert("余额不足 2 元，无法启动！");
  //     clawState.isGrabbing = false;
  //     return;
  // }
  // await updateUserBalanceAndLogTransaction(-2, "娃娃机投币");
  // updateClawBalanceDisplay();

  const btn = document.getElementById("claw-grab-btn");
  const claw = document.getElementById("machine-claw");
  btn.disabled = true;

  // 1. 下落
  claw.style.transition = "top 1s ease-in";
  claw.style.top = "70%";

  await new Promise((r) => setTimeout(r, 1000));

  // 2. 抓取
  claw.classList.add("grabbing");

  // 3. 碰撞检测
  const clawRect = claw.getBoundingClientRect();
  const dolls = document.querySelectorAll("#doll-pool .game-doll"); // 确保只选池子里的
  let caughtDoll = null;
  let minDistance = Infinity;

  dolls.forEach((doll) => {
    const dollRect = doll.getBoundingClientRect();
    const dist = Math.abs(
      clawRect.left + clawRect.width / 2 - (dollRect.left + dollRect.width / 2),
    );
    if (dist < 30) {
      if (dist < minDistance) {
        minDistance = dist;
        caughtDoll = doll;
      }
    }
  });

  // 4. 上升
  if (caughtDoll) {
    caughtDoll.classList.add("caught");
    caughtDoll.style.left = "50%";
    caughtDoll.style.top = "10px";
    caughtDoll.style.bottom = "auto";
    caughtDoll.style.transform = "translate(-50%, 0)";
    claw.appendChild(caughtDoll);
  }

  await new Promise((r) => setTimeout(r, 500));
  claw.style.transition = "top 1s ease-out";
  claw.style.top = "0";

  await new Promise((r) => setTimeout(r, 1000));

  // 5. 移到出口
  claw.style.transition = "left 1s linear";
  claw.style.left = "15%";

  await new Promise((r) => setTimeout(r, 1000));

  // 6. 松开
  claw.classList.remove("grabbing");

  if (caughtDoll) {
    caughtDoll.style.transition = "top 0.5s ease-in";
    caughtDoll.style.top = "200px"; // 掉落动画

    await new Promise((r) => setTimeout(r, 500));

    const type = caughtDoll.dataset.type;
    let value = parseFloat(caughtDoll.dataset.value);
    const label = caughtDoll.dataset.label;
    let message = "";

    if (type === "mystery") {
      const input = await showCustomPrompt(
        "Gắp được thú bông bí ẩn!",
        "Nhập số tiền bạn muốn nhận:",
        "",
        "number",
      );
      if (input !== null) {
        value = parseFloat(input);
        if (isNaN(value)) value = 0;
        message = `Sức mạnh bí ẩn có hiệu lực! Số dư tăng thêm ¥${value.toFixed(2)}`;
      } else {
        value = 0;
        message = "Bạn đã từ bỏ phần thưởng bí ẩn.";
      }
    } else if (value < 0) {
      message = `Ối! Gắp phải thú bông tinh nghịch! Trừ ¥${Math.abs(value)}`;
    } else {
      message = `Chúc mừng! Gắp được thú bông ${label}, nhận ¥${value}!`;
    }

    if (value !== 0) {
      if (window.updateUserBalanceAndLogTransaction) {
        await window.updateUserBalanceAndLogTransaction(value, "Phần thưởng máy gắp thú");
      }
      updateClawBalanceDisplay();
      if (typeof renderBalanceDetails === "function")
        await renderBalanceDetails();
    }

    alert(message);
    caughtDoll.remove();

    // ★★★ 抓走娃娃后，池子里的娃娃变少了，重新计算概率饼图 ★★★
    renderRealTimeStats();
  } else {
    await showCustomPrompt(
      "Tiếc quá!",
      "Chỉ thiếu chút xíu nữa thôi! Thử lại lần nữa?",
      "Cố lên",
      "text",
    );
  }

  // 7. 复位
  claw.style.transition = "left 0.5s ease";
  claw.style.left = "50%";
  clawState.x = 50;

  await new Promise((r) => setTimeout(r, 500));
  clawState.isGrabbing = false;
  btn.disabled = false;
}

// 娃娃管理逻辑 (保持不变)
async function openDollManager() {
  await renderDollManagerGrid();
  document.getElementById("doll-manager-modal").classList.add("visible");
}

async function renderDollManagerGrid() {
  const grid = document.getElementById("doll-manager-grid");
  grid.innerHTML = "";
  const dolls = await db.clawMachineDolls.toArray();

  dolls.forEach((doll) => {
    const item = document.createElement("div");
    item.style.cssText = `
            position: relative; width: 80px; height: 80px;
            background-image: url(${doll.url}); background-size: cover; background-position: center;
            border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
    const delBtn = document.createElement("div");
    delBtn.innerHTML = "×";
    delBtn.style.cssText = `
            position: absolute; top: -5px; right: -5px; width: 20px; height: 20px;
            background: #ff4d4f; color: white; border-radius: 50%; text-align: center; line-height: 18px;
            cursor: pointer; font-weight: bold;
        `;
    delBtn.onclick = async () => {
      if (confirm("Bạn có chắc muốn xóa thú bông này?")) {
        await db.clawMachineDolls.delete(doll.id);
        renderDollManagerGrid();
      }
    };
    item.appendChild(delBtn);
    grid.appendChild(item);
  });
}

async function handleAddDoll() {
  const choice = await showChoiceModal("Thêm thú bông", [
    { text: "📁 Tải lên từ máy (chọn được nhiều)", value: "local" },
    { text: "🌐 URL trên mạng", value: "url" },
  ]);
  if (choice === "local") {
    document.getElementById("doll-upload-input").click();
  } else if (choice === "url") {
    const url = await showCustomPrompt("Nhập URL", "Nhập link ảnh");
    if (url && url.trim()) {
      await db.clawMachineDolls.add({ url: url.trim() });
      renderDollManagerGrid();
    }
  }
}

async function handleDollFileChange(e) {
  const files = e.target.files;
  if (!files.length) return;
  for (const file of files) {
    const base64 = await handleImageUploadAndCompress(file);
    await db.clawMachineDolls.add({ url: base64 });
  }
  renderDollManagerGrid();
  e.target.value = null;
}

async function resetDefaultDolls() {
  if (confirm("Bạn có chắc muốn xóa hết thú bông và khôi phục mặc định?")) {
    await db.clawMachineDolls.clear();
    const dollObjects = DEFAULT_DOLL_IMAGES.map((url) => ({ url: url }));
    await db.clawMachineDolls.bulkAdd(dollObjects);
    renderDollManagerGrid();
    alert("Đã khôi phục thú bông mặc định!");
  }
}

/* --- 娃娃机逻辑结束 --- */

const addProductChoiceModal = document.getElementById(
  "add-product-choice-modal",
);
const aiGeneratedProductsModal = document.getElementById(
  "ai-generated-products-modal",
);
const productSearchInput = document.getElementById("product-search-input");
const productSearchBtn = document.getElementById("product-search-btn");
const STICKER_REGEX = /^(https?:\/\/.+|data:image)/;

// 全局的、通用的商品图片提示词模板库
// 我们会根据商品名称的关键词来智能匹配这些模板
const GENERIC_PRODUCT_PROMPTS = [
  {
    keywords: [
      "áo",
      "váy",
      "quần",
      "áo thun",
      "sơ mi",
      "áo khoác",
      "hoodie",
      "áo len",
      "đồ",
      "trang phục",
    ],
    englishCategory: "a piece of fashion clothing", // 新增的英文品类名
    prompt:
      "A piece of modern clothing, {productName}, elegantly displayed on a mannequin or lying flat, clean minimalist studio shot, professional product photography, soft shadows, solid color background, high detail, photorealistic, 8k",
  },
  {
    keywords: ["giày", "bốt", "sneaker", "boot"],
    englishCategory: "a modern sneaker",
    prompt:
      "A single modern shoe, {productName}, studio product shot, minimalist, on a solid color platform, detailed, photorealistic, commercial photography, soft studio lighting",
  },
  {
    keywords: ["túi", "bao", "backpack", "handbag"],
    englishCategory: "a stylish modern bag",
    prompt:
      "A stylish modern bag, {productName}, professional product photography, minimalist, clean background, studio lighting, high fashion, high detail, 8k, hyperrealistic",
  },
  {
    keywords: [
      "điện thoại",
      "tai nghe",
      "bàn phím",
      "chuột",
      "dây sạc",
      "sạc",
      "kỹ thuật số",
      "điện tử",
    ],
    englishCategory: "a sleek electronic gadget",
    prompt:
      "A sleek electronic gadget, {productName}, on a clean modern desk, minimalist product shot, tech aesthetic, studio lighting, photorealistic, octane render, 8k",
  },
  {
    keywords: [
      "đồ ăn vặt",
      "bánh quy",
      "khoai tây chiên",
      "kẹo",
      "sô cô la",
      "nước",
      "đồ uống",
      "trà",
      "cà phê",
      "food",
      "snack",
      "mì",
      "cơm",
      "hamburger",
      "trà sữa",
    ],
    englishCategory: "a delicious-looking food or drink product",
    prompt:
      "Delicious-looking {productName}, professional product shot, appetizing, packaging or food itself displayed, minimalist setup, vibrant colors, solid color background, high detail, food photography",
  },
  {
    keywords: [
      "cốc",
      "bát",
      "đĩa",
      "nồi",
      "đèn",
      "chăn",
      "gối",
      "đồ gia dụng",
      "đồ trang trí",
      "trang trí",
    ],
    englishCategory: "a modern home decor item",
    prompt:
      "A modern home decor item, {productName}, in a cozy and minimalist living room setting, soft lighting, professional product shot, high detail, photorealistic, interior design magazine style",
  },
  {
    keywords: ["trang điểm", "dưỡng da", "son", "phấn mắt", "nước hoa", "mặt nạ"],
    englishCategory: "a cosmetic product package",
    prompt:
      "A bottle or package of a cosmetic product, {productName}, clean product shot, on a podium with simple geometric shapes, minimalist, beauty photography, high detail, solid color background, soft shadows",
  },
  {
    keywords: ["đồ chơi", "búp bê", "Model", "mô hình", "toy", "figure"],
    englishCategory: "a cute or cool toy figure",
    prompt:
      "A cute or cool toy figure, {productName}, product shot, on a simple stand, plain background, studio lighting, detailed, collectible, anime style, 8k",
  },
  {
    keywords: ["sách", "sổ", "bút", "văn phòng phẩm"],
    englishCategory: "a book or stationery item",
    prompt:
      "A book or stationery item, {productName}, neatly arranged on a clean desk, minimalist, flat lay photography, high detail, studio lighting, soft shadows",
  },
  {
    // 这是默认的备用模板，如果上面的关键词都匹配不上，就用这个
    keywords: [],
    englishCategory: "a modern product", // 默认的英文品类名
    // ★★★ 全面优化的备用提示词 ★★★
    prompt:
      "Commercial product photography of {productName}. Professional studio shot, clean minimalist aesthetic, displayed on a podium or flat surface. Soft, even lighting, subtle soft shadows. Shot on a high-end camera, 8k, hyperrealistic, high detail.",
  },
];

/**
 * 顺序处理图片生成队列
 * 这个函数会一个接一个地为队列中的商品/美食生成图片，避免并发请求。
 */
async function processImageQueue() {
  // 如果当前有其他任务正在处理，就直接返回，让它处理完再说
  if (isProcessingImage) return;

  // 标记为“正在处理中”，锁上开关
  isProcessingImage = true;
  console.log(
    `队列开始处理，当前有 ${imageGenerationQueue.length} 个图片生成任务。`,
  );

  // 只要队列里还有任务，就一直循环
  while (imageGenerationQueue.length > 0) {
    // 从队列的头部取出一个任务
    const task = imageGenerationQueue.shift();

    console.log(`正在为 "${task.item.name}" 生成图片...`);

    try {
      // 根据任务类型，调用对应的图片处理函数
      // 这里我们等待 (await) 每个图片生成函数执行完毕
      if (task.type === "taobao") {
        await processProductImage(task.item);
      } else if (task.type === "eleme") {
        await processFoodImage(task.item);
      }
    } catch (error) {
      // 即使单个任务失败，也要打印错误并继续处理下一个任务
      console.error(`生成 "${task.item.name}" 的图片时发生意外错误:`, error);
    }
  }

  // 所有任务都处理完了，标记为“已完成”，解开开关，等待下一次任务
  isProcessingImage = false;
  console.log("图片生成队列已处理完毕。");
}

/**
 * 根据商品名智能选择一个通用的图片提示词
 * @param {string} productName - 商品的中文名
 * @returns {string} - 拼接好的、纯英文的提示词
 */
function selectGenericImagePrompt(productName) {
  const lowerCaseName = productName.toLowerCase();

  let matchedTemplate = null;

  // 1. 寻找最匹配的模板
  for (const template of GENERIC_PRODUCT_PROMPTS) {
    if (
      template.keywords.length > 0 &&
      template.keywords.some((kw) => lowerCaseName.includes(kw))
    ) {
      matchedTemplate = template;
      break; // 找到第一个匹配的就跳出循环
    }
  }

  // 2. 如果没有找到匹配的，则使用默认的备用模板
  if (!matchedTemplate) {
    matchedTemplate =
      GENERIC_PRODUCT_PROMPTS[GENERIC_PRODUCT_PROMPTS.length - 1];
  }

  console.log(
    `为“${productName}”匹配到分类: ${matchedTemplate.englishCategory}`,
  );

  const finalPrompt = matchedTemplate.prompt.replace(
    "{productName}",
    matchedTemplate.englishCategory,
  );

  return finalPrompt;
}

async function generateAndLoadImage(prompt) {
  while (true) {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 100000);

      // 1. 获取 API Key (从全局状态获取)
      const pollApiKey = state.apiConfig.pollinationsApiKey;
      console.log(`正在使用 API Key: ${pollApiKey}`);

      // 2. 构建基础 URL
      let primaryUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=1024&height=640&seed=${seed}&model=flux`;

      // === 分支 A: 如果有 API Key，使用 fetch 发送带 Header 的请求 ===
      if (pollApiKey) {
        primaryUrl += `&key=${pollApiKey}`;
        console.log(`使用带Key的URL: ${primaryUrl}`);
        console.log("正在使用 Pollinations API Key 生成图片...");
        const response = await fetch(primaryUrl, {
          method: "GET",
        });

        if (!response.ok) {
          throw new Error(`Yêu cầu API thất bại: ${response.status}`);
        }

        // 获取二进制数据并转换为 Blob URL
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl; // 返回 Blob URL
      }

      // === 分支 B: 如果没有 API Key 或 API Key 请求失败，走原来的公开接口逻辑 ===

      // 定义加载器辅助函数
      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(url);
          img.onerror = () => reject(new Error(`Tải URL thất bại: ${url}`));
        });

      const imageUrl = await loadImage(primaryUrl).catch(async () => {
        console.warn(`主URL加载失败，尝试备用URL for: ${prompt}`);
        const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=640&seed=${seed}`;
        return await loadImage(fallbackUrl);
      });

      // 如果成功加载，返回 URL
      return imageUrl;
    } catch (error) {
      // 如果彻底失败（Fetch失败 或 Image加载失败）
      console.error(`图片生成失败，将在5秒后重试。错误: ${error.message}`);
      // 等待5秒钟，然后循环继续，开始下一次尝试 (无限重试机制)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 为Prompt生成并加载图片
 * @param {string} prompt - 用于生成图片的英文提示词
 * @returns {Promise<string>} - 返回一个Promise，它最终会resolve为一个有效的图片URL
 */
async function generateAndLoadImage(prompt) {
  while (true) {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 100000);

      // 尝试主域名
      const primaryUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=640&seed=${seed}`;

      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(url);
          img.onerror = () => reject(new Error(`Tải URL thất bại: ${url}`));
        });

      const imageUrl = await loadImage(primaryUrl).catch(async () => {
        console.warn(`主URL加载失败，尝试备用URL for: ${prompt}`);
        const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=640&seed=${seed}`;
        return await loadImage(fallbackUrl);
      });

      // 如果任何一个URL成功加载，就返回结果，并跳出循环
      return imageUrl;
    } catch (error) {
      // 如果主域名和备用域名都失败了...
      console.error(`图片生成彻底失败，将在5秒后重试。错误: ${error.message}`);
      // 等待5秒钟，然后循环会继续，开始下一次尝试
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 异步处理单个商品图片的生成和保存
 * @param {object} product - 商品对象
 */
async function processProductImage(product) {
  try {
    // 智能决策，决定使用哪个提示词
    let imagePrompt;
    if (product.imagePrompt && product.imagePrompt.trim() !== "") {
      // 如果这个商品数据中自带了专属的 imagePrompt (通常来自AI生成)，就优先使用它！
      imagePrompt = product.imagePrompt;
      console.log(
        `正在为桃宝商品“${product.name}”使用AI提供的专属提示词进行生图...`,
      );
    } else {
      // 否则（比如是手动添加的、或者旧数据），就回退到通用模板匹配方案
      imagePrompt = selectGenericImagePrompt(product.name);
      console.log(`正在为桃宝商品“${product.name}”匹配通用提示词进行生图...`);
    }

    // 2. 调用全局统一的 Pollinations 生图函数
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });

    // 3. 将生成好的图片URL保存回“桃宝”的数据库，实现持久化
    await db.taobaoProducts.update(product.id, { imageUrl: imageUrl });

    const cardElement = document.querySelector(
      `.product-card[data-product-id="${product.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${product.name}">`;
      }
    }
  } catch (error) {
    console.error(`处理商品 "${product.name}" 图片时失败:`, error);
    const cardElement = document.querySelector(
      `.product-card[data-product-id="${product.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<span>Ảnh<br>tải thất bại</span>`;
      }
    }
  }
}

/**
 * 异步处理单个美食图片的生成和保存
 * @param {object} food - 美食对象
 */
async function processFoodImage(food) {
  try {
    // 1. 智能决策：决定使用哪个提示词
    let imagePrompt;
    if (food.imagePrompt && food.imagePrompt.trim() !== "") {
      // 如果这个美食数据中自带了专属的 imagePrompt，就优先使用它！
      imagePrompt = food.imagePrompt;
      console.log(`正在为“${food.name}”使用AI提供的专属提示词进行生图...`);
    } else {
      // 否则（比如是手动添加的、或者旧数据），就回退到通用模板匹配方案
      imagePrompt = selectGenericImagePrompt(food.name);
      console.log(`正在为“${food.name}”匹配通用提示词进行生图...`);
    }

    // 2. 调用全局统一的 Pollinations 生图函数
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });

    // 3. 将生成好的图片URL保存回“饿了么”的数据库，实现持久化
    await db.elemeFoods.update(food.id, { imageUrl: imageUrl });

    const cardElement = document.querySelector(
      `.product-card[data-food-id="${food.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${food.name}">`;
      }
    }
  } catch (error) {
    // 理论上很难触发，但作为保险
    console.error(`处理美食 "${food.name}" 图片时失败:`, error);
    const cardElement = document.querySelector(
      `.product-card[data-food-id="${food.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<span>Ảnh<br>tải thất bại</span>`;
      }
    }
  }
}

/**
 * 为商品名称生成图片
 * @param {string} productName - 商品的中文名称
 * @returns {Promise<string>} - 返回一个Promise，它最终会resolve为一个有效的图片URL
 */
async function generateImageForProduct(productName) {
  // 1. 调用新函数，根据商品名智能选择一个提示词（不再需要API！）
  const imagePrompt = selectGenericImagePrompt(productName);
  console.log(`为“${productName}”选定的提示词:`, imagePrompt);

  // 2. 调用已具备“无限重试”功能的核心图片生成函数
  // 这个函数会一直尝试，直到成功返回一个图片URL
  try {
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });
    return imageUrl;
  } catch (error) {
    // 理论上，由于 generateAndLoadImage 是无限循环，代码不会执行到这里。
    // 但为了代码健壮性，我们仍然保留一个最终的备用方案。
    console.error(
      `[终极捕获] 为 "${productName}" 生成图片时发生不可预知的错误:`,
      error,
    );
    return getRandomDefaultProductImage();
  }
}

async function renderChatList() {
  const chatListEl = document.getElementById("chat-list");
  chatListEl.innerHTML = "";

  // 1. 获取所有聊天和分组数据
  const allChats = Object.values(state.chats);
  const allGroups = await db.qzoneGroups.toArray();

  if (allChats.length === 0) {
    chatListEl.innerHTML =
      '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">Bấm "+" góc trên bên phải hoặc biểu tượng nhóm để thêm chat</p>';
    return;
  }

  // 2. 将聊天明确地分为“置顶”和“未置顶”两组
  const pinnedChats = allChats.filter((chat) => chat.isPinned);
  const unpinnedChats = allChats.filter((chat) => !chat.isPinned);

  // 3. 对置顶的聊天，仅按最新消息时间排序
  pinnedChats.sort(
    (a, b) =>
      (b.history.slice(-1)[0]?.timestamp || 0) -
      (a.history.slice(-1)[0]?.timestamp || 0),
  );

  // 4. 【优先渲染】所有置顶的聊天
  pinnedChats.forEach((chat) => {
    const item = createChatListItem(chat);
    chatListEl.appendChild(item);
  });

  // 5. 为每个分组找到其内部最新的消息时间戳 (只在未置顶聊天中查找)
  allGroups.forEach((group) => {
    const latestChatInGroup = unpinnedChats
      .filter((chat) => chat.groupId === group.id) // 找到属于这个组的聊天
      .sort(
        (a, b) =>
          (b.history.slice(-1)[0]?.timestamp || 0) -
          (a.history.slice(-1)[0]?.timestamp || 0),
      )[0]; // 排序后取第一个

    group.latestTimestamp = latestChatInGroup
      ? latestChatInGroup.history.slice(-1)[0]?.timestamp || 0
      : 0;
  });

  // 根据分组的最新时间戳，对分组本身进行排序
  allGroups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  // 6. 遍历排序后的分组，渲染其中的【未置顶】好友
  allGroups.forEach((group) => {
    const groupChats = unpinnedChats
      .filter((chat) => !chat.isGroup && chat.groupId === group.id)
      .sort(
        (a, b) =>
          (b.history.slice(-1)[0]?.timestamp || 0) -
          (a.history.slice(-1)[0]?.timestamp || 0),
      );

    if (groupChats.length === 0) return; // 如果这个分组里没有未置顶的好友，就跳过

    const groupContainer = document.createElement("div");
    groupContainer.className = "chat-group-container";

    groupContainer.innerHTML = `
            <div class="chat-group-header">
                <span class="arrow">▼</span>
                <span class="group-name">${group.name}</span>
            </div>
            <div class="chat-group-content"></div>
        `;
    const contentEl = groupContainer.querySelector(".chat-group-content");

    groupChats.forEach((chat) => {
      const item = createChatListItem(chat);
      contentEl.appendChild(item);
    });
    chatListEl.appendChild(groupContainer);
  });

  // 7. 最后，渲染所有【未置顶】的群聊和【未分组的】好友
  const remainingChats = unpinnedChats
    .filter((chat) => chat.isGroup || (!chat.isGroup && !chat.groupId))
    .sort(
      (a, b) =>
        (b.history.slice(-1)[0]?.timestamp || 0) -
        (a.history.slice(-1)[0]?.timestamp || 0),
    );

  remainingChats.forEach((chat) => {
    const item = createChatListItem(chat);
    chatListEl.appendChild(item);
  });

  // 为所有分组标题添加折叠事件
  document.querySelectorAll(".chat-group-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.classList.toggle("collapsed");
      header.nextElementSibling.classList.toggle("collapsed");
    });
  });
}

function createChatListItem(chat) {
  const lastMsgObj =
    chat.history.filter((msg) => !msg.isHidden).slice(-1)[0] || {};
  let lastMsgDisplay;

  // --- 消息预览的逻辑 (这部分保持不变) ---
  if (!chat.isGroup && chat.relationship?.status === "pending_user_approval") {
    lastMsgDisplay = `<span style="color: #ff8c00;">[Lời mời kết bạn] ${chat.relationship.applicationReason || "muốn kết bạn với bạn"}</span>`;
  } else if (!chat.isGroup && chat.relationship?.status === "blocked_by_ai") {
    lastMsgDisplay = `<span style="color: #dc3545;">[Bạn đã bị đối phương chặn]</span>`;
  } else if (chat.isGroup) {
    if (lastMsgObj.type === "pat_message") {
      lastMsgDisplay = `[Tin nhắn hệ thống] ${lastMsgObj.content}`;
    } else if (lastMsgObj.type === "transfer") {
      lastMsgDisplay = "[Chuyển khoản]";
    } else if (
      lastMsgObj.type === "ai_image" ||
      lastMsgObj.type === "user_photo"
    ) {
      lastMsgDisplay = "[Ảnh]";
    } else if (lastMsgObj.type === "voice_message") {
      lastMsgDisplay = "[Tin nhắn thoại]";
    } else if (
      typeof lastMsgObj.content === "string" &&
      STICKER_REGEX.test(lastMsgObj.content)
    ) {
      lastMsgDisplay = lastMsgObj.meaning
        ? `[Sticker: ${lastMsgObj.meaning}]`
        : "[Sticker]";
    } else if (Array.isArray(lastMsgObj.content)) {
      lastMsgDisplay = `[Hình ảnh]`;
    } else {
      lastMsgDisplay = String(lastMsgObj.content || "...").substring(0, 20);
    }
    if (lastMsgObj.senderName && lastMsgObj.type !== "pat_message") {
      lastMsgDisplay = `${lastMsgObj.senderName}: ${lastMsgDisplay}`;
    }
  } else {
    const statusText = chat.status?.text || "Trực tuyến";
    lastMsgDisplay = `[${statusText}]`;
  }

  const lastMsgTimestamp = lastMsgObj?.timestamp;
  const timeDisplay = formatChatListTimestamp(lastMsgTimestamp);

  const container = document.createElement("div");
  container.className = "chat-list-item-swipe-container";
  container.dataset.chatId = chat.id;

  const content = document.createElement("div");
  content.className = `chat-list-item-content ${chat.isPinned ? "pinned" : ""}`;

  const avatar = chat.isGroup
    ? chat.settings.groupAvatar
    : chat.settings.aiAvatar;

  let streakHtml = "";
  // 检查是否为单聊、功能是否开启
  if (!chat.isGroup && chat.settings.streak && chat.settings.streak.enabled) {
    const streak = chat.settings.streak;

    let isExtinguished = false;
    if (streak.lastInteractionDate && streak.extinguishThreshold !== -1) {
      const lastDate = new Date(streak.lastInteractionDate);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const daysDiff = (todayDate - lastDate) / (1000 * 3600 * 24);
      if (daysDiff >= streak.extinguishThreshold) {
        isExtinguished = true;
      }
    }

    // 准备图标和颜色
    const litIconUrl = streak.litIconUrl;
    const extinguishedIconUrl = streak.extinguishedIconUrl;
    const fontColor = streak.fontColor || "#ff6f00"; // 如果没设置颜色，就用默认的橙色

    let iconHtml = "";

    if (isExtinguished) {
      // 如果熄灭了，优先用自定义熄灭图片，否则用默认 Emoji
      iconHtml = extinguishedIconUrl
        ? `<img src="${extinguishedIconUrl}" style="height: 1.2em; vertical-align: middle;">`
        : "🧊";
    } else if (streak.currentDays > 0) {
      // 如果在续，优先用自定义点亮图片，否则用默认 Emoji
      iconHtml = litIconUrl
        ? `<img src="${litIconUrl}" style="height: 1.2em; vertical-align: middle;">`
        : "🔥";
    }

    // 拼接最终的HTML
    if (iconHtml) {
      // 如果火花已熄灭 (isExtinguished 为 true)
      if (isExtinguished) {
        // 就只显示熄灭的图标，不显示天数
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}</span>`;
      }
      // 如果是永不熄灭模式（并且未熄灭）
      else if (streak.currentDays === -1 || streak.initialDays === -1) {
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}∞</span>`;
      }
      // 其他所有情况（即，火花是点亮的）
      else {
        // 才显示图标和天数
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}${streak.currentDays}</span>`;
      }
    }
  }

  content.innerHTML = `
        <div class="chat-list-item" data-chat-id="${chat.id}">
            <img src="${avatar || defaultAvatar}" class="avatar">
            <div class="info">
                <div class="name-line">
                    <span class="name">${chat.name}</span>
                    ${chat.isGroup ? '<span class="group-tag">Nhóm chat</span>' : ""}
                    ${streakHtml}
                </div>
                <div class="last-msg" style="color: ${
                  chat.isGroup ? "var(--text-secondary)" : "#b5b5b5"
                }; font-style: italic;">${lastMsgDisplay}</div>
            </div>
            <div class="chat-list-right-column">
                <div class="chat-list-time">${timeDisplay}</div>
                <div class="unread-count-wrapper">
                    <span class="unread-count" style="display: none;">0</span>
                </div>
            </div>
        </div>
    `;

  const actions = document.createElement("div");
  actions.className = "swipe-actions";
  const pinButtonText = chat.isPinned ? "Bỏ ghim" : "Ghim";
  const pinButtonClass = chat.isPinned ? "unpin" : "pin";
  actions.innerHTML = `<button class="swipe-action-btn ${pinButtonClass}">${pinButtonText}</button><button class="swipe-action-btn delete">Xóa</button>`;

  container.appendChild(content);
  container.appendChild(actions);

  const unreadCount = chat.unreadCount || 0;
  const unreadEl = content.querySelector(".unread-count");
  if (unreadCount > 0) {
    unreadEl.textContent = unreadCount > 99 ? "99+" : unreadCount;
    unreadEl.style.display = "inline-flex";
  } else {
    unreadEl.style.display = "none";
  }

  const infoEl = content.querySelector(".info");
  if (infoEl) {
    infoEl.addEventListener("click", () => openChat(chat.id));
  }
  const avatarEl = content.querySelector(".avatar, .avatar-with-frame");
  if (avatarEl) {
    avatarEl.addEventListener("click", (e) => {
      e.stopPropagation();
      handleUserPat(chat.id, chat.name);
    });
  }

  return container;
}

/**
 * 根据时间戳，格式化聊天列表右侧的日期/时间显示
 * @param {number} timestamp - 消息的时间戳
 * @returns {string} - 格式化后的字符串 (例如 "14:30", "昨天", "08/03")
 */
function formatChatListTimestamp(timestamp) {
  if (!timestamp) return ""; // 如果没有时间戳，返回空字符串

  const now = new Date();
  const msgDate = new Date(timestamp);

  // 判断是否为今天
  const isToday =
    now.getFullYear() === msgDate.getFullYear() &&
    now.getMonth() === msgDate.getMonth() &&
    now.getDate() === msgDate.getDate();

  if (isToday) {
    // 如果是今天，只显示时间
    return msgDate.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // 判断是否为昨天
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === msgDate.getFullYear() &&
    yesterday.getMonth() === msgDate.getMonth() &&
    yesterday.getDate() === msgDate.getDate();

  if (isYesterday) {
    return "Hôm qua";
  }

  // 判断是否为今年
  if (now.getFullYear() === msgDate.getFullYear()) {
    // 如果是今年，显示 "月/日"
    const month = String(msgDate.getMonth() + 1).padStart(2, "0");
    const day = String(msgDate.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  }

  // 如果是更早的年份，显示 "年/月/日"
  const year = msgDate.getFullYear();
  const month = String(msgDate.getMonth() + 1).padStart(2, "0");
  const day = String(msgDate.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function showNotification(chatId, messageContent) {
  playNotificationSound();
  clearTimeout(notificationTimeout);
  const chat = state.chats[chatId];
  if (!chat) return;
  const bar = document.getElementById("notification-bar");
  document.getElementById("notification-avatar").src =
    chat.settings.aiAvatar || chat.settings.groupAvatar || defaultAvatar;
  document
    .getElementById("notification-content")
    .querySelector(".name").textContent = chat.name;
  document
    .getElementById("notification-content")
    .querySelector(".message").textContent = messageContent;
  const newBar = bar.cloneNode(true);
  bar.parentNode.replaceChild(newBar, bar);
  newBar.addEventListener("click", () => {
    openChat(chatId);
    newBar.classList.remove("visible");
  });
  newBar.classList.add("visible");
  notificationTimeout = setTimeout(() => {
    newBar.classList.remove("visible");
  }, 4000);
}
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
 * 播放消息提示音，增加健壮性
 */
function playNotificationSound() {
  const soundUrl =
    state.globalSettings.notificationSoundUrl ||
    "https://laddy-lulu.github.io/Ephone-stuffs/message.mp3";

  // 1. 增加安全检查：如果链接为空，直接返回，不执行任何操作
  if (!soundUrl || !soundUrl.trim()) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.7;

    audio.play().catch((error) => {
      // 2. 优化错误提示，现在能更准确地反映问题
      if (error.name === "NotAllowedError") {
        console.warn(
          "播放消息提示音失败：用户需要先与页面进行一次交互（如点击）才能自动播放音频。",
        );
      } else {
        // 对于其他错误（比如我们这次遇到的），直接打印错误详情
        console.error(
          `播放消息提示音失败 (${error.name}): ${error.message}`,
          "URL:",
          soundUrl,
        );
      }
    });
  } catch (error) {
    console.error("创建提示音Audio对象时出错:", error);
  }
}

/**
 * 获取一张随机的外卖默认图片
 * @returns {string} - 返回一张随机图片的URL
 */
function getRandomWaimaiImage() {
  const defaultImages = [
    "https://i.postimg.cc/mD8DB9Q7/food1.jpg",
    "https://i.postimg.cc/W12WqgJp/food2.jpg",
    "https://i.postimg.cc/KzA1df4y/food3.jpg",
  ];
  return defaultImages[Math.floor(Math.random() * defaultImages.length)];
}

/**
 * 获取一张随机的淘宝宝贝默认图片
 * @returns {string} - 返回一张随机图片的URL
 */
function getRandomDefaultProductImage() {
  const defaultImages = [
    "https://i.postimg.cc/W4svy4Hm/Image-1760206134285.jpg",
    "https://i.postimg.cc/jjRb1jF7/Image-1760206125678.jpg",
  ];
  // 从数组中随机选择一个并返回
  return defaultImages[Math.floor(Math.random() * defaultImages.length)];
}

/**
 * 核心函数：更新用户余额并记录一笔交易
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述 (例如: "转账给 XX", "收到 XX 的红包")
 */
async function updateUserBalanceAndLogTransaction(amount, description) {
  if (isNaN(amount)) return; // 安全检查

  // 确保余额是数字
  state.globalSettings.userBalance =
    (state.globalSettings.userBalance || 0) + amount;

  const newTransaction = {
    type: amount > 0 ? "income" : "expense",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 使用数据库事务，确保两步操作要么都成功，要么都失败
  await db.transaction(
    "rw",
    db.globalSettings,
    db.userWalletTransactions,
    async () => {
      await db.globalSettings.put(state.globalSettings);
      await db.userWalletTransactions.add(newTransaction);
    },
  );

  console.log(
    `用户钱包已更新: 金额=${amount.toFixed(2)}, 新余额=${state.globalSettings.userBalance.toFixed(2)}`,
  );
}
/**
 * 处理角色手机钱包余额和交易记录的通用函数
 * @param {string} charId - 要更新钱包的角色ID
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述
 */
async function updateCharacterPhoneBankBalance(charId, amount, description) {
  const chat = state.chats[charId];
  if (!chat || chat.isGroup) return;

  if (!chat.characterPhoneData) chat.characterPhoneData = {};
  if (!chat.characterPhoneData.bank)
    chat.characterPhoneData.bank = { balance: 0, transactions: [] };
  if (typeof chat.characterPhoneData.bank.balance !== "number")
    chat.characterPhoneData.bank.balance = 0;

  chat.characterPhoneData.bank.balance += amount;

  const newTransaction = {
    type: amount > 0 ? "Thu nhập" : "Chi tiêu",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 让最新的交易记录显示在最前面
  if (!Array.isArray(chat.characterPhoneData.bank.transactions)) {
    chat.characterPhoneData.bank.transactions = [];
  }
  chat.characterPhoneData.bank.transactions.unshift(newTransaction);

  await db.chats.put(chat);
  console.log(
    `✅ 角色[${chat.name}]钱包已更新: 金额=${amount.toFixed(2)}, 新余额=${chat.characterPhoneData.bank.balance.toFixed(
      2,
    )}`,
  );
}

/**
 * 清空桃宝首页的所有商品及购物车
 */
async function clearTaobaoProducts() {
  // 1. 修改提示语，告知用户购物车也会被清空
  const confirmed = await showCustomConfirm(
    "Xác nhận xóa sạch",
    "Bạn có chắc muốn xóa sạch mọi sản phẩm trên trang chủ Đào Bảo? Thao tác này sẽ 【xóa sạch luôn giỏ hàng】, và không thể khôi phục.",
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    try {
      // 使用数据库事务，确保两步操作要么都成功，要么都失败，更安全
      await db.transaction("rw", db.taobaoProducts, db.taobaoCart, async () => {
        // 清空商品库
        await db.taobaoProducts.clear();
        // 清空购物车数据库
        await db.taobaoCart.clear();
      });

      // 重新渲染UI
      await renderTaobaoProducts();
      // 刷新购物车UI（让页面变空）
      await renderTaobaoCart();
      // 更新购物车角标（让红点消失）
      updateCartBadge();

      // 2. 修改成功提示
      await showCustomAlert("Thao tác thành công", "Đã xóa sạch mọi sản phẩm và giỏ hàng!");
    } catch (error) {
      console.error("清空桃宝商品时出错:", error);
      await showCustomAlert("Thao tác thất bại", `Có lỗi: ${error.message}`);
    }
  }
}

/**
 * 打开“桃宝”App，并渲染默认视图
 */
async function openTaobaoApp() {
  showScreen("taobao-screen");
  await renderTaobaoProducts(); // 默认显示所有商品
  renderBalanceDetails(); // 刷新余额显示
}

/**
 * 渲染“饿了么”页面的美食列表
 */
async function renderElemeFoods() {
  const gridEl = document.getElementById("eleme-grid");
  gridEl.innerHTML = "";
  const foods = await db.elemeFoods.toArray();

  if (foods.length === 0) {
    gridEl.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Chưa có món ăn nào, bấm "✨" hoặc "+" ở góc trên bên phải để khám phá món ngon nhé!</p>';
    return;
  }

  foods.forEach((food) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.cursor = "pointer";
    card.dataset.foodId = food.id;

    card.innerHTML = `
        <div class="product-image-container">
<!-- ảnh hoặc hoạt ảnh đang tải sẽ ở đây -->
        </div>
        <div class="product-info">
            <div class="product-name" title="${food.name} · ${food.restaurant}">${food.name}</div>
            <div class="product-price">¥${food.price.toFixed(2)}</div>
        </div>
    `;

    const imageContainer = card.querySelector(".product-image-container");

    if (food.imageUrl) {
      imageContainer.innerHTML = `<img src="${food.imageUrl}" class="product-image" alt="${food.name}">`;
    } else {
      imageContainer.innerHTML = `<div class="loading-spinner"></div>`;
      imageGenerationQueue.push({ type: "eleme", item: food });
    }

    addLongPressListener(card, () => showFoodActions(food.id));
    gridEl.appendChild(card);
  });

  // 渲染完所有卡片后，触发一次队列处理器
  processImageQueue();
}

/**
 * 打开美食详情弹窗
 * @param {number} foodId - 美食的ID
 */
async function openFoodDetail(foodId) {
  const food = await db.elemeFoods.get(foodId);
  if (!food) return;

  const modal = document.getElementById("product-detail-modal");
  const bodyEl = document.getElementById("product-detail-body");
  const reviewsSection = document.getElementById("product-reviews-section");
  const closeBtn = document.getElementById("close-product-detail-btn");
  const actionBtn = document.getElementById("detail-add-to-cart-btn");

  // 1. 渲染美食基本信息
  bodyEl.innerHTML = `
        <img src="${food.imageUrl}" class="product-image" alt="${food.name}">
        <h2 class="product-name">${food.name}</h2>
        <p class="product-price">¥${food.price.toFixed(2)}</p>
<p style="color: #888; font-size: 13px;">Cửa hàng: ${food.restaurant || "Cửa hàng chọn lọc"}</p>
    `;

  // 2. 隐藏不相关的“宝贝评价”区域
  reviewsSection.style.display = "none";

  // 3. 改造底部按钮
  const newActionBtn = actionBtn.cloneNode(true);
  newActionBtn.textContent = "Đặt cho người ấy"; // 修改按钮文字
  actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

  // 为新按钮绑定“点单”逻辑
  newActionBtn.onclick = async () => {
    modal.classList.remove("visible"); // 先关闭弹窗
    await handleOrderForChar(foodId); // 再执行点单流程
  };

  // 绑定关闭按钮
  closeBtn.onclick = () => modal.classList.remove("visible");

  // 显示弹窗
  modal.classList.add("visible");
}
/**
 * 【全新】清空饿了么的所有美食
 */
async function clearElemeFoods() {
  const confirmed = await showCustomConfirm(
    "Xác nhận xóa sạch",
    "Bạn có chắc muốn xóa sạch mọi món ăn của Ele.me? Thao tác này không thể khôi phục.",
    {
      confirmButtonClass: "btn-danger",
    },
  );

  if (confirmed) {
    try {
      await db.elemeFoods.clear(); // 清空美食数据库
      await renderElemeFoods(); // 重新渲染UI，显示空状态
      await showCustomAlert("Thao tác thành công", "Đã xóa sạch mọi món ăn!");
    } catch (error) {
      console.error("清空饿了么美食时出错:", error);
      await showCustomAlert("Thao tác thất bại", `Có lỗi: ${error.message}`);
    }
  }
}

/**
 * 为“饿了么”随机生成商品
 */
async function handleGenerateFoodsAI() {
  await showCustomAlert("Vui lòng chờ...", "AI đang lùng sục món ngon khắp thành phố...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Hãy cấu hình xong trong Cài đặt API mới dùng được chức năng AI nhé!");
    return;
  }

  const prompt = `
# Nhiệm vụ
Bạn là biên tập viên của ứng dụng giao đồ ăn "Ele.me". Hãy gợi ý ngẫu nhiên cho tôi 5-8 món hàng giao tận nơi. Viết tên món, tên quán, phân loại bằng tiếng Việt.

# Quy tắc cốt lõi
1.  **Đa dạng mặt hàng**: Loại mặt hàng phải đa dạng, có thể gồm 【đồ ăn, đồ ăn vặt, đồ uống, thuốc, đồ dùng hằng ngày】...
2.  **Tên hấp dẫn**: Tên món phải nghe đã thấy ngon.
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một món hàng, và gồm các trường sau:
-   \`"name"\`: tên món (chuỗi)
-   \`"price"\`: giá (số)
-   \`"restaurant"\`: tên cửa hàng ảo (chuỗi)
-   \`"category"\`: phân loại món (chuỗi, ví dụ: "Đồ ăn", "Đồ uống", "Đồ ăn vặt", "Thuốc", "Đồ dùng")
-   \`"imagePrompt"\`: một 【prompt tiếng Anh】 chi tiết cho AI tạo ảnh từ chữ, dùng để tạo một 【ảnh sản phẩm hấp dẫn (appetizing product shot)】 về món đó.

# Ví dụ định dạng đầu ra JSON:
[
  {
"name": "Trà kem phô mai nho mọng",
    "price": 22.0,
"restaurant": "Nayuki",
"category": "Đồ uống",
    "imagePrompt": "A cup of grape cheese foam tea, with fresh grape pulp, product shot, minimalist, vibrant, delicious and appetizing, commercial photography"
  },
  {
"name": "Viên nang giải phóng chậm Ibuprofen",
    "price": 15.5,
"restaurant": "Nhà thuốc đầu ngõ",
"category": "Thuốc",
    "imagePrompt": "A box of Ibuprofen sustained-release capsules, clean medical product shot, minimalist, on a white background, professional photography"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 1.1,
              response_format: { type: "json_object" },
            }),
          },
        };
    const response = await fetch(requestData.url, requestData.options);
    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);
    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    let newFoods;
    try {
      newFoods = JSON.parse(rawContent.replace(/^```json\s*|```$/g, "").trim());
    } catch (e) {
      throw new Error("JSON do AI trả về sai định dạng.");
    }

    if (Array.isArray(newFoods) && newFoods.length > 0) {
      const foodsToSave = newFoods.map((food) => ({ ...food, imageUrl: "" }));
      await db.elemeFoods.bulkAdd(foodsToSave);
      await renderElemeFoods(); // 重新渲染饿了么页面
      await showCustomAlert(
        "Tạo thành công!",
        `Đã gợi ý thành công ${newFoods.length} món cho bạn!`,
      );
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng hoặc rỗng.");
    }
  } catch (error) {
    console.error("AI生成饿了么商品失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 根据关键词搜索商品
 */
async function handleSearchFoodsAI() {
  const searchTerm = document.getElementById("eleme-search-input").value.trim();
  if (!searchTerm) {
    alert("Vui lòng nhập từ khóa sản phẩm bạn muốn tìm!");
    return;
  }

  await showCustomAlert(
    "Vui lòng chờ...",
    `AI đang tìm cho bạn các món liên quan tới "${searchTerm}"...`,
  );
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const prompt = `
# Nhiệm vụ
Bạn là công cụ tìm kiếm của ứng dụng giao đồ ăn "Ele.me". Hãy dựa vào 【từ khóa tìm kiếm】 người dùng cung cấp, tạo cho người đó một danh sách gồm 5-8 món giao tận nơi liên quan. Viết tên món, tên quán, phân loại bằng tiếng Việt.

# Từ khóa người dùng tìm:
"${searchTerm}"

# Quy tắc cốt lõi
1.  **Liên quan cao**: Mọi món đều phải liên quan chặt chẽ tới từ khóa tìm kiếm "${searchTerm}" của người dùng.
2.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một món, và gồm các trường sau:
-   \`"name"\`: tên món
-   \`"price"\`: giá (số)
-   \`"restaurant"\`: tên cửa hàng ảo
-   \`"category"\`: phân loại món (ví dụ: "Đồ ăn", "Đồ uống", "Đồ ăn vặt", "Thuốc", "Đồ dùng")
-   \`"imagePrompt"\`: một 【prompt tiếng Anh】 chi tiết cho AI tạo ảnh từ chữ, dùng để tạo một 【ảnh sản phẩm hấp dẫn (appetizing product shot)】 về "${searchTerm}".

# Ví dụ định dạng đầu ra JSON:
[
  {
"name": "Mì Ý sốt thịt bằm cổ điển",
    "price": 42.0,
"restaurant": "Quán mì Ý góc phố",
"category": "Đồ ăn",
    "imagePrompt": "A bowl of classic Italian bolognese pasta, food photography, close-up, delicious and appetizing, garnished with basil leaves, high detail"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 0.8,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);
    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    let foundFoods;
    try {
      foundFoods = JSON.parse(
        rawContent.replace(/^```json\s*|```$/g, "").trim(),
      );
    } catch (e) {
      throw new Error("JSON do AI trả về sai định dạng.");
    }

    if (Array.isArray(foundFoods) && foundFoods.length > 0) {
      const foodsToSave = foundFoods.map((food) => ({ ...food, imageUrl: "" }));
      await db.elemeFoods.bulkAdd(foodsToSave);
      await renderElemeFoods(); // 刷新列表
      await showCustomAlert(
        "Tìm kiếm thành công!",
        `Đã thêm ${foundFoods.length} món AI tìm được vào danh sách!`,
      );
    } else {
      throw new Error("AI không tìm thấy món nào liên quan.");
    }
  } catch (error) {
    console.error("AI搜索饿了么商品失败:", error);
    await showCustomAlert("Tìm kiếm thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 打开美食编辑器（支持添加和编辑）
 * @param {number|null} foodId - 如果是编辑模式，传入美食ID；否则为null
 */
async function openFoodEditor(foodId = null) {
  currentEditingFoodId = foodId; // 保存正在编辑的美食ID
  const modal = document.getElementById("product-editor-modal");
  const titleEl = document.getElementById("product-editor-title");

  // 调整UI和填充数据
  document.getElementById("product-category-input").placeholder =
    "Tên cửa hàng (không bắt buộc)";
  // 确保保存按钮的事件指向美食保存函数
  const saveBtn = document.getElementById("save-product-btn");
  const newSaveBtn = saveBtn.cloneNode(true); // 克隆以清除旧事件
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener("click", saveFoodItem);

  if (foodId) {
    // 编辑模式
    titleEl.textContent = "Sửa món ăn";
    const food = await db.elemeFoods.get(foodId);
    if (food) {
      document.getElementById("product-name-input").value = food.name;
      document.getElementById("product-price-input").value = food.price;
      document.getElementById("product-image-input").value = food.imageUrl;
      document.getElementById("product-category-input").value =
        food.restaurant || "";
    }
  } else {
    // 添加模式
    titleEl.textContent = "Thêm món ăn thủ công";
    // 清空输入框
    document.getElementById("product-name-input").value = "";
    document.getElementById("product-price-input").value = "";
    document.getElementById("product-image-input").value = "";
    document.getElementById("product-category-input").value = "";
  }

  modal.classList.add("visible");
}

/**
 * 保存手动添加或编辑的美食
 */
async function saveFoodItem() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const restaurant = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Vui lòng điền tên món và giá hợp lệ!");
    return;
  }

  // 如果用户没有提供图片链接，则留空，让渲染器去触发AI生图
  if (!imageUrl) {
    imageUrl = "";
  }

  const foodData = {
    name,
    price,
    imageUrl,
    restaurant: restaurant || "Bếp nhà làm",
  };

  try {
    if (currentEditingFoodId) {
      // 更新模式
      await db.elemeFoods.update(currentEditingFoodId, foodData);
      await showCustomAlert("Lưu thành công", "Đã cập nhật thông tin món ăn!");
    } else {
      // 添加模式
      await db.elemeFoods.add(foodData);
      await showCustomAlert("Thêm thành công", "Đã thêm món ăn mới!");
    }

    // 操作完成后关闭弹窗并刷新列表
    document.getElementById("product-editor-modal").classList.remove("visible");
    await renderElemeFoods();
  } catch (error) {
    console.error("保存美食失败:", error);
    await showCustomAlert("Lưu thất bại", `Có lỗi: ${error.message}`);
  } finally {
    currentEditingFoodId = null; // 无论成功失败，都重置编辑ID
  }
}

/**
 * 核心函数：处理用户点击“给Ta点单”的完整流程
 * @param {number} foodId - 被点击的美食的ID
 */
async function handleOrderForChar(foodId) {
  const food = await db.elemeFoods.get(foodId);
  if (!food) return;

  // 1. 检查用户余额
  if ((state.globalSettings.userBalance || 0) < food.price) {
    alert("Số dư của bạn không đủ, không thể đặt cho người ấy!");
    return;
  }

  // 2. 打开角色选择器，让用户选择为谁点单
  const targetCharId = await openCharSelectorForEleme();
  if (!targetCharId) return; // 如果用户取消了选择，则结束流程

  const char = state.chats[targetCharId];
  if (!char) return;

  // 3. 弹出最终确认框
  const confirmed = await showCustomConfirm(
    "Xác nhận đặt món",
    `Bạn có chắc muốn bỏ ¥${food.price.toFixed(2)} đặt một phần "${food.name}" cho "${char.name}"?`,
    { confirmText: "Đặt ngay" },
  );

  if (confirmed) {
    const remark = await showCustomPrompt(
      "Ghi chú đơn hàng (tùy chọn)",
      "Có gì muốn nói với shipper hoặc cửa hàng không?",
      "Giao hàng không tiếp xúc, cảm ơn!", // 这是一个友好的默认值
    );
    // 如果用户点了取消，remark会是null，但不影响流程

    await showCustomAlert("Vui lòng chờ...", `Đang đặt món cho "${char.name}"...`);

    // 4. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -food.price,
      `Đặt đồ ăn cho ${char.name}: ${food.name}`,
    );

    // 5. 创建外卖订单记录
    await db.elemeOrders.add({
      foodId: foodId,
      quantity: 1,
      timestamp: Date.now(),
      status: "Đã đặt",
      recipientId: targetCharId,
    });

    await sendElemeOrderNotificationToChar(targetCharId, food, remark);

    await showCustomAlert(
      "Đặt thành công!",
      `Đã đặt đồ ăn cho "${char.name}", và đã nhắn tin riêng báo cho người ấy rồi!`,
    );
    renderChatList();
  }
}

/**
 * 辅助函数：打开一个单选的角色选择器
 * @returns {Promise<string|null>} - 返回选中的角色ID，如果取消则返回null
 */
async function openCharSelectorForEleme() {
  return new Promise((resolve) => {
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "Đặt cho ai đây?";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("Bạn chưa có người bạn nào để đặt món cả.");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="eleme-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="eleme-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("Vui lòng chọn người nhận đơn!");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 发送外卖订单通知到指定角色的聊天
 */
async function sendElemeOrderNotificationToChar(targetChatId, food, remark) {
  const chat = state.chats[targetChatId];
  if (!chat) return;

  // 准备给AI看的文本，现在包含了备注信息
  const textContentForAI = `[Thông báo hệ thống: người dùng đã đặt cho bạn một phần "${food.name}" từ "${food.restaurant}", và ghi chú: "${remark || "Không"}". Hãy dựa vào thiết lập nhân vật để phản hồi việc này.]`;

  // 准备要渲染成卡片的数据 (payload)
  const notificationPayload = {
    foodName: food.name,
    foodImageUrl: food.imageUrl,
    senderName: state.qzoneSettings.nickname || "Tôi",
    remark: remark || "", // 将备注保存到payload中
  };

  // 创建消息对象
  const notificationMessage = {
    role: "user", // 由用户发出
    type: "eleme_order_notification",
    timestamp: Date.now(),
    // content 字段现在用于AI理解上下文，而不是UI渲染
    content: `Tôi đặt cho bạn một phần đồ ăn rồi: ${food.name} `,
    payload: notificationPayload,
  };
  chat.history.push(notificationMessage);

  // 创建给AI看的隐藏指令
  const hiddenMessage = {
    role: "system",
    content: textContentForAI,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  chat.unreadCount = (chat.unreadCount || 0) + 1;
  await db.chats.put(chat);

  if (state.activeChatId !== targetChatId) {
    showNotification(targetChatId, "Bạn đã nhận được một phần đồ ăn!");
  }

  // 主动触发AI回应
  openChat(targetChatId);
}

function switchTaobaoView(viewId) {
  document
    .querySelectorAll(".taobao-view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");

  document.querySelectorAll(".taobao-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === viewId);
  });

  if (viewId === "orders-view") {
    renderTaobaoOrders();
  } else if (viewId === "my-view") {
    renderBalanceDetails();
  } else if (viewId === "cart-view") {
    renderTaobaoCart();
  } else if (viewId === "eleme-view") {
    // <-- 新增的判断
    renderElemeFoods();
  }
}

/**
 * 渲染购物车页面
 */
async function renderTaobaoCart() {
  const listEl = document.getElementById("cart-item-list");
  const checkoutBar = document.getElementById("cart-checkout-bar");
  listEl.innerHTML = "";

  const cartItems = await db.taobaoCart.toArray();

  if (cartItems.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Giỏ hàng trống trơn~</p>';
    checkoutBar.style.display = "none";
    updateCartBadge(0);
    return;
  }

  checkoutBar.style.display = "flex";
  let totalPrice = 0;
  let totalItems = 0;

  for (const item of cartItems) {
    const product = await db.taobaoProducts.get(item.productId);
    if (!product) continue;

    totalItems += item.quantity;
    totalPrice += product.price * item.quantity;

    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
            <img src="${product.imageUrl}" class="product-image" data-product-id="${product.id}">
            <div class="cart-item-info" data-product-id="${product.id}">
                <div class="product-name">${product.name}</div>
                <div class="product-price">¥${product.price.toFixed(2)}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-decrease" data-cart-id="${item.id}" ${
                  item.quantity <= 1 ? "disabled" : ""
                }>-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-increase" data-cart-id="${item.id}">+</button>
            </div>
            <button class="delete-cart-item-btn" data-cart-id="${item.id}">×</button>
        `;
    listEl.appendChild(itemEl);
  }

  document.getElementById("cart-total-price").textContent =
    `¥ ${totalPrice.toFixed(2)}`;
  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.textContent = `Thanh toán(${totalItems})`;
  checkoutBtn.dataset.totalPrice = totalPrice; // 把总价存起来，方便结算时用

  updateCartBadge(totalItems);
}

/**
 * 更新购物车图标上的角标数量
 */
function updateCartBadge() {
  const badge = document.getElementById("cart-item-count-badge");
  db.taobaoCart.toArray().then((items) => {
    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalCount > 0) {
      badge.textContent = totalCount > 99 ? "99+" : totalCount;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  });
}

/**
 * 处理加入购物车的逻辑
 */
async function handleAddToCart(productId) {
  const existingItem = await db.taobaoCart
    .where("productId")
    .equals(productId)
    .first();
  if (existingItem) {
    // 如果已存在，则数量+1
    await db.taobaoCart.update(existingItem.id, {
      quantity: existingItem.quantity + 1,
    });
  } else {
    // 如果不存在，则新增
    await db.taobaoCart.add({ productId: productId, quantity: 1 });
  }
  await showCustomAlert("Thành công", "Đã thêm sản phẩm vào giỏ hàng!");
  updateCartBadge(); // 更新角标
}

/**
 * 处理购物车内商品数量的变化
 */
async function handleChangeCartItemQuantity(cartId, change) {
  const item = await db.taobaoCart.get(cartId);
  if (!item) return;

  const newQuantity = item.quantity + change;
  if (newQuantity <= 0) {
    // 如果数量减到0，就删除该项
    await handleRemoveFromCart(cartId);
  } else {
    await db.taobaoCart.update(cartId, { quantity: newQuantity });
    await renderTaobaoCart();
  }
}

/**
 * 从购物车中移除商品
 */
async function handleRemoveFromCart(cartId) {
  await db.taobaoCart.delete(cartId);
  await renderTaobaoCart();
}

/**
 * 打开商品详情弹窗
 */
async function openProductDetail(productId) {
  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const modal = document.getElementById("product-detail-modal");
  const bodyEl = document.getElementById("product-detail-body");
  const reviewsSection = document.getElementById("product-reviews-section");
  const reviewsListEl = document.getElementById("product-reviews-list");
  const generateBtn = document.getElementById("generate-reviews-btn");
  const actionBtn = document.getElementById("detail-add-to-cart-btn");

  // 强制重置UI状态
  // 无论上次是什么状态，都确保评价区是可见的
  reviewsSection.style.display = "block";

  // 渲染商品基本信息
  bodyEl.innerHTML = `
        <img src="${product.imageUrl}" class="product-image" alt="${product.name}">
        <h2 class="product-name">${product.name}</h2>
        <p class="product-price">${product.price.toFixed(2)}</p>
<p style="color: #888; font-size: 13px;">Cửa hàng: ${product.store || "Đào Bảo tự doanh"}</p>
    `;

  // 渲染评价区域
  reviewsListEl.innerHTML = "";
  if (product.reviews && product.reviews.length > 0) {
    product.reviews.forEach((review) => {
      const reviewEl = document.createElement("div");
      reviewEl.className = "product-review-item";
      reviewEl.innerHTML = `
                <div class="review-author">${review.author}</div>
                <p>${review.text}</p>
            `;
      reviewsListEl.appendChild(reviewEl);
    });
    generateBtn.style.display = "none";
  } else {
    reviewsListEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); font-size: 13px;">Chưa có ai đánh giá~</p>';
    generateBtn.style.display = "block";
  }

  // 重新绑定“生成评价”按钮的事件 (防止重复绑定)
  const newGenerateBtn = generateBtn.cloneNode(true);
  generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
  newGenerateBtn.addEventListener("click", () =>
    generateProductReviews(productId),
  );

  // 强制重置按钮并重新绑定事件
  // 先克隆按钮以清除旧事件监听器
  const newAddToCartBtn = actionBtn.cloneNode(true);

  newAddToCartBtn.textContent = "Thêm vào giỏ hàng";
  // 为新按钮绑定正确的“加入购物车”逻辑
  newAddToCartBtn.onclick = async () => {
    await handleAddToCart(productId);
    modal.classList.remove("visible"); // 添加后自动关闭弹窗
  };
  actionBtn.parentNode.replaceChild(newAddToCartBtn, actionBtn);

  // 绑定关闭按钮
  document.getElementById("close-product-detail-btn").onclick = () =>
    modal.classList.remove("visible");

  // 最后，显示弹窗
  modal.classList.add("visible");
}

/**
 * 为指定商品生成评价
 * @param {number} productId - 商品的ID
 */
async function generateProductReviews(productId) {
  await showCustomAlert("Vui lòng chờ...", "Đang triệu tập đội quân review của người mua...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const prompt = `
# Nhiệm vụ
Bạn là trình tạo đánh giá thương mại điện tử chuyên nghiệp. Hãy tạo 3-5 đánh giá mô phỏng của người mua với phong cách khác nhau cho sản phẩm dưới đây, viết bằng tiếng Việt.

# Thông tin sản phẩm
- Tên: ${product.name}
- Giá: ${product.price} tệ
- Phân loại: ${product.category || "Chưa phân loại"}

# Quy tắc cốt lõi
1.  **Phong cách đa dạng**: Các đánh giá nên gồm nhiều phong cách khác nhau, ví dụ:
-   **Khen**: khen chi tiết một ưu điểm của sản phẩm.
-   **Trung bình/đánh giá bổ sung**: mô tả cảm nhận sau một thời gian dùng, có thể nhắc vài khuyết điểm nhỏ.
-   **Chê**: cà khịa một nhược điểm của sản phẩm, nhưng giọng phải như người mua thật.
-   **Bình luận hài**: viết vài đánh giá hài hước dí dỏm.
-   **Bình luận ngắn gọn**: ví dụ "Tốt", "Tạm được", "Giao hàng nhanh".
2.  **Biệt danh chân thật**: Biệt danh tác giả đánh giá ("author") phải ngẫu nhiên, đời thường, đúng thói quen người dùng ứng dụng mua sắm. Ví dụ: "Người dùng ẩn danh", "Bé Vương không ăn rau mùi", "Tín đồ coca".
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một đánh giá, và gồm hai trường "author" và "text".

# Ví dụ định dạng đầu ra JSON:
[
{ "author": "Người dùng ẩn danh", "text": "Giao hàng nhanh, đóng gói kỹ, sản phẩm giống mô tả, 5 sao!" },
{ "author": "Là bé Trương nè", "text": "Hơi lệch màu, nhưng vẫn chấp nhận được. Dùng thử đã, ít bữa nữa quay lại đánh giá tiếp." }
]
`;
  try {
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
            temperature: parseFloat(state.apiConfig.temperature) || 1.0,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newReviews = JSON.parse(cleanedContent);

    if (Array.isArray(newReviews) && newReviews.length > 0) {
      // 将AI生成的评价保存到商品数据中
      await db.taobaoProducts.update(productId, { reviews: newReviews });
      await showCustomAlert(
        "Tạo thành công!",
        `Đã tạo thành công ${newReviews.length} đánh giá.`,
      );
      // 重新打开详情页，刷新显示
      await openProductDetail(productId);
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng.");
    }
  } catch (error) {
    console.error("生成商品评价失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 结算购物车
 */
async function handleCheckout() {
  const checkoutBtn = document.getElementById("checkout-btn");
  const totalPrice = parseFloat(checkoutBtn.dataset.totalPrice);

  if (totalPrice <= 0) return;

  const currentBalance = state.globalSettings.userBalance || 0;
  if (currentBalance < totalPrice) {
    alert("Số dư không đủ! Hãy vào trang \"Tôi\" để nạp tiền trước.");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận thanh toán",
    `Lần này sẽ tốn ¥${totalPrice.toFixed(2)}, bạn có chắc muốn thanh toán?`,
    {
      confirmText: "Thanh toán ngay",
    },
  );

  if (confirmed) {
    const cartItems = await db.taobaoCart.toArray();
    const productPromises = cartItems.map((item) =>
      db.taobaoProducts.get(item.productId),
    );
    const productsInCart = await Promise.all(productPromises);
    const validProducts = productsInCart.filter(Boolean);

    let description = "Sản phẩm đã mua: ";
    const itemNames = validProducts.map((p) => `“${p.name}”`);
    if (itemNames.length > 2) {
      description +=
        itemNames.slice(0, 2).join("、") + ` và ${itemNames.length} sản phẩm khác`;
    } else {
      description += itemNames.join("、");
    }

    await updateUserBalanceAndLogTransaction(-totalPrice, description);

    // 为每个订单创建物流历史起点
    const newOrders = cartItems.map((item, index) => ({
      productId: item.productId,
      quantity: item.quantity,
      timestamp: Date.now() + index, // 订单创建时间
      status: "Đã thanh toán, chờ giao hàng",
      // 我们不再需要在数据库里存 logisticsHistory，因为它是动态模拟的
    }));

    await db.taobaoOrders.bulkAdd(newOrders);
    await db.taobaoCart.clear();
    await renderTaobaoCart();

    alert("Thanh toán thành công! Sản phẩm đang được đóng gói thần tốc~");
    switchTaobaoView("orders-view");
  }
}

/**
 * 渲染商品列表，按需生成并永久保存图片
 */
async function renderTaobaoProducts(category = null) {
  const gridEl = document.getElementById("product-grid");
  gridEl.innerHTML = "";

  const allProducts = await db.taobaoProducts.orderBy("name").toArray();
  const categories = [
    ...new Set(allProducts.map((p) => p.category).filter(Boolean)),
  ];

  const productsToRender = category
    ? allProducts.filter((p) => p.category === category)
    : allProducts;

  if (productsToRender.length === 0) {
    gridEl.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Chưa có sản phẩm nào, bấm "+" ở góc trên bên phải để thêm nhé!</p>';
    return;
  }

  productsToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.productId = product.id;

    card.innerHTML = `
        <div class="product-image-container">
<!-- ảnh hoặc hoạt ảnh đang tải sẽ ở đây -->
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}</div>
        </div>
    `;

    const imageContainer = card.querySelector(".product-image-container");

    if (product.imageUrl) {
      imageContainer.innerHTML = `<img src="${product.imageUrl}" class="product-image" alt="${product.name}">`;
    } else {
      imageContainer.innerHTML = `<div class="loading-spinner"></div>`;
      imageGenerationQueue.push({ type: "taobao", item: product });
    }

    addLongPressListener(card, () => showProductActions(product.id));
    gridEl.appendChild(card);
  });

  // 渲染完所有卡片后，触发一次队列处理器
  processImageQueue();
}

/**
 * 渲染“我的订单”列表
 */
async function renderTaobaoOrders() {
  const listEl = document.getElementById("order-list");
  listEl.innerHTML = "";
  const orders = await db.taobaoOrders.reverse().sortBy("timestamp");

  if (orders.length === 0) {
    listEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary);">Chưa có đơn hàng nào</p>';
    return;
  }

  for (const order of orders) {
    const product = await db.taobaoProducts.get(order.productId);
    if (!product) continue;

    const item = document.createElement("div");
    item.className = "order-item";
    item.dataset.orderId = order.id;
    item.innerHTML = `
            <img src="${product.imageUrl}" class="product-image">
            <div class="order-info">
                <div class="product-name">${product.name}</div>
                <div class="order-status">${order.status}</div>
                <div class="order-time">${new Date(order.timestamp).toLocaleString()}</div>
            </div>
        `;
    listEl.appendChild(item);
  }
}

/**
 * 渲染“我的”页面的余额
 */
function renderTaobaoBalance() {
  const balance = state.globalSettings.userBalance || 0;
  document.getElementById("user-balance-display").textContent =
    `¥ ${balance.toFixed(2)}`;
}

/**
 * 打开添加商品的方式选择弹窗
 */
function openAddProductChoiceModal() {
  document.getElementById("add-product-choice-modal").classList.add("visible");
}

/**
 * 打开手动添加/编辑商品的弹窗
 */
function openProductEditor(productId = null) {
  currentEditingProductId = productId;
  const modal = document.getElementById("product-editor-modal");
  const titleEl = document.getElementById("product-editor-title");

  // 1. 恢复输入框默认提示 (因为饿了么可能会改它)
  document.getElementById("product-category-input").placeholder =
    "Ví dụ: quần áo, đồ ăn vặt...";

  // 2. ★★★ 核心修复：重新绑定保存按钮 ★★★
  // 使用克隆大法清除之前可能绑定的“饿了么”保存事件或重复的“桃宝”保存事件
  const saveBtn = document.getElementById("save-product-btn");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  // 绑定专属的桃宝保存函数
  newSaveBtn.addEventListener("click", saveProduct);

  if (productId) {
    titleEl.textContent = "Sửa sản phẩm";
    // (异步) 加载现有商品数据
    db.taobaoProducts.get(productId).then((product) => {
      if (product) {
        document.getElementById("product-name-input").value = product.name;
        document.getElementById("product-price-input").value = product.price;
        document.getElementById("product-image-input").value = product.imageUrl;
        document.getElementById("product-category-input").value =
          product.category || "";
      }
    });
  } else {
    titleEl.textContent = "Thêm sản phẩm mới";
    // 清空输入框
    document.getElementById("product-name-input").value = "";
    document.getElementById("product-price-input").value = "";
    document.getElementById("product-image-input").value = "";
    document.getElementById("product-category-input").value = "";
  }
  modal.classList.add("visible");
}

/**
 * 保存手动添加或编辑的商品
 */
async function saveProduct() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const category = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Vui lòng điền mọi mục bắt buộc (tên, giá hợp lệ)!");
    return;
  }

  // 如果用户没有提供图片链接，保存一个空字符串。
  // 新的渲染逻辑会自动检测到空链接并触发AI生图。
  if (!imageUrl) {
    imageUrl = ""; // 设置为空，让渲染器去处理
  }

  const productData = { name, price, imageUrl, category };

  if (currentEditingProductId) {
    await db.taobaoProducts.update(currentEditingProductId, productData);
    alert("Đã cập nhật sản phẩm!");
  } else {
    await db.taobaoProducts.add(productData);
    alert("Đã thêm sản phẩm mới!");
  }

  document.getElementById("product-editor-modal").classList.remove("visible");
  await renderTaobaoProducts();
  currentEditingProductId = null;
}

/**
 * 保存手动添加的美食
 */
async function saveFoodItem() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const restaurant = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Vui lòng điền tên món và giá hợp lệ!");
    return;
  }

  // 如果用户没有提供图片链接，保存一个空字符串。
  // 这样新的渲染逻辑就会自动检测到并触发AI生图。
  if (!imageUrl) {
    imageUrl = ""; // 设置为空，让渲染器去处理
  }
  // ★★★ 修改结束 ★★★

  const foodData = {
    name,
    price,
    imageUrl,
    restaurant: restaurant || "Bếp nhà làm",
  };

  await db.elemeFoods.add(foodData);
  alert("Đã thêm món ăn mới!");

  document.getElementById("product-editor-modal").classList.remove("visible");
  await renderElemeFoods();
}

/**
 * 打开识别链接的弹窗
 */
function openAddFromLinkModal() {
  document.getElementById("link-paste-area").value = "";
  document.getElementById("add-from-link-modal").classList.add("visible");
}

/**
 * 处理粘贴的分享文案
 */
async function handleAddFromLink() {
  const text = document.getElementById("link-paste-area").value;
  const nameMatch = text.match(/「(.+?)」/);

  if (!nameMatch || !nameMatch[1]) {
    alert("Không nhận diện được tên sản phẩm! Hãy đảm bảo đã dán đoạn văn chia sẻ đầy đủ có chứa 「tên sản phẩm」.");
    return;
  }

  const name = nameMatch[1];
  document.getElementById("add-from-link-modal").classList.remove("visible");

  const priceStr = await showCustomPrompt(
    `Sản phẩm: ${name}`,
    "Nhập giá (tệ):",
    "",
    "number",
  );
  if (priceStr === null) return;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    alert("Vui lòng nhập giá hợp lệ!");
    return;
  }

  let imageUrl = await showCustomPrompt(
    `Sản phẩm: ${name}`,
    "Nhập link ảnh (URL, tùy chọn, để trống thì AI sẽ tạo):",
  );
  if (imageUrl === null) return;

  // 1. 如果用户没有输入图片链接
  if (!imageUrl || !imageUrl.trim()) {
    try {
      // 就调用我们的AI生图函数
      imageUrl = await generateImageForProduct(name);
    } catch (e) {
      console.error("调用生图函数时发生意外错误:", e);
      imageUrl = getRandomDefaultProductImage();
    }
  }

  const category = await showCustomPrompt(
    `Sản phẩm: ${name}`,
    "Nhập phân loại (tùy chọn):",
  );

  await db.taobaoProducts.add({
    name,
    price,
    imageUrl,
    category: category || "",
  });
  await renderTaobaoProducts();
  alert("Đã thêm sản phẩm qua liên kết thành công!");
}

/**
 * 根据用户搜索触发AI生成商品
 */
async function handleSearchProductsAI() {
  const searchTerm = productSearchInput.value.trim();
  if (!searchTerm) {
    alert("Vui lòng nhập sản phẩm bạn muốn tìm!");
    return;
  }

  await showCustomAlert(
    "Vui lòng chờ...",
    `AI đang tìm cảm hứng cho bạn về "${searchTerm}"...`,
  );
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const prompt = `
# Nhiệm vụ
Bạn là công cụ tìm kiếm của ứng dụng mua sắm ảo "Đào Bảo". Hãy dựa vào 【từ khóa tìm kiếm】 người dùng cung cấp, tạo cho người đó một danh sách gồm 5-8 sản phẩm liên quan. Viết tên và phân loại bằng tiếng Việt.

# Từ khóa người dùng tìm:
"${searchTerm}"

# Quy tắc cốt lõi
1.  **Liên quan cao**: Mọi sản phẩm đều phải liên quan chặt chẽ tới từ khóa tìm kiếm "${searchTerm}" của người dùng.
2.  **Đa dạng sản phẩm**: Dù cùng một chủ đề, cũng cố gắng thể hiện sản phẩm với kiểu dáng, chức năng hoặc góc độ khác nhau.
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một sản phẩm, 【bắt buộc】 gồm các trường sau:
-   \`"name"\`: tên sản phẩm
-   \`"price"\`: giá (số)
-   \`"category"\`: phân loại sản phẩm
-   \`"imagePrompt"\`: một 【prompt tiếng Anh】 chi tiết cho AI tạo ảnh từ chữ, mô tả 【ảnh trưng bày sản phẩm (product shot)】 này. Yêu cầu phong cách 【sạch sẽ, tối giản, nền đơn sắc hoặc chuyển màu (clean, minimalist, solid color background)】.

# Ví dụ định dạng đầu ra JSON:
[
  {
"name": "Dây sạc phát sáng phong cách Cyberpunk",
    "price": 69.9,
"category": "Phụ kiện kỹ thuật số",
    "imagePrompt": "A glowing cyberpunk style data cable, product shot, on a dark tech background, neon lights, high detail"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];

    // 恢复对 Gemini 和 OpenAI 的兼容判断逻辑
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 0.8,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newProducts = JSON.parse(cleanedContent);

    if (Array.isArray(newProducts) && newProducts.length > 0) {
      displayAiGeneratedProducts(
        newProducts,
        `AI đã tìm cho bạn các sản phẩm về "${searchTerm}"`,
      );
    } else {
      throw new Error("AI không tìm thấy món nào liên quan.");
    }
  } catch (error) {
    console.error("AI搜索商品失败:", error);
    await showCustomAlert("Tìm kiếm thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * UI函数：在弹窗中显示AI生成的商品列表，并异步加载图片
 * @param {Array} products - AI生成的商品对象数组
 * @param {string} title - 弹窗的标题
 */
function displayAiGeneratedProducts(products, title) {
  const modal = document.getElementById("ai-generated-products-modal");
  const titleEl = document.getElementById("ai-products-modal-title");
  const gridEl = document.getElementById("ai-product-results-grid");

  titleEl.textContent = title;
  gridEl.innerHTML = "";

  products.forEach((product, index) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.id = `ai-product-${index}`;

    // 在放入HTML属性前，先对JSON字符串进行转义，防止引号冲突
    // 1. 将商品对象转换为JSON字符串
    const productJsonString = JSON.stringify(product);
    // 2. 将字符串中的单引号替换为HTML实体编码
    const safeProductJsonString = productJsonString.replace(/'/g, "&#39;");

    card.innerHTML = `
        <div class="product-image-container">
            <div class="loading-spinner"></div>
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}</div>
        </div>
<button class="add-to-my-page-btn" data-product='${safeProductJsonString}'>+ Thêm vào Đào Bảo của tôi</button>
    `;
    gridEl.appendChild(card);

    // 调用异步函数加载图片
    // 这个函数会在后台默默生图，成功后再更新这张卡片
    loadAndDisplayAiProductImage(product, card);
  });

  modal.classList.add("visible");
}

/**
 * 为AI生成的单个商品卡片加载图片
 * @param {object} productData - 商品数据，包含 imagePrompt
 * @param {HTMLElement} cardElement - 对应的商品卡片DOM元素
 */
async function loadAndDisplayAiProductImage(productData, cardElement) {
  const imageContainer = cardElement.querySelector(".product-image-container");
  if (!imageContainer) return;

  try {
    // 1. 调用全局统一的生图函数
    const imageUrl = await window.generatePollinationsImage(
      productData.imagePrompt,
      {
        width: 1024,
        height: 1024,
        model: "flux",
        nologo: true,
      },
    );

    // 2. 将生成好的图片URL【回写】到商品数据中，方便“添加到主页”时使用
    productData.imageUrl = imageUrl;
    const addButton = cardElement.querySelector(".add-to-my-page-btn");
    if (addButton) {
      addButton.dataset.product = JSON.stringify(productData);
    }

    // 3. 更新卡片UI，用生成的图片替换掉加载动画
    //    再次检查卡片是否还存在于页面上，防止用户过早关闭弹窗导致错误
    if (document.body.contains(imageContainer)) {
      imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${productData.name}">`;
    }
  } catch (error) {
    // 理论上，因为 generateAndLoadImage 是无限重试，这里很难被触发
    // 但为了代码健壮性，我们仍然处理这个万一
    console.error(`为商品 "${productData.name}" 生成图片失败:`, error);
    if (document.body.contains(imageContainer)) {
      imageContainer.innerHTML = `<span>Tải ảnh thất bại</span>`;
    }
  }
}

/**
 * 触发AI【随机】生成商品，并在弹窗中显示
 */
async function handleGenerateProductsAI() {
  await showCustomAlert("Vui lòng chờ...", "Đang yêu cầu AI tạo một loạt sản phẩm thú vị...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Vui lòng cấu hình API trước!");
    return;
  }

  const prompt = `
# Nhiệm vụ
Bạn là người lên kế hoạch sản phẩm của ứng dụng mua sắm ảo "Đào Bảo". Hãy sáng tác một danh sách gồm 5-8 sản phẩm. Viết tên và phân loại bằng tiếng Việt.

# Quy tắc cốt lõi
1.  **Đa dạng sản phẩm**: Sản phẩm phải thú vị, đa dạng, có thể gồm quần áo, đồ ăn vặt, đồ gia dụng, vật phẩm ảo...
2.  **Phân loại rõ ràng**: Đặt một phân loại hợp lý cho mỗi sản phẩm.
3.  **Quy tắc sắt về định dạng**: Câu trả lời của bạn 【bắt buộc và chỉ được】 là một mảng JSON nghiêm ngặt, mỗi đối tượng đại diện cho một sản phẩm, 【bắt buộc】 gồm các trường sau:
-   \`"name"\`: tên sản phẩm (chuỗi)
-   \`"price"\`: giá (số)
-   \`"category"\`: phân loại sản phẩm (chuỗi)
-   \`"imagePrompt"\`: một 【prompt tiếng Anh】 chi tiết cho AI tạo ảnh từ chữ, mô tả 【ảnh trưng bày sản phẩm (product shot)】 này. Yêu cầu phong cách 【sạch sẽ, tối giản, nền đơn sắc hoặc chuyển màu (clean, minimalist, solid color background)】.

# Ví dụ định dạng đầu ra JSON:
[
  {
"name": "Đèn ngủ hình nấm phát sáng",
    "price": 49.9,
"category": "Đồ gia dụng",
    "imagePrompt": "A glowing mushroom-shaped night light, minimalist, product shot, studio lighting, simple gradient background, high detail, photorealistic"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];

    // 恢复对 Gemini 和 OpenAI 的兼容判断逻辑
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 1.1,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);

    if (!response.ok) throw new Error(`Yêu cầu API thất bại: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newProducts = JSON.parse(cleanedContent);

    if (Array.isArray(newProducts) && newProducts.length > 0) {
      displayAiGeneratedProducts(newProducts, "AI đã tạo ngẫu nhiên các sản phẩm sau");
    } else {
      throw new Error("Dữ liệu AI trả về sai định dạng.");
    }
  } catch (error) {
    console.error("AI生成商品失败:", error);
    await showCustomAlert("Tạo thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 处理用户点击商品卡片的逻辑（购买）
 */
async function handleBuyProduct(productId) {
  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const currentBalance = state.globalSettings.userBalance || 0;
  if (currentBalance < product.price) {
    alert("Số dư không đủ, vào trang \"Tôi\" nạp tiền trước nhé!");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận mua",
    `Bạn có chắc muốn bỏ ¥${product.price.toFixed(2)} để mua "${product.name}"?`,
    { confirmText: "Thanh toán ngay" },
  );

  if (confirmed) {
    // 1. 扣除余额
    state.globalSettings.userBalance -= product.price;
    await db.globalSettings.put(state.globalSettings);

    // 2. 创建订单
    const newOrder = {
      productId: productId,
      timestamp: Date.now(),
      status: "Đã thanh toán, chờ giao hàng",
    };
    await db.taobaoOrders.add(newOrder);

    // 模拟物流更新
    setTimeout(async () => {
      const orderToUpdate = await db.taobaoOrders
        .where({ timestamp: newOrder.timestamp })
        .first();
      if (orderToUpdate) {
        await db.taobaoOrders.update(orderToUpdate.id, {
          status: "Đã giao cho vận chuyển, đang trên đường",
        });
      }
    }, 1000 * 10); // 10秒后更新为已发货

    alert("Mua thành công! Bạn có thể xem thông tin vận chuyển trong \"Đơn hàng của tôi\".");
    renderTaobaoBalance(); // 刷新余额显示
  }
}

/**
 * 长按商品时显示操作菜单
 */
async function showProductActions(productId) {
  const choice = await showChoiceModal("Thao tác sản phẩm", [
    { text: "✏️ Sửa sản phẩm", value: "edit" },
    { text: "🗑️ Xóa sản phẩm", value: "delete" },
  ]);

  if (choice === "edit") {
    openProductEditor(productId);
  } else if (choice === "delete") {
    const product = await db.taobaoProducts.get(productId);
    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa sản phẩm "${product.name}"?`,
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      await db.taobaoProducts.delete(productId);
      await renderTaobaoProducts();
      alert("Đã xóa sản phẩm.");
    }
  }
}

/**
 * 长按饿了么美食时显示操作菜单
 * @param {number} foodId - 美食的ID
 */
async function showFoodActions(foodId) {
  const choice = await showChoiceModal("Thao tác", [
    { text: "✏️ Sửa", value: "edit" },
    { text: "🗑️ Xóa", value: "delete" },
  ]);

  if (choice === "edit") {
    // 调用我们即将修改的、支持编辑的函数
    openFoodEditor(foodId);
  } else if (choice === "delete") {
    const food = await db.elemeFoods.get(foodId);
    if (!food) return;
    const confirmed = await showCustomConfirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa "${food.name}"?`,
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      await db.elemeFoods.delete(foodId);
      await renderElemeFoods(); // 重新渲染列表
      await showCustomAlert("Xóa thành công", "Đã gỡ món ăn này khỏi danh sách.");
    }
  }
}

/**
 * 核心函数：更新用户余额并记录一笔交易
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述 (例如: "转账给 XX", "收到 XX 的红包")
 */
async function updateUserBalanceAndLogTransaction(amount, description) {
  if (isNaN(amount)) return; // 安全检查

  // 确保余额是数字
  state.globalSettings.userBalance =
    (state.globalSettings.userBalance || 0) + amount;

  const newTransaction = {
    type: amount > 0 ? "income" : "expense",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 使用数据库事务，确保两步操作要么都成功，要么都失败
  await db.transaction(
    "rw",
    db.globalSettings,
    db.userWalletTransactions,
    async () => {
      await db.globalSettings.put(state.globalSettings);
      await db.userWalletTransactions.add(newTransaction);
    },
  );

  console.log(
    `用户钱包已更新: 金额=${amount.toFixed(2)}, 新余额=${state.globalSettings.userBalance.toFixed(2)}`,
  );
}
/**
 * 处理删除单条交易记录（收入或支出）
 * @param {number} transactionId - 要删除的交易记录的ID
 */
async function handleDeleteTransaction(transactionId) {
  // 1. 在弹出确认框之前，先从数据库获取这条记录的详细信息
  const transaction = await db.userWalletTransactions.get(transactionId);
  if (!transaction) {
    await showCustomAlert("Lỗi", "Không tìm thấy giao dịch này, có thể đã bị xóa.");
    return;
  }

  // 根据记录类型，生成动态的、更清晰的提示信息
  const actionText = transaction.type === "income" ? "Trừ tiền" : "hoàn lại";
  const confirmMessage = `Bạn có chắc muốn xóa bản ghi 【${transaction.type === "income" ? "Thu nhập" : "Chi tiêu"}】 này?<br><br>Thao tác này sẽ **${actionText}** <strong>¥${transaction.amount.toFixed(2)}</strong> trong số dư của bạn.`;

  const confirmed = await showCustomConfirm("Xác nhận xóa", confirmMessage, {
    confirmButtonClass: "btn-danger",
  });

  if (!confirmed) {
    return; // 如果用户取消，则不执行任何操作
  }

  try {
    // 2. 使用数据库事务来保证数据安全
    await db.transaction(
      "rw",
      db.globalSettings,
      db.userWalletTransactions,
      async () => {
        // 根据记录类型，决定是加余额还是减余额
        if (transaction.type === "income") {
          // 如果删除的是一笔收入，那么总余额应该减少
          state.globalSettings.userBalance -= transaction.amount;
        } else if (transaction.type === "expense") {
          // 如果删除的是一笔支出，那么总余额应该增加（钱被“退回”了）
          state.globalSettings.userBalance += transaction.amount;
        }

        // 3. 更新全局设置
        await db.globalSettings.put(state.globalSettings);

        // 4. 从交易记录表中删除这条记录
        await db.userWalletTransactions.delete(transactionId);
      },
    );

    // 5. 操作成功后，刷新UI
    await renderBalanceDetails();

    await showCustomAlert("Thao tác thành công", "Đã xóa bản ghi, số dư đã được cập nhật.");
  } catch (error) {
    console.error("删除交易记录时出错:", error);
    await showCustomAlert("Thao tác thất bại", `Có lỗi: ${error.message}`);
  }
}

/**
 * 渲染“我的”页面的余额和交易明细 (支持删除所有记录)
 */
async function renderBalanceDetails() {
  // 1. 渲染当前余额
  const balance = state.globalSettings.userBalance || 0;
  document.getElementById("user-balance-display").textContent =
    `¥ ${balance.toFixed(2)}`;

  // 2. 渲染交易明细列表
  const listEl = document.getElementById("balance-details-list");
  listEl.innerHTML = ""; // 清空旧列表

  const transactions = await db.userWalletTransactions
    .reverse()
    .sortBy("timestamp");

  if (transactions.length === 0) {
    listEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); margin-top: 20px;">Chưa có chi tiết nào</p>';
    return;
  }

  // 给列表加个标题
  listEl.innerHTML =
    '<h3 style="margin-bottom: 10px; color: var(--text-secondary);">Chi tiết số dư</h3>';

  transactions.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "transaction-item";
    const sign = item.type === "income" ? "+" : "-";

    // 移除了 if 判断，现在为每一条记录都生成删除按钮
    const deleteButtonHtml = `<button class="delete-transaction-btn" data-transaction-id="${item.id}">×</button>`;

    itemEl.innerHTML = `
            <div class="transaction-info">
                <div class="description">${item.description}</div>
                <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div class="transaction-amount-wrapper">
                <div class="transaction-amount ${item.type}">
                    ${sign} ${item.amount.toFixed(2)}
                </div>
                ${deleteButtonHtml} 
            </div>
        `;
    listEl.appendChild(itemEl);
  });
}

/**
 * 打开物流详情页面
 * @param {number} orderId - 被点击的订单ID
 */
async function openLogisticsView(orderId) {
  const order = await db.taobaoOrders.get(orderId);
  if (!order) {
    alert("Không tìm thấy đơn hàng này!");
    return;
  }

  // 每次打开都先清空旧的计时器
  logisticsUpdateTimers.forEach((timerId) => clearTimeout(timerId));
  logisticsUpdateTimers = [];

  // 显示物流页面，并开始渲染
  showScreen("logistics-screen");
  await renderLogisticsView(order);
}

/**
 * 渲染物流详情页面的所有内容
 * @param {object} order - 订单对象
 */
async function renderLogisticsView(order) {
  const contentArea = document.getElementById("logistics-content-area");
  contentArea.innerHTML = "Đang tải...";

  const product = await db.taobaoProducts.get(order.productId);
  if (!product) {
    contentArea.innerHTML = "Không tải được thông tin sản phẩm.";
    return;
  }

  // 渲染顶部的商品信息卡片
  contentArea.innerHTML = `
        <div class="logistics-product-summary">
            <img src="${product.imageUrl}" class="product-image">
            <div class="info">
                <div class="name">${product.name} (x${order.quantity})</div>
<div class="status" id="logistics-main-status">Đang tra cứu...</div>
            </div>
        </div>
        <div class="logistics-timeline" id="logistics-timeline-container"></div>
    `;

  const timelineContainer = document.getElementById(
    "logistics-timeline-container",
  );
  const mainStatusEl = document.getElementById("logistics-main-status");
  const creationTime = order.timestamp; // 使用订单的创建时间作为起点

  // 准备一些随机城市名，让物流看起来更真实
  const cities = [
    "Đông Hoản",
    "Quảng Châu",
    "Trường Sa",
    "Vũ Hán",
    "Trịnh Châu",
    "Bắc Kinh",
    "Thượng Hải",
    "Thành Đô",
    "Tây An",
  ];
  const startCity = getRandomItem(cities);
  let nextCity = getRandomItem(cities.filter((c) => c !== startCity));
  const userCity =
    getRandomItem(cities.filter((c) => c !== startCity && c !== nextCity)) ||
    "Thành phố của bạn";

  // --- 这就是模拟物流的核心 ---
  let cumulativeDelay = 0;
  logisticsTimelineTemplate.forEach((stepInfo) => {
    cumulativeDelay += stepInfo.delay;
    const eventTime = creationTime + cumulativeDelay; // 计算出这个步骤“应该”发生的时间
    const now = Date.now();

    // 替换文本中的占位符
    const stepText = stepInfo.text
      .replace(/{city}/g, startCity)
      .replace("{next_city}", nextCity)
      .replace("{user_city}", userCity);

    // 如果这个步骤的发生时间已经过去或就是现在
    if (now >= eventTime) {
      // 就立即把它渲染到页面上
      addLogisticsStep(
        timelineContainer,
        mainStatusEl,
        stepText,
        eventTime,
        true,
      );
    } else {
      // 否则，它就是一个“未来”的步骤
      const delayUntilEvent = eventTime - now; // 计算还有多久才发生
      // 设置一个定时器，在未来的那个时间点执行
      const timerId = setTimeout(() => {
        // 执行前再次检查用户是否还停留在物流页面
        if (
          document
            .getElementById("logistics-screen")
            .classList.contains("active")
        ) {
          addLogisticsStep(
            timelineContainer,
            mainStatusEl,
            stepText,
            eventTime,
            true,
          );
        }
      }, delayUntilEvent);
      // 把这个定时器的ID存起来，方便离开页面时清除
      logisticsUpdateTimers.push(timerId);
    }
  });

  // 如果订单刚刚创建，可能还没有任何步骤满足时间条件，此时手动显示第一条
  if (timelineContainer.children.length === 0) {
    const firstStep = logisticsTimelineTemplate[0];
    const stepText = firstStep.text
      .replace(/{city}/g, startCity)
      .replace("{next_city}", nextCity)
      .replace("{user_city}", userCity);
    addLogisticsStep(
      timelineContainer,
      mainStatusEl,
      stepText,
      creationTime,
      true,
    );
  }
}

/**
 * 在时间轴上添加一个物流步骤的辅助函数
 * @param {HTMLElement} container - 时间轴的DOM容器
 * @param {HTMLElement} mainStatusEl - 顶部主状态的DOM元素
 * @param {string} text - 物流信息文本
 * @param {number} timestamp - 该步骤发生的时间戳
 * @param {boolean} prepend - 是否添加到最前面（最新的步骤放前面）
 */
function addLogisticsStep(
  container,
  mainStatusEl,
  text,
  timestamp,
  prepend = false,
) {
  const stepEl = document.createElement("div");
  stepEl.className = "logistics-step";
  stepEl.innerHTML = `
        <div class="logistics-step-content">
            <div class="status-text">${text}</div>
            <div class="timestamp">${new Date(timestamp).toLocaleString("vi-VN")}</div>
        </div>
    `;

  if (prepend) {
    container.prepend(stepEl); // 插入到最前面
    mainStatusEl.textContent = text; // 更新顶部的状态
  } else {
    container.appendChild(stepEl);
  }
}

/**
 * 处理角色手机钱包余额和交易记录的通用函数
 * @param {string} charId - 要更新钱包的角色ID
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述
 */
async function updateCharacterPhoneBankBalance(charId, amount, description) {
  const chat = state.chats[charId];
  if (!chat || chat.isGroup) return;

  if (!chat.characterPhoneData) chat.characterPhoneData = {};
  if (!chat.characterPhoneData.bank)
    chat.characterPhoneData.bank = { balance: 0, transactions: [] };
  if (typeof chat.characterPhoneData.bank.balance !== "number")
    chat.characterPhoneData.bank.balance = 0;

  chat.characterPhoneData.bank.balance += amount;

  const newTransaction = {
    type: amount > 0 ? "Thu nhập" : "Chi tiêu",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 让最新的交易记录显示在最前面
  if (!Array.isArray(chat.characterPhoneData.bank.transactions)) {
    chat.characterPhoneData.bank.transactions = [];
  }
  chat.characterPhoneData.bank.transactions.unshift(newTransaction);

  await db.chats.put(chat);
  console.log(
    `✅ 角色[${chat.name}]钱包已更新: 金额=${amount.toFixed(2)}, 新余额=${chat.characterPhoneData.bank.balance.toFixed(
      2,
    )}`,
  );
}

/**
 * 打开一个单选的角色选择器，让用户选择一个代付对象
 * @returns {Promise<string|null>} - 返回选中的角色ID，如果取消则返回null
 */
async function openCharSelectorForCart() {
  return new Promise((resolve) => {
    // 复用分享功能的弹窗，很方便
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "Nhờ ai trả hộ?";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("Bạn chưa có người bạn nào để chia sẻ cả.");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    // 使用 radio 单选按钮
    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="cart-share-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="cart-share-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("Vui lòng chọn người trả hộ!");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 清空桃宝购物车
 */
async function clearTaobaoCart() {
  await db.taobaoCart.clear();
  await renderTaobaoCart();
  updateCartBadge();
}

/**
 * 根据购物车内容创建订单
 * @param {Array} cartItems - 购物车项目数组
 */
async function createOrdersFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return;
  const newOrders = cartItems.map((item, index) => ({
    productId: item.productId,
    quantity: item.quantity,
    timestamp: Date.now() + index, // 防止时间戳完全相同
    status: "Đã thanh toán, chờ giao hàng",
  }));
  await db.taobaoOrders.bulkAdd(newOrders);
  // 简单模拟物流更新
  setTimeout(async () => {
    const ordersToUpdate = await db.taobaoOrders
      .where("status")
      .equals("Đã thanh toán, chờ giao hàng")
      .toArray();
    for (const order of ordersToUpdate) {
      await db.taobaoOrders.update(order.id, { status: "Đã giao cho vận chuyển, đang trên đường" });
    }
  }, 1000 * 10);
}

/**
 * 处理“分享给Ta代付”的全部逻辑
 */
async function handleShareCart() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("Giỏ hàng trống, đi thêm vài món đồ trước đã!");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return;

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  cartItems.forEach((item, index) => {
    const product = products[index];
    if (product) {
      totalPrice += product.price * item.quantity;
    }
  });

  const charBalance = char.characterPhoneData?.bank?.balance || 0;
  if (charBalance < totalPrice) {
    await showCustomAlert(
      "Trả hộ thất bại",
      `Số dư ví của "${char.name}" không đủ!\nCần ¥${totalPrice.toFixed(2)}, nhưng số dư chỉ có ¥${charBalance.toFixed(2)}.`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận trả hộ",
    `Sẽ chia sẻ giỏ hàng cho "${char.name}" và nhờ trả hộ, tổng cộng ¥${totalPrice.toFixed(
      2,
    )}.\nViệc này sẽ xóa sạch giỏ hàng của bạn, và trừ tiền từ ví của người ấy. Bạn chắc chứ?`,
    { confirmText: "Xác nhận" },
  );

  if (!confirmed) return;

  await showCustomAlert("Đang xử lý...", "Đang báo người ấy trả hộ và đặt hàng...");

  // 1. 获取角色的手机数据，准备查找备注名
  const characterPhoneData = char.characterPhoneData || { chats: {} };

  // 2. 在角色的联系人中，找到代表“用户”的那个联系人对象
  //    （通常是那个没有聊天记录的特殊联系人条目）
  const userContactInData = Object.values(characterPhoneData.chats || {}).find(
    (c) => !c.history || c.history.length === 0,
  );

  // 3. 获取角色给用户的备注名，如果没设置，就默认用“我”
  const remarkForUser = userContactInData ? userContactInData.remarkName : "Tôi";

  // 4. 使用这个新的备注名来创建交易记录
  const description = `Trả tiền giỏ hàng Đào Bảo của "${remarkForUser}"`;
  await updateCharacterPhoneBankBalance(targetChatId, -totalPrice, description);

  await createOrdersFromCart(cartItems);

  const itemsSummary = products
    .map((p, i) => `${p.name} x${cartItems[i].quantity}`)
    .join("、 ");

  // 给AI看的隐藏指令，告诉它发生了什么
  const hiddenMessage = {
    role: "system",
    content: `[Thông báo hệ thống: người dùng vừa chia sẻ giỏ hàng của họ với bạn, và nhờ bạn trả tiền cho các sản phẩm tổng giá ¥${totalPrice.toFixed(
      2,
    )}. Bạn đã đồng ý và thanh toán, số dư ví của bạn đã bị trừ. Các sản phẩm gồm: ${itemsSummary}. Hãy dựa vào thiết lập nhân vật để phản hồi việc này, ví dụ thể hiện sự cưng chiều, than tiêu nhiều tiền quá, hoặc hỏi đã mua gì.]`,
    timestamp: Date.now(),
    isHidden: true,
  };
  char.history.push(hiddenMessage);
  await db.chats.put(char);

  await clearTaobaoCart();

  await showCustomAlert("Thao tác thành công", `"${char.name}" đã trả tiền giúp bạn thành công!`);
  renderChatList();

  openChat(targetChatId); // 跳转到聊天界面
  triggerAiResponse(); // 让AI回应这次代付
}

/**
 * 处理“为Ta购买”的全部逻辑
 */
async function handleBuyForChar() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("Giỏ hàng trống, đi thêm vài món đồ trước đã!");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return; // 用户取消选择

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  products.forEach((product, index) => {
    if (product) {
      totalPrice += product.price * cartItems[index].quantity;
    }
  });

  // 检查用户余额
  if ((state.globalSettings.userBalance || 0) < totalPrice) {
    alert(
      `Số dư không đủ! Lần này cần ¥${totalPrice.toFixed(2)}, nhưng số dư của bạn chỉ có ¥${(
        state.globalSettings.userBalance || 0
      ).toFixed(2)}.`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận tặng",
    `Bạn có chắc muốn bỏ ¥${totalPrice.toFixed(2)} để mua toàn bộ sản phẩm trong giỏ hàng cho "${char.name}"?`,
    { confirmText: "Trả tiền cho người ấy" },
  );

  if (confirmed) {
    await showCustomAlert("Đang xử lý...", "Đang đặt hàng cho người bạn thương...");

    // 1. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -totalPrice,
      `Mua sản phẩm cho ${char.name}`,
    );

    // 2. 将购物车内容转化为订单（记录在你的订单里）
    await createOrdersFromCart(cartItems);

    // 3. 发送礼物通知给对方
    await sendGiftNotificationToChar(
      targetChatId,
      products,
      cartItems,
      totalPrice,
    );

    // 4. 清空购物车
    await clearTaobaoCart();

    await showCustomAlert(
      "Tặng thành công!",
      `Quà bạn mua cho "${char.name}" đã được đặt, và đã nhắn tin riêng báo cho người ấy rồi!`,
    );
    renderChatList(); // 刷新列表，显示未读消息
  }
}

/**
 * 处理“为Ta购买”的全部逻辑
 */
async function handleBuyForChar() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("Giỏ hàng trống, đi thêm vài món đồ trước đã!");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return; // 用户取消选择

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  products.forEach((product, index) => {
    if (product) {
      totalPrice += product.price * cartItems[index].quantity;
    }
  });

  // 检查用户余额
  if ((state.globalSettings.userBalance || 0) < totalPrice) {
    alert(
      `Số dư không đủ! Lần này cần ¥${totalPrice.toFixed(2)}, nhưng số dư của bạn chỉ có ¥${(
        state.globalSettings.userBalance || 0
      ).toFixed(2)}.`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "Xác nhận tặng",
    `Bạn có chắc muốn bỏ ¥${totalPrice.toFixed(2)} để mua toàn bộ sản phẩm trong giỏ hàng cho "${char.name}"?`,
    { confirmText: "Trả tiền cho người ấy" },
  );

  if (confirmed) {
    await showCustomAlert("Đang xử lý...", "Đang đặt hàng cho người bạn thương...");

    // 1. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -totalPrice,
      `Mua sản phẩm cho ${char.name}`,
    );

    // 2. 将购物车内容转化为订单（记录在你的订单里）
    await createOrdersFromCart(cartItems);

    // 3. 发送礼物通知给对方
    await sendGiftNotificationToChar(
      targetChatId,
      products,
      cartItems,
      totalPrice,
    );

    // 4. 清空购物车
    await clearTaobaoCart();

    await showCustomAlert(
      "Tặng thành công!",
      `Quà bạn mua cho "${char.name}" đã được đặt, và đã nhắn tin riêng báo cho người ấy rồi!`,
    );
    renderChatList(); // 刷新列表，显示未读消息
  }
}

/**
 * 发送礼物通知到指定角色的聊天
 * 效果：发送一条本质是文本、但外观是卡片的消息。
 *      - 用户界面显示为漂亮的礼物卡片。
 *      - 消息数据中包含完整的文本信息。
 *      - AI 仍然通过隐藏的系统指令接收信息。
 */
async function sendGiftNotificationToChar(
  targetChatId,
  products,
  cartItems,
  totalPrice,
) {
  const chat = state.chats[targetChatId];
  if (!chat) return;

  const itemsSummary = products
    .map((p, i) => `${p.name} x${cartItems[i].quantity}`)
    .join("、");

  // 1. 先准备好这条消息的“文本内容”
  const messageTextContent = `Tôi mua quà mới cho bạn rồi, mong bạn thích!\nDanh sách sản phẩm: ${itemsSummary}\nTổng cộng: ¥${totalPrice.toFixed(
    2,
  )}`;

  // 2. 创建对用户【可见】的消息对象。现在它同时拥有 “文本内容” 和 “卡片样式指令”
  const visibleMessage = {
    role: "user",

    // 为这条消息添加一个 content 属性，这就是它的“文本本体”
    // 当你复制这条消息时，复制出来的内容就是这个。
    content: messageTextContent,

    // 同时保留 type 和 payload，它们告诉渲染器“把这条消息画成卡片”
    type: "gift_notification",
    timestamp: Date.now(),
    payload: {
      senderName: state.qzoneSettings.nickname || "Tôi",
      itemSummary: itemsSummary,
      totalPrice: totalPrice,
      itemCount: cartItems.length,
    },
  };
  chat.history.push(visibleMessage);

  // 3. 创建一条给AI看的【隐藏】指令，确保AI能理解并回应
  const hiddenMessage = {
    role: "system",
    content: `[Chỉ thị hệ thống: người dùng vừa mua cho bạn ${cartItems.length} sản phẩm, tổng giá trị ${totalPrice.toFixed(
      2,
    )} tệ. Các sản phẩm gồm: ${itemsSummary}. Hãy dựa vào thiết lập nhân vật để cảm ơn hoặc có phản ứng khác.]`,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  // 4. 未读消息只增加1条
  chat.unreadCount = (chat.unreadCount || 0) + 1;
  await db.chats.put(chat);

  // 5. 发送横幅通知
  if (state.activeChatId !== targetChatId) {
    showNotification(targetChatId, "Bạn đã nhận được một món quà!");
  }
}

/**
 * 处理用户点击“分享给Ta代付”按钮的逻辑
 */
async function handleShareCartRequest() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("Giỏ hàng trống, đi thêm vài món đồ trước đã!");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return;

  const chat = state.chats[targetChatId];
  if (!chat) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  const itemsSummary = products
    .map((p, i) => {
      if (p) {
        totalPrice += p.price * cartItems[i].quantity;
        return `${p.name} x${cartItems[i].quantity}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("、 ");

  const charBalance = chat.characterPhoneData?.bank?.balance || 0;

  const confirmed = await showCustomConfirm(
    "Xác nhận yêu cầu trả hộ",
    `Sẽ gửi yêu cầu trả hộ giỏ hàng tới "${chat.name}", tổng cộng ¥${totalPrice.toFixed(2)}.`,
    { confirmText: "Gửi yêu cầu" },
  );

  if (!confirmed) return;

  // 1. 直接将所有信息都放入 content 字段，让用户也能看到
  const requestContent = `[Yêu cầu trả hộ giỏ hàng]
Tổng tiền: ¥${totalPrice.toFixed(2)}
Sản phẩm: ${itemsSummary}
(Số dư hiện tại của bạn: ¥${charBalance.toFixed(2)})
Hãy dùng chỉ thị 'cart_payment_response' để phản hồi.`;

  // 2. 创建一条普通的用户消息，不再有 isHidden 标记
  const requestMessage = {
    role: "user", // 由用户发出
    type: "cart_share_request", // 类型保持不变，用于UI渲染
    timestamp: Date.now(),
    content: requestContent, // 将包含所有信息的文本作为内容
    payload: {
      // payload 依然保留，用于UI渲染卡片
      totalPrice: totalPrice,
      itemCount: cartItems.length,
      status: "pending",
    },
  };

  // 3. 将这条【单一的】消息添加到历史记录
  chat.history.push(requestMessage);

  await db.chats.put(chat);

  await showCustomAlert(
    "Đã gửi yêu cầu",
    `Đã gửi yêu cầu trả hộ tới "${chat.name}", hãy xem phản hồi của người ấy trong chat.`,
  );

  openChat(targetChatId);
}

/**
 * 【辅助函数】打开一个单选的角色选择器，让用户选择代付对象
 * (这个函数复用了分享功能的弹窗，稍作修改)
 */
async function openCharSelectorForCart() {
  return new Promise((resolve) => {
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "Nhờ ai trả hộ?";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("Bạn chưa có người bạn nào để chia sẻ cả.");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    // 使用 radio 单选按钮
    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="cart-share-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="cart-share-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("Vui lòng chọn người trả hộ!");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 【辅助函数】清空用户的桃宝购物车
 */
async function clearTaobaoCart() {
  await db.taobaoCart.clear();
  updateCartBadge();
  // 如果用户正好在看购物车，就刷新一下
  if (document.getElementById("cart-view").classList.contains("active")) {
    renderTaobaoCart();
  }
}

/**
 * 【辅助函数】根据购物车内容创建订单
 * @param {Array} cartItems - 从数据库读出的购物车项目数组
 */
async function createOrdersFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return;
  const newOrders = cartItems.map((item, index) => ({
    productId: item.productId,
    quantity: item.quantity,
    timestamp: Date.now() + index, // 防止时间戳完全相同
    status: "Đã thanh toán, chờ giao hàng",
  }));
  await db.taobaoOrders.bulkAdd(newOrders);

  // 模拟10秒后自动发货
  setTimeout(async () => {
    const orderIds = newOrders.map((order) => order.timestamp);
    const ordersToUpdate = await db.taobaoOrders
      .where("timestamp")
      .anyOf(orderIds)
      .toArray();
    for (const order of ordersToUpdate) {
      await db.taobaoOrders.update(order.id, { status: "Đã giao cho vận chuyển, đang trên đường" });
    }
    console.log(`${ordersToUpdate.length} 个新订单状态已更新为“已发货”。`);
  }, 1000 * 10);
}

/* --- “桃宝”App 功能函数结束 --- */
function initTaobao() {
  /* --- “桃宝”App 事件监听器 --- */

  // 1. 绑定主屏幕的App图标
  document
    .getElementById("taobao-app-icon")
    .addEventListener("click", openTaobaoApp);
  // 绑定新加的“清空”按钮
  document
    .getElementById("clear-taobao-products-btn")
    .addEventListener("click", clearTaobaoProducts);

  /* --- 桃宝购物车功能事件监听器 --- */

  // 1. 绑定App内部的页签切换
  document.querySelector(".taobao-tabs").addEventListener("click", (e) => {
    if (e.target.classList.contains("taobao-tab")) {
      switchTaobaoView(e.target.dataset.view);
    }
  });

  // 使用事件委托，统一处理桃宝所有页面的点击事件
  document
    .getElementById("taobao-screen")
    .addEventListener("click", async (e) => {
      const target = e.target;

      // --- 桃宝首页 ---
      if (target.closest("#products-view")) {
        const productCard = target.closest(".product-card");
        // 如果点击的是商品卡片本身（而不是添加购物车按钮）
        if (productCard && !target.classList.contains("add-cart-btn")) {
          // 调用桃宝的详情函数
          await openProductDetail(parseInt(productCard.dataset.productId));
        }
        // 如果点击的是添加购物车按钮
        else if (target.classList.contains("add-cart-btn")) {
          await handleAddToCart(parseInt(target.dataset.productId));
        }
        // 如果点击的是分类页签
        else if (target.closest(".category-tab-btn")) {
          const category =
            target.closest(".category-tab-btn").dataset.category === "all"
              ? null
              : target.closest(".category-tab-btn").dataset.category;
          await renderTaobaoProducts(category);
        }
      }

      // --- 饿了么页  ---
      else if (target.closest("#eleme-view")) {
        // 处理顶部的几个功能按钮
        if (target.closest("#eleme-search-btn")) {
          handleSearchFoodsAI();
        } else if (target.closest("#eleme-add-manual-btn")) {
          openFoodEditor();
        } else if (target.closest("#eleme-generate-ai-btn")) {
          handleGenerateFoodsAI();
        }
        // 处理美食卡片的点击
        else {
          const foodCard = target.closest(".product-card");
          if (foodCard) {
            const foodId = parseInt(foodCard.dataset.foodId);
            if (!isNaN(foodId)) {
              // ★★★ 当在饿了么页面点击卡片时，确保调用的是 openFoodDetail 函数！ ★★★
              await openFoodDetail(foodId);
            }
          }
        }
      }

      // --- 购物车页 ---
      else if (target.closest("#cart-view")) {
        if (
          target.closest(".cart-item-info") ||
          target.classList.contains("product-image")
        ) {
          const cartItem = target.closest(".cart-item");
          if (cartItem) {
            // 这里虽然也打开商品详情，但是从购物车点进去是合理的
            const productId =
              parseInt(
                cartItem.querySelector(".delete-cart-item-btn").dataset
                  .productId,
              ) || parseInt(target.dataset.productId);
            await openProductDetail(productId);
          }
        } else if (target.classList.contains("quantity-increase")) {
          await handleChangeCartItemQuantity(
            parseInt(target.dataset.cartId),
            1,
          );
        } else if (target.classList.contains("quantity-decrease")) {
          await handleChangeCartItemQuantity(
            parseInt(target.dataset.cartId),
            -1,
          );
        } else if (target.classList.contains("delete-cart-item-btn")) {
          const confirmed = await showCustomConfirm(
            "Bỏ khỏi giỏ hàng",
            "Bạn có chắc muốn xóa sản phẩm này?",
          );
          if (confirmed)
            await handleRemoveFromCart(parseInt(target.dataset.cartId));
        } else if (target.id === "checkout-btn") {
          await handleCheckout();
        } else if (target.id === "share-cart-to-char-btn") {
          await handleShareCartRequest();
        } else if (target.id === "buy-for-char-btn") {
          await handleBuyForChar();
        }
      }

      // --- 订单页 ---
      else if (target.closest("#orders-view")) {
        const orderItem = target.closest(".order-item");
        if (orderItem)
          await openLogisticsView(parseInt(orderItem.dataset.orderId));
      }

      // --- 我的页面 ---
      else if (target.closest("#my-view")) {
        if (target.id === "top-up-btn") {
          // 调用新写的打开娃娃机函数
          openClawMachine();
        } else if (target.classList.contains("delete-transaction-btn")) {
          await handleDeleteTransaction(parseInt(target.dataset.transactionId));
        }
      }
    });

  // 4. 绑定首页右上角的“+”按钮
  document
    .getElementById("add-product-btn")
    .addEventListener("click", openAddProductChoiceModal);

  // 5. 绑定添加方式选择弹窗的按钮
  document
    .getElementById("add-product-manual-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      openProductEditor();
    });
  document
    .getElementById("add-product-link-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      openAddFromLinkModal();
    });
  document
    .getElementById("add-product-ai-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      handleGenerateProductsAI();
    });
  document
    .getElementById("cancel-add-choice-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
    });

  // 6. 绑定手动添加/编辑弹窗的按钮
  document
    .getElementById("cancel-product-editor-btn")
    .addEventListener("click", () => {
      document
        .getElementById("product-editor-modal")
        .classList.remove("visible");
    });

  // 7. 绑定识别链接弹窗的按钮
  document
    .getElementById("cancel-link-paste-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-from-link-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("confirm-link-paste-btn")
    .addEventListener("click", handleAddFromLink);

  document
    .getElementById("products-view")
    .addEventListener("click", async (e) => {
      const target = e.target;

      // 把原来的购买逻辑，改成了打开详情页的逻辑
      const productCard = target.closest(".product-card");
      if (productCard && !target.classList.contains("add-cart-btn")) {
        const productId = parseInt(productCard.dataset.productId);
        if (!isNaN(productId)) {
          await openProductDetail(productId); // <--- 就是修改了这里！
        }
        return;
      }

      // 下面这两部分逻辑保持不变
      if (target.classList.contains("add-cart-btn")) {
        const productId = parseInt(target.dataset.productId);
        if (!isNaN(productId)) {
          await handleAddToCart(productId);
        }
        return;
      }
      const categoryTab = target.closest(".category-tab-btn");
      if (categoryTab) {
        const category =
          categoryTab.dataset.category === "all"
            ? null
            : categoryTab.dataset.category;
        renderTaobaoProducts(category);
        return;
      }
    });

  // 饿了么功能的核心事件监听器
  document.getElementById("eleme-view").addEventListener("click", async (e) => {
    // AI生成按钮
    if (e.target.closest("#eleme-generate-ai-btn")) {
      handleGenerateFoodsAI();
      return;
    }
    // 手动添加按钮
    if (e.target.closest("#eleme-add-manual-btn")) {
      openFoodEditor();
      return;
    }
    // 搜索按钮
    if (e.target.closest("#eleme-search-btn")) {
      handleSearchFoodsAI();
      return;
    }
    // ★★★ 核心修改：现在监听整个美食卡片的点击 ★★★
    const foodCard = e.target.closest(".product-card");
    if (foodCard) {
      const foodId = parseInt(foodCard.dataset.foodId);
      if (!isNaN(foodId)) {
        // 点击卡片后，调用我们新写的函数打开详情页
        await openFoodDetail(foodId);
      }
    }
  });

  // 绑定饿了么的“清空”按钮
  document
    .getElementById("eleme-clear-all-btn")
    .addEventListener("click", clearElemeFoods);

  /* --- “桃宝”App 搜索与AI结果弹窗事件监听器 --- */

  // 1. 绑定搜索按钮
  productSearchBtn.addEventListener("click", handleSearchProductsAI);
  productSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearchProductsAI();
    }
  });

  // 2. 绑定AI结果弹窗的关闭按钮
  document
    .getElementById("close-ai-products-modal-btn")
    .addEventListener("click", async () => {
      aiGeneratedProductsModal.classList.remove("visible");
      // 关闭后刷新主页，显示新添加的商品
      await renderTaobaoProducts();
    });

  // 3. 使用事件委托，处理结果弹窗内所有“添加”按钮的点击
  document
    .getElementById("ai-product-results-grid")
    .addEventListener("click", async (e) => {
      if (e.target.classList.contains("add-to-my-page-btn")) {
        const button = e.target;
        const productData = JSON.parse(button.dataset.product);

        // 1. 检查AI返回的商品数据里是否已经成功生成了图片URL
        if (!productData.imageUrl) {
          // 2. 如果【没有】图片URL（即生图失败了），
          //    我们就手动将它的imageUrl设置为空字符串''。
          productData.imageUrl = "";
          console.log(
            `AI生成的商品 "${productData.name}" 缺少图片，将添加到主页后继续尝试生成。`,
          );
        }
        // 3. 如果已经有图片URL了，就什么也不做，直接使用现有的URL。
        //    我们不再需要那个补充默认图的 else 分支了。
        // ★★★★★ 修改结束 ★★★★★

        // 检查商品是否已存在（这部分逻辑不变）
        const existingProduct = await db.taobaoProducts
          .where("name")
          .equals(productData.name)
          .first();
        if (existingProduct) {
          alert("Sản phẩm này đã có trên trang chủ Đào Bảo của bạn rồi!");
          button.textContent = "Đã thêm";
          button.disabled = true;
          return;
        }

        // 添加到数据库（现在，生图失败的商品会以 imageUrl: '' 的形式被保存）
        await db.taobaoProducts.add(productData);

        // 禁用按钮并更新文本，给用户反馈
        button.textContent = "✓ Đã thêm";
        button.disabled = true;
      }
    });

  /* --- 桃宝订单物流功能事件监听器 --- */

  // 1. 使用事件委托，为“我的订单”列表中的所有订单项绑定点击事件
  document.getElementById("orders-view").addEventListener("click", (e) => {
    const item = e.target.closest(".order-item");
    if (item && item.dataset.orderId) {
      const orderId = parseInt(item.dataset.orderId);
      if (!isNaN(orderId)) {
        openLogisticsView(orderId);
      }
    }
  });

  // 2. 绑定物流页面的返回按钮
  document
    .getElementById("logistics-back-btn")
    .addEventListener("click", () => {
      // 返回时，直接显示“桃宝”主界面，并自动切换到“我的订单”页签
      showScreen("taobao-screen");
      switchTaobaoView("orders-view");
    });

  /* --- 事件监听结束 --- */

  document
    .getElementById("share-cart-to-char-btn")
    .addEventListener("click", handleShareCartRequest);

  document
    .getElementById("buy-for-char-btn")
    .addEventListener("click", handleBuyForChar);
  // ... 其他绑定 ...

  // 绑定娃娃机内部按钮
  document
    .getElementById("close-claw-machine")
    .addEventListener("click", () => {
      document.getElementById("claw-machine-modal").classList.remove("visible");
    });

  const grabBtn = document.getElementById("claw-grab-btn");
  // 使用 cloneNode 移除旧的监听器，防止重复绑定 (可选，更安全)
  const newGrabBtn = grabBtn.cloneNode(true);
  grabBtn.parentNode.replaceChild(newGrabBtn, grabBtn);
  newGrabBtn.addEventListener("click", handleGrab);

  // ★★★ 绑定管理按钮 (Gear icon) ★★★
  const manageBtn = document.getElementById("claw-manage-btn");
  if (manageBtn) {
    manageBtn.addEventListener("click", openDollManager);
  }

  // ★★★ 绑定刷新按钮 (Restart icon) ★★★
  const restartBtn = document.getElementById("claw-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", handleRestartClaw);
  }

  // 管理弹窗内的按钮
  document
    .getElementById("close-doll-manager-btn")
    .addEventListener("click", () => {
      document.getElementById("doll-manager-modal").classList.remove("visible");
      // 关闭管理窗口时，自动刷新一下娃娃机，以便显示用户刚上传的图
      resetClawMachine();
    });
  document
    .getElementById("add-doll-btn")
    .addEventListener("click", handleAddDoll);
  document
    .getElementById("reset-dolls-btn")
    .addEventListener("click", resetDefaultDolls);
  document
    .getElementById("doll-upload-input")
    .addEventListener("change", handleDollFileChange);
}
