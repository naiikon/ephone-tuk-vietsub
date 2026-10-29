// ▼▼▼ 用这块新代码替换旧的 ACCOUNT_STRUCTURE ▼▼▼
let ACCOUNT_STRUCTURE = {
  "Tài khoản thông thường": {
    isAsset: true,
    types: [
      { name: "Tiền mặt", iconUrl: "https://i.postimg.cc/Vs99GyjW/现金钞票.png" },
      { name: "Thẻ ghi nợ", iconUrl: "https://i.postimg.cc/G3PP70kJ/储蓄卡.png" },
      {
        name: "Ví WeChat",
        iconUrl: "https://i.postimg.cc/FFbbWtjb/微信钱包.png",
      },
      {
        name: "Alipay",
        iconUrl: "https://i.postimg.cc/2jddcp4Q/支付宝.png",
      },
      {
        name: "Khác",
        iconUrl: "https://i.postimg.cc/MZ00Pkyy/报销_已选中.png",
      },
    ],
  },
  "Tài khoản tín dụng": {
    isAsset: false,
    types: [
      {
        name: "Thẻ tín dụng",
        iconUrl: "https://i.postimg.cc/nVKKR8vq/信用卡.png",
      },
      {
        name: "Huabei",
        iconUrl: "https://i.postimg.cc/kMNN1rxS/花呗.png",
      },
      {
        name: "Baitiao",
        iconUrl: "https://i.postimg.cc/wx55fKhm/京东_白条.png",
      },
      {
        name: "Khác",
        iconUrl: "https://i.postimg.cc/2jddcp4B/7.png",
      },
    ],
  },
  "Đầu tư tài chính": {
    isAsset: true,
    types: [
      {
        name: "Cổ phiếu",
        iconUrl: "https://i.postimg.cc/sfPP6FpB/股票分析.pngg",
      },
      {
        name: "Quỹ đầu tư",
        iconUrl: "https://i.postimg.cc/44vvLCz7/基金点击.png",
      },
      { name: "Khác", iconUrl: "https://i.postimg.cc/wx55fKh1/投资.png" },
    ],
  },
  "Tài khoản nạp tiền": {
    isAsset: true,
    types: [
      {
        name: "Thẻ ăn",
        iconUrl: "https://i.postimg.cc/gcyyS9vn/饭卡2.png",
      },
      {
        name: "Thẻ xe buýt",
        iconUrl: "https://i.postimg.cc/G3PP70k9/公交卡.png",
      },
      {
        name: "Khác",
        iconUrl: "https://i.postimg.cc/05GGWgpj/补卡.png",
      },
    ],
  },
  "Tài khoản khác": {
    isAsset: null,
    types: [
      {
        name: "Vay vào",
        iconUrl: "https://i.postimg.cc/7P11svgL/借入.png",
      },
      {
        name: "Cho vay",
        iconUrl: "https://i.postimg.cc/dQRRHM8s/借出登记.png",
      },
    ],
  },
};
// ▲▲▲ 替换结束 ▲▲▲
// ▼▼▼ 【兔k记账】在JS文件顶部，变量定义区添加 ▼▼▼
let ACCOUNTING_CATEGORIES = {
  expense: [
    {
      name: "Ăn uống",
      icon: "https://s3plus.meituan.net/opapisdk/op_ticket_1_5673241091_1763966898357_qdqqd_q6gypk.png",
    },
    {
      name: "Mua sắm",
      icon: "https://static.eeo.cn/upload/images/20251124/286655c4437163e96279.png",
    },
    {
      name: "Đi lại",
      icon: "https://static.eeo.cn/upload/images/20251124/83e440191818e2208623.png",
    },
    {
      name: "giải trí",
      icon: "https://zkaicc.huilan.com/aicc/api/aicc-file/miniofile/preViewPicture/aicc/qdqqd_1763967070965.png",
    },
    {
      name: "Nhà ở",
      icon: "https://yfupload.hebccw.cn/images/08zygs/wqbs/2025/11/24/1763967177_wqbs.png",
    },
    {
      name: "Y tế",
      icon: "https://xiaoiwg.dongfeng-nissan.com.cn/aicc-workbench/res/download/default/temp/images/20251124/21f586446548ec0b99bdd1e7c08adec359069046.png",
    },
    { name: "Khác", icon: "https://image.uglycat.cc/yfneo8.png" },
  ],
  income: [
    { name: "Lương", icon: "https://image.uglycat.cc/abn2a9.png" },
    { name: "Lì xì", icon: "https://image.uglycat.cc/k4zlkz.png" },
    {
      name: "Đầu tư",
      icon: "https://xiaoiwg.dongfeng-nissan.com.cn/aicc-workbench/res/download/default/temp/images/20251124/bb17bb33337885d0a579889b1cb8499d37a15de9.png",
    },
    { name: "Khác", icon: "https://image.uglycat.cc/3la2dz.png" },
  ],
};
// ▲▲▲ 添加结束 ▲▲▲
/**
 * 【全新】切换“兔k记账”App内部的页面视图
 * @param {string} viewId - 要显示的目标视图的ID
 */
function switchTukeyView(viewId) {
  // 隐藏所有视图
  document.querySelectorAll(".tukey-view").forEach((view) => {
    view.style.display = "none";
  });

  // 显示目标视图
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.style.display = "block";
  }

  // 更新底部导航栏高亮状态
  document
    .querySelectorAll("#tukey-bottom-nav .tukey-nav-item")
    .forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewId);
    });

  // 根据视图ID更新头部标题
  const headerTitle = document.getElementById("tukey-header-title");
  const navItem = document.querySelector(
    `.tukey-nav-item[data-view="${viewId}"]`,
  );
  if (headerTitle && navItem) {
    headerTitle.textContent = navItem.querySelector("span").textContent;
  }
  // ▼▼▼ 在这里添加一个 case ▼▼▼
  if (viewId === "tukey-reports-view") {
    renderTukeyReportsView(); // 调用我们即将创建的主渲染函数
  }
  // ▲▲▲ 添加结束 ▲▲▲
}
/* --- 【全新】兔k记账-用户设置功能核心函数 --- */
let tukeyUserSettings = {
  // 全局变量，用于缓存用户设置
  id: "main_user",
  avatar: "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg",
  username: "Tôi",
  profession: "",
  syncWithTaobao: false,
};

/**
 * 加载兔k记账的用户设置并渲染到设置页面
 */
async function loadAndRenderTukeyUserSettings() {
  const settings = await db.tukeyUserSettings.get("main_user");
  if (settings) {
    tukeyUserSettings = settings;
  }

  // 填充UI
  document.getElementById("tukey-user-avatar-preview").src =
    tukeyUserSettings.avatar;
  document.getElementById("tukey-user-name-input").value =
    tukeyUserSettings.username;
  document.getElementById("tukey-user-profession-input").value =
    tukeyUserSettings.profession || "";
  document.getElementById("sync-to-taobao-toggle").checked =
    tukeyUserSettings.syncWithTaobao || false;
}

/**
 * 保存兔k记账的用户设置
 */
async function saveTukeyUserSettings() {
  tukeyUserSettings.avatar = document.getElementById(
    "tukey-user-avatar-preview",
  ).src;
  tukeyUserSettings.username =
    document.getElementById("tukey-user-name-input").value.trim() || "Tôi";
  tukeyUserSettings.profession = document
    .getElementById("tukey-user-profession-input")
    .value.trim();
  tukeyUserSettings.syncWithTaobao = document.getElementById(
    "sync-to-taobao-toggle",
  ).checked;

  await db.tukeyUserSettings.put(tukeyUserSettings);
  alert("Đã lưu cài đặt ghi sổ!");
}
/* --- 用户设置功能函数结束 --- */
// ▼▼▼ 【全新】兔k记账 - 自定义配置核心函数 ▼▼▼

/**
 * 加载自定义配置并合并到全局变量中
 */
async function loadTukeyCustomConfig() {
  try {
    const config = await db.tukeyCustomConfig.get("main");
    if (config) {
      // 1. 合并自定义收支分类
      if (config.customCategories) {
        // 我们将自定义的追加到默认列表后面，或者完全覆盖（这里选择追加去重，或者简单替换）
        // 为了简单起见，我们假设 config 里存的是“最新的完整列表”
        // 如果你想保留默认项不可删除，可以做合并逻辑。这里我们假设用户配置是最终结果。
        // 但为了防止第一次覆盖掉默认值，我们在保存时会保存完整列表。
        ACCOUNTING_CATEGORIES = config.customCategories;
      }

      // 2. 合并自定义账户结构
      if (config.customAccountStructure) {
        ACCOUNT_STRUCTURE = config.customAccountStructure;
      }
    }
  } catch (e) {
    console.error("加载兔k记账自定义配置失败:", e);
  }
}

/**
 * 保存当前的全局配置到数据库
 */
async function saveTukeyCustomConfig() {
  await db.tukeyCustomConfig.put({
    id: "main",
    customCategories: ACCOUNTING_CATEGORIES,
    customAccountStructure: ACCOUNT_STRUCTURE,
  });
  // console.log("自定义配置已保存");
}

/**
 * 【核心】处理添加自定义收支分类
 * @param {string} type - 'expense' (支出) 或 'income' (收入)
 */
async function handleAddCustomCategory(type) {
  const typeName = type === "expense" ? "Chi tiêu" : "Thu nhập";

  // 1. 输入名称
  const name = await showCustomPrompt(
    `Thêm phân loại ${typeName}`,
    "Nhập tên phân loại (ví dụ: trà sữa, game)",
  );
  if (!name || !name.trim()) return;

  // 2. 选择图标来源
  const choice = await showChoiceModal("Chọn biểu tượng", [
    { text: "📁 Tải lên từ máy", value: "local" },
    { text: "🌐 Dùng URL trên mạng", value: "url" },
    { text: "🎲 Dùng biểu tượng mặc định", value: "default" },
  ]);

  if (!choice) return;

  let iconUrl = "";

  if (choice === "local") {
    iconUrl = await uploadImageLocally();
  } else if (choice === "url") {
    iconUrl = await showCustomPrompt("URL biểu tượng", "Nhập link ảnh", "", "url");
  } else {
    // 默认图标
    iconUrl = "https://i.postimg.cc/y88P16yW/default-icon.png";
  }

  if (!iconUrl) {
    alert("Biểu tượng không hợp lệ, đã hủy thêm.");
    return;
  }

  // 3. 更新数据
  const newCategory = { name: name.trim(), icon: iconUrl };
  ACCOUNTING_CATEGORIES[type].push(newCategory);

  // 4. 保存并刷新
  await saveTukeyCustomConfig();

  // 重新渲染分类列表 (如果在记账弹窗中)
  const card = document.getElementById("tukey-record-input-card");
  if (card.classList.contains("visible")) {
    // 只有当前是在对应类型的标签页下才刷新
    const activeBtn = card.querySelector(".type-selector .type-btn.active");
    if (activeBtn && activeBtn.dataset.type === type) {
      renderRecordCategories(type); // 重新渲染分类网格
    }
  }

  alert(`Đã thêm phân loại "${newCategory.name}" thành công!`);
}

/**
 * 【核心】处理添加自定义账户类型
 * @param {string} categoryName - 账户大类名称 (例如 "普通账户", "信用账户")
 */
async function handleAddCustomAccountType(categoryName) {
  // 1. 输入名称
  const name = await showCustomPrompt(
    `Thêm loại ${categoryName}`,
    "Nhập tên loại (ví dụ: ngân hàng Vietcombank, ví MoMo)",
  );
  if (!name || !name.trim()) return;

  // 2. 选择图标
  const choice = await showChoiceModal("Chọn biểu tượng", [
    { text: "📁 Tải lên từ máy", value: "local" },
    { text: "🌐 Dùng URL trên mạng", value: "url" },
    { text: "🎲 Dùng biểu tượng mặc định", value: "default" },
  ]);

  if (!choice) return;

  let iconUrl = "";
  if (choice === "local") {
    iconUrl = await uploadImageLocally();
  } else if (choice === "url") {
    iconUrl = await showCustomPrompt("URL biểu tượng", "Nhập link ảnh", "", "url");
  } else {
    iconUrl = "https://i.postimg.cc/y88P16yW/default-icon.png";
  }

  if (!iconUrl) return;

  // 3. 更新数据
  if (ACCOUNT_STRUCTURE[categoryName]) {
    ACCOUNT_STRUCTURE[categoryName].types.push({
      name: name.trim(),
      iconUrl: iconUrl,
    });

    // 4. 保存并刷新
    await saveTukeyCustomConfig();
    openAccountTypeSelector(); // 重新渲染类型选择界面
    alert(`Đã thêm loại tài khoản "${name.trim()}" thành công!`);
  }
}

/**
 * 【辅助】渲染记账弹窗中的分类网格（带添加按钮）
 * 替换掉 switchRecordType 中的简单 innerHTML 生成逻辑
 */
function renderRecordCategories(type) {
  const card = document.getElementById("tukey-record-input-card");
  const grid = card.querySelector(".category-grid");
  grid.innerHTML = "";

  // 渲染现有分类
  ACCOUNTING_CATEGORIES[type].forEach((cat) => {
    grid.innerHTML += `
        <div class="tukey-category-item" data-type="${type}" data-category="${cat.name}">
            <img src="${cat.icon}" alt="${cat.name}">
            <span>${cat.name}</span>
        </div>
    `;
  });

  // ★★★ 添加“自定义”按钮 ★★★
  const addBtn = document.createElement("div");
  addBtn.className = "tukey-category-item add-custom-btn";
  addBtn.innerHTML = `
      <div style="width:40px; height:40px; border-radius:50%; background:#f0f2f5; display:flex; align-items:center; justify-content:center; font-size:24px; color:#999;">+</div>
<span>Tùy chỉnh</span>
  `;
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 防止触发选择事件
    handleAddCustomCategory(type);
  });
  grid.appendChild(addBtn);
}
// ▲▲▲ 新增函数结束 ▲▲▲

/* --- 【全新】兔k记账-钱包功能核心函数 --- */

let editingAccountId = null; // 用于追踪正在编辑的账户ID

// ▼▼▼ 【兔k记账】用这整块【V2 - 图标修复版】的代码，替换旧的 renderTukeyWalletView 函数 ▼▼▼
async function renderTukeyWalletView() {
  const listEl = document.getElementById("wallet-accounts-list");
  listEl.innerHTML = "";

  const allAccounts = await db.tukeyAccounts.toArray();

  // --- 1. 计算并显示资产总览 (这部分逻辑不变) ---
  let totalAssets = 0;
  let totalLiabilities = 0;
  allAccounts.forEach((acc) => {
    const balance = parseFloat(acc.balance) || 0;
    const categoryInfo = ACCOUNT_STRUCTURE[acc.category];
    if (!categoryInfo) return;

    if (categoryInfo.isAsset === true) {
      totalAssets += balance;
    } else if (categoryInfo.isAsset === false) {
      totalLiabilities += balance;
    } else {
      if (acc.type === "Cho vay") totalAssets += balance;
      if (acc.type === "Vay vào") totalLiabilities += balance;
    }
  });

  const netAssets = totalAssets - totalLiabilities;
  document.getElementById("net-assets-value").textContent =
    `¥ ${netAssets.toFixed(2)}`;
  document.getElementById("total-assets-value").textContent =
    `¥ ${totalAssets.toFixed(2)}`;
  document.getElementById("total-liabilities-value").textContent =
    `¥ ${totalLiabilities.toFixed(2)}`;

  // --- 2. 按分类渲染账户列表 ---
  for (const categoryName in ACCOUNT_STRUCTURE) {
    const accountsInCategory = allAccounts.filter(
      (acc) => acc.category === categoryName,
    );
    if (accountsInCategory.length === 0) continue;

    const categoryCard = document.createElement("div");
    categoryCard.className = "tukey-account-category-card";

    let categoryTotal = 0;
    accountsInCategory.forEach(
      (acc) => (categoryTotal += parseFloat(acc.balance) || 0),
    );

    // ▼▼▼ ★★★★★ 核心修改在这里 ★★★★★ ▼▼▼
    let accountsHtml = "";
    accountsInCategory.forEach((acc) => {
      // 1. 根据账户的分类和类型，找到对应的图标URL
      const categoryInfo = ACCOUNT_STRUCTURE[acc.category];
      const typeInfo = categoryInfo?.types.find((t) => t.name === acc.type);
      // 2. 如果找到了就用它的图标，找不到就用一个备用图标或空字符串
      const iconUrl = typeInfo
        ? typeInfo.iconUrl
        : "https://i.postimg.cc/y88P16yW/default-icon.png";

      // 3. 在HTML结构中，添加 <img> 标签来显示图标
      accountsHtml += `
                <div class="tukey-account-item" data-account-id="${acc.id}">
                    <div class="account-info">
                        <img src="${iconUrl}" class="account-icon" alt="${acc.type}">
                        <span class="account-name">${acc.name}</span>
                    </div>
                    <div class="account-balance-and-type">
                        <span class="account-balance">¥ ${parseFloat(acc.balance).toFixed(2)}</span>
                        <span class="account-type-name">${acc.type}</span>
                    </div>
                </div>
            `;
    });
    // ▲▲▲ ★★★★★ 核心修改结束 ★★★★★ ▲▲▲

    // 渲染大类标题和总额
    categoryCard.innerHTML = `
            <div class="category-header">
                <div class="category-title">
                    <span class="name">${categoryName}</span>
                    <span class="total">¥ ${categoryTotal.toFixed(2)}</span>
                </div>
            </div>
            <div class="category-accounts-list">
                ${accountsHtml}
            </div>
        `;
    listEl.appendChild(categoryCard);
  }
}
// ▲▲▲ 替换结束 ▲▲▲
// ▼▼▼ 粘贴下面这【三个】全新的函数，来替换旧的 openAccountEditor 和 saveTukeyAccount ▼▼▼

// ▼▼▼ 【修改】添加自定义账户类型按钮 ▼▼▼
function openAccountTypeSelector() {
  editingAccountId = null;
  const modal = document.getElementById("account-editor-modal");
  const titleEl = document.getElementById("account-editor-title");
  const selectionView = document.getElementById("account-type-selection-view");
  const formView = document.getElementById("account-editor-form");
  const saveBtn = document.getElementById("save-account-btn");

  titleEl.textContent = "Chọn loại tài khoản";
  formView.style.display = "none";
  selectionView.style.display = "block";
  saveBtn.style.display = "none";
  selectionView.innerHTML = "";

  for (const categoryName in ACCOUNT_STRUCTURE) {
    const categoryInfo = ACCOUNT_STRUCTURE[categoryName];
    const groupEl = document.createElement("div");
    groupEl.className = "category-group";

    let typesHtml = "";
    categoryInfo.types.forEach((type) => {
      typesHtml += `
                <div class="type-item" data-category="${categoryName}" data-type="${type.name}">
                    <img src="${type.iconUrl}" class="type-icon">
                    <span class="type-name">${type.name}</span>
                </div>
            `;
    });

    // ★★★ 添加自定义按钮 ★★★
    // 注意：我们给它一个特殊的 class 'add-custom-type-btn'
    typesHtml += `
        <div class="type-item add-custom-type-btn" data-category="${categoryName}">
             <div style="width:40px; height:40px; border-radius:50%; background:#f0f2f5; display:flex; align-items:center; justify-content:center; font-size:20px; color:#999; margin-bottom:5px;">+</div>
<span class="type-name">Tùy chỉnh</span>
        </div>
    `;

    groupEl.innerHTML = `
            <div class="category-group-title">${categoryName}</div>
            <div class="type-grid">${typesHtml}</div>
        `;
    selectionView.appendChild(groupEl);
  }
  modal.classList.add("visible");
}
// ▲▲▲ 替换结束 ▲▲▲

/**
 * 【重构】第二步：打开账户编辑器表单（用于添加或编辑）
 */
async function openAccountEditor(
  accountId = null,
  preselectedCategory = null,
  preselectedType = null,
) {
  editingAccountId = accountId;
  const modal = document.getElementById("account-editor-modal");
  const titleEl = document.getElementById("account-editor-title");
  const selectionView = document.getElementById("account-type-selection-view");
  const formView = document.getElementById("account-editor-form");
  const saveBtn = document.getElementById("save-account-btn");

  // 获取表单元素
  const categorySelect = document.getElementById("account-category-select");
  const typeSelect = document.getElementById("account-type-select");
  const nameInput = document.getElementById("account-name-input");
  const balanceInput = document.getElementById("account-balance-input");
  const remarksInput = document.getElementById("account-remarks-input");

  // 切换视图
  selectionView.style.display = "none";
  formView.style.display = "block";
  saveBtn.style.display = "inline-block";

  if (accountId) {
    // --- 编辑模式 ---
    titleEl.textContent = "Sửa tài khoản";
    const account = await db.tukeyAccounts.get(accountId);
    if (account) {
      // 填充并选中已保存的数据
      categorySelect.innerHTML = `<option value="${account.category}">${account.category}</option>`;
      typeSelect.innerHTML = `<option value="${account.type}">${account.type}</option>`;
      categorySelect.value = account.category;
      typeSelect.value = account.type;
      nameInput.value = account.name;
      balanceInput.value = account.balance;
      remarksInput.value = account.remarks || "";
      // 编辑时不允许修改分类和类型
      categorySelect.disabled = true;
      typeSelect.disabled = true;
    }
  } else {
    // --- 添加模式 (已选定类型) ---
    titleEl.textContent = "Thêm tài khoản mới";
    // 填充并锁定预选的分类和类型
    categorySelect.innerHTML = `<option value="${preselectedCategory}">${preselectedCategory}</option>`;
    typeSelect.innerHTML = `<option value="${preselectedType}">${preselectedType}</option>`;
    categorySelect.value = preselectedCategory;
    typeSelect.value = preselectedType;
    categorySelect.disabled = true;
    typeSelect.disabled = true;

    // 清空其他输入框
    nameInput.value = "";
    balanceInput.value = "";
    remarksInput.value = "";

    // 自动聚焦到账户名称输入框
    nameInput.focus();
  }
  modal.classList.add("visible");
}

/**
 * 【重构】保存账户信息的核心函数
 */
async function saveTukeyAccount() {
  const category = document.getElementById("account-category-select").value;
  const typeName = document.getElementById("account-type-select").value;
  const name = document.getElementById("account-name-input").value.trim();
  const balance = document.getElementById("account-balance-input").value;
  const remarks = document.getElementById("account-remarks-input").value.trim();

  if (!name) {
    alert("Tên tài khoản không được để trống!");
    return;
  }
  if (balance === "" || isNaN(parseFloat(balance))) {
    alert("Vui lòng nhập số dư tài khoản hợp lệ!");
    return;
  }

  const selectedType = ACCOUNT_STRUCTURE[category]?.types.find(
    (t) => t.name === typeName,
  );
  const iconUrl = selectedType ? selectedType.iconUrl : "";

  const accountData = {
    category,
    type: typeName,
    name,
    balance: parseFloat(balance),
    remarks,
    iconUrl,
  };

  try {
    if (editingAccountId) {
      await db.tukeyAccounts.update(editingAccountId, accountData);
      alert("Đã cập nhật tài khoản!");
    } else {
      await db.tukeyAccounts.add(accountData);
      alert("Đã thêm tài khoản mới!");
    }
    document.getElementById("account-editor-modal").classList.remove("visible");
    await renderTukeyWalletView(); // ★★★ 这就是解决“不加入列表”问题的关键！
  } catch (error) {
    console.error("保存账户失败:", error);
    alert(`Lưu thất bại: ${error.message}`);
  }
}
// ▲▲▲ 函数替换结束 ▲▲▲

/**
 * 删除一个账户
 * @param {number} accountId - 要删除的账户ID
 */
async function deleteTukeyAccount(accountId) {
  const confirmed = await showCustomConfirm(
    "Xóa tài khoản",
    "Bạn có chắc muốn xóa tài khoản này? Thao tác này không thể khôi phục.",
    {
      confirmButtonClass: "btn-danger",
    },
  );
  if (confirmed) {
    await db.tukeyAccounts.delete(accountId);
    await renderTukeyWalletView(); // 刷新钱包界面
    alert("Đã xóa tài khoản.");
  }
}

/* --- 【全新】兔k记账-Excel导出功能 --- */

/**
 * 打开导出选项模态框
 */
async function openTukeyExportModal() {
  const modal = document.getElementById("tukey-export-modal");
  const listEl = document.getElementById("tukey-export-account-list");
  listEl.innerHTML = "";

  const accounts = await db.tukeyAccounts.toArray();

  // 添加“所有账户”选项
  listEl.innerHTML += `<label><input type="checkbox" value="all" id="tukey-export-select-all"> <strong>Tất cả tài khoản</strong></label>`;

  // 添加各个单独账户的选项
  accounts.forEach((acc) => {
    listEl.innerHTML += `<label><input type="checkbox" class="tukey-export-account-cb" value="${acc.id}"> ${acc.name} (${acc.type})</label>`;
  });

  // 为“所有账户”复选框添加联动逻辑
  document
    .getElementById("tukey-export-select-all")
    .addEventListener("change", (e) => {
      document.querySelectorAll(".tukey-export-account-cb").forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });

  modal.classList.add("visible");
}

/**
 * 执行导出为Excel的核心函数
 */
async function exportTukeyReportToExcel() {
  const selectedAccountIds = Array.from(
    document.querySelectorAll(".tukey-export-account-cb:checked"),
  ).map((cb) => parseInt(cb.value));

  if (selectedAccountIds.length === 0) {
    alert("Vui lòng chọn ít nhất một tài khoản cần xuất!");
    return;
  }

  document.getElementById("tukey-export-modal").classList.remove("visible");
  await showCustomAlert("Vui lòng chờ...", "Đang tạo file Excel...");

  try {
    // 1. 根据选择的账户ID从数据库获取记录
    const records = await db.tukeyAccountingRecords
      .where("accountId")
      .anyOf(selectedAccountIds)
      .sortBy("timestamp");

    if (records.length === 0) {
      await showCustomAlert("Không có dữ liệu", "Các tài khoản đã chọn không có bản ghi sổ sách nào để xuất.");
      return;
    }

    // 2. 将数据格式化为适合Excel的数组
    const dataForSheet = records.map((rec) => ({
      "Ngày": new Date(rec.timestamp).toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      "Loại": rec.type === "expense" ? "Chi tiêu" : "Thu nhập",
      "Phân loại": rec.category,
      "Số tiền": rec.type === "expense" ? -rec.amount : rec.amount,
      "Tài khoản": rec.accountName,
      "Ghi chú": rec.remarks || "",
    }));

    // 3. 使用SheetJS创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chi tiết hóa đơn");

    // (可选) 调整列宽
    worksheet["!cols"] = [
      { wch: 20 }, // 日期
      { wch: 8 }, // 类型
      { wch: 15 }, // 分类
      { wch: 12 }, // 金额
      { wch: 20 }, // 账户
      { wch: 30 }, // 备注
    ];

    // 4. 生成并下载Excel文件
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Bao-cao-Tho-K-Ghi-So-${dateStr}.xlsx`);
  } catch (error) {
    console.error("导出Excel失败:", error);
    await showCustomAlert("Xuất thất bại", `Có lỗi: ${error.message}`);
  }
}

/* --- Excel导出功能结束 --- */

// ▼▼▼ 用这整块新代码，替换旧的 initTukeyAccounting 函数 ▼▼▼
/* --- 兔k记账功能 V2.0 (记账群聊版) --- */
let activeTukeyGroup = null; // 用于存储当前激活的记账群聊数据

/**
 * 【总入口】初始化兔k记账App的所有功能和事件监听
 */
async function initTukeyAccounting() {
  await loadAndRenderTukeyUserSettings();
  await loadTukeyCustomConfig();
  // 1. 绑定主屏幕图标点击事件
  document
    .getElementById("tukey-accounting-app-icon")
    .addEventListener("click", async () => {
      // 打开App时，总是先尝试加载群聊数据
      await loadTukeyGroupData();
      showScreen("tukey-accounting-screen");
    });

  // 2. 绑定底部导航栏事件
  document.getElementById("tukey-bottom-nav").addEventListener("click", (e) => {
    const navItem = e.target.closest(".tukey-nav-item");
    if (navItem && navItem.dataset.view) {
      const viewId = navItem.dataset.view;
      switchTukeyView(viewId); // 切换视图
      // 如果切换到钱包或群聊视图，则刷新其内容
      if (viewId === "tukey-wallet-view") renderTukeyWalletView();
      if (viewId === "tukey-group-chat-view") loadTukeyGroupData();
    }
  });

  // 3. 绑定“创建群聊”按钮
  document
    .getElementById("tukey-create-group-btn")
    .addEventListener("click", () => {
      openGroupManagerModal();
    });

  // 4. 绑定群聊管理弹窗的“保存”和“取消”按钮
  document
    .getElementById("tukey-cancel-group-manager-btn")
    .addEventListener("click", () => {
      document
        .getElementById("tukey-group-manager-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("tukey-save-group-btn")
    .addEventListener("click", saveTukeyGroup);

  // 5. 绑定群聊内部的“设置”按钮    // 5. 【核心修改】绑定群聊内部的“设置”按钮 -> 改为弹出选项菜单
  document
    .getElementById("tukey-group-settings-btn")
    .addEventListener("click", async () => {
      // 使用现有的 showChoiceModal 弹出一个菜单
      const choice = await showChoiceModal("Cài đặt nhóm chat ghi sổ", [
        { text: "👥 Quản lý thành viên (kéo vào/đá ra)", value: "manage_members" },
        { text: "🤖 Cài đặt AI trả lời", value: "ai_settings" },
        { text: "⚠️ Giải tán nhóm chat", value: "dissolve_group" },
      ]);

      if (choice === "manage_members") {
        openGroupManagerModal(); // 打开成员选择弹窗（支持勾选添加/取消勾选踢人）
      } else if (choice === "ai_settings") {
        openReplySettingsModal(); // 打开AI设置
      } else if (choice === "dissolve_group") {
        dissolveTukeyGroup(); // 执行解散逻辑
      }
    });

  // 6. 绑定回复设置弹窗的按钮
  document
    .getElementById("tukey-cancel-reply-settings-btn")
    .addEventListener("click", () => {
      document
        .getElementById("tukey-reply-settings-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("tukey-save-reply-settings-btn")
    .addEventListener("click", saveReplySettings);

  // 7. 绑定回复设置弹窗内的模式切换逻辑
  document
    .querySelectorAll('input[name="tukey-reply-mode"]')
    .forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const mode = e.target.value;
        document.getElementById("tukey-specific-reply-options").style.display =
          mode === "random" || mode === "specific" ? "block" : "none";
      });
    });

  // 这是正确的代码
  // 9. 记一笔相关按钮
  document
    .getElementById("tukey-add-record-btn")
    .addEventListener("click", openRecordEditor);

  // 9. 记一笔弹窗内的“支出/收入”切换
  document
    .querySelector(".tukey-type-selector")
    .addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") {
        document
          .querySelectorAll(".tukey-type-selector .type-btn")
          .forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");
        renderRecordCategories(e.target.dataset.type);
      }
    });

  // 10.【不要动！】你原有的钱包账户功能事件监听，保持不变
  document
    .getElementById("add-new-account-fab")
    .addEventListener("click", openAccountTypeSelector);
  document
    .getElementById("account-type-selection-view")
    .addEventListener("click", (e) => {
      // 检查是否点击了“自定义”按钮
      const customBtn = e.target.closest(".add-custom-type-btn");
      if (customBtn) {
        const category = customBtn.dataset.category;
        handleAddCustomAccountType(category);
        return;
      }

      // 检查是否点击了普通类型
      const typeItem = e.target.closest(".type-item");
      if (typeItem && !typeItem.classList.contains("add-custom-type-btn")) {
        const category = typeItem.dataset.category;
        const type = typeItem.dataset.type;
        openAccountEditor(null, category, type);
      }
    });
  const accountListEl = document.getElementById("wallet-accounts-list");
  accountListEl.addEventListener("click", (e) => {
    const item = e.target.closest(".tukey-account-item");
    if (item && item.dataset.accountId) {
      openAccountEditor(parseInt(item.dataset.accountId));
    }
  });
  accountListEl.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".tukey-account-item");
    if (item && item.dataset.accountId) {
      e.preventDefault();
      deleteTukeyAccount(parseInt(item.dataset.accountId));
    }
  });
  document
    .getElementById("cancel-account-editor-btn")
    .addEventListener("click", () => {
      document
        .getElementById("account-editor-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("save-account-btn")
    .addEventListener("click", saveTukeyAccount);
  // ▼▼▼ 11. 【全新】绑定设置页面的保存和头像上传 ▼▼▼
  document
    .getElementById("save-tukey-settings-btn")
    .addEventListener("click", saveTukeyUserSettings);

  document
    .getElementById("tukey-user-avatar-input")
    .addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        const dataUrl = await handleImageUploadAndCompress(file); // 复用图片压缩函数
        document.getElementById("tukey-user-avatar-preview").src = dataUrl;
      }
      event.target.value = null;
    });
  // ▼▼▼ 12. 【全新】绑定Excel导出功能相关按钮 ▼▼▼
  document
    .getElementById("export-tukey-report-btn")
    .addEventListener("click", openTukeyExportModal);

  document
    .getElementById("cancel-tukey-export-btn")
    .addEventListener("click", () => {
      document.getElementById("tukey-export-modal").classList.remove("visible");
    });

  document
    .getElementById("confirm-tukey-export-btn")
    .addEventListener("click", exportTukeyReportToExcel);
  // ▲▲▲ 添加结束 ▲▲▲
  // 在 initTukeyAccounting 函数的末尾添加：

  // ▼▼▼ 修复重Roll按钮点击无效的问题 ▼▼▼
  const recordsListEl = document.getElementById("tukey-records-list");

  // 使用事件委托，监听列表内的点击
  recordsListEl.addEventListener("click", async (e) => {
    // 1. 查找是否点击了重Roll按钮（或其子元素）
    const rerollBtn = e.target.closest(".tukey-reroll-btn");

    if (rerollBtn) {
      e.stopPropagation(); // 阻止冒泡
      e.preventDefault(); // 阻止默认行为

      const recordId = parseInt(rerollBtn.dataset.recordId);
      console.log("点击了重Roll，账单ID:", recordId);

      if (!isNaN(recordId)) {
        // 调用全局重生成函数
        if (typeof window.handleTukeyReroll === "function") {
          await window.handleTukeyReroll(recordId);
        } else {
          console.error("找不到 window.handleTukeyReroll 函数");
          alert("Chức năng chưa sẵn sàng, vui lòng làm mới trang và thử lại.");
        }
      }
    }
  });
  // ▲▲▲ 修复结束 ▲▲▲
}

/**
 * 加载群聊数据并渲染主界面
 */
async function loadTukeyGroupData() {
  activeTukeyGroup = await db.tukeyAccountingGroups.get("main_group");
  if (activeTukeyGroup) {
    document.getElementById("tukey-no-group-placeholder").style.display =
      "none";
    document.getElementById("tukey-group-chat-container").style.display =
      "flex";
    document.getElementById("tukey-group-name").textContent =
      activeTukeyGroup.name;
    await renderTukeyRecordsList();
  } else {
    document.getElementById("tukey-no-group-placeholder").style.display =
      "flex";
    document.getElementById("tukey-group-chat-container").style.display =
      "none";
  }
}

/**
 * 打开群聊创建/管理模态框
 */
async function openGroupManagerModal() {
  const modal = document.getElementById("tukey-group-manager-modal");
  const pickerList = document.getElementById("tukey-member-picker-list");
  pickerList.innerHTML = "";

  // 加载所有单聊角色作为备选成员
  const allChars = Object.values(state.chats).filter((c) => !c.isGroup);

  if (activeTukeyGroup) {
    // 编辑模式
    document.getElementById("tukey-group-manager-title").textContent =
      "Quản lý thành viên nhóm";
    document.getElementById("tukey-group-name-input").value =
      activeTukeyGroup.name;
    const currentMemberIds = new Set(activeTukeyGroup.members.map((m) => m.id));
    allChars.forEach((char) => {
      const isChecked = currentMemberIds.has(char.id) ? "checked" : "";
      pickerList.innerHTML += `
                <label>
                    <input type="checkbox" value="${char.id}" ${isChecked}> ${char.name}
                </label>`;
    });
  } else {
    // 创建模式
    document.getElementById("tukey-group-manager-title").textContent =
      "Tạo nhóm chat ghi sổ";
    document.getElementById("tukey-group-name-input").value = "";
    allChars.forEach((char) => {
      pickerList.innerHTML += `<label><input type="checkbox" value="${char.id}"> ${char.name}</label>`;
    });
  }

  modal.classList.add("visible");
}

/**
 * 保存群聊设置
 */
async function saveTukeyGroup() {
  const name = document.getElementById("tukey-group-name-input").value.trim();
  if (!name) {
    alert("Tên nhóm chat không được để trống!");
    return;
  }

  const selectedCheckboxes = document.querySelectorAll(
    "#tukey-member-picker-list input:checked",
  );
  if (selectedCheckboxes.length === 0) {
    alert("Vui lòng chọn ít nhất một thành viên nhóm!");
    return;
  }

  const members = Array.from(selectedCheckboxes).map((cb) => {
    const char = state.chats[cb.value];
    return {
      id: char.id,
      name: char.name,
      persona: char.settings.aiPersona,
      avatar: char.settings.aiAvatar,
    };
  });

  const groupData = {
    id: "main_group",
    name: name,
    members: members,
    replySettings: activeTukeyGroup?.replySettings || {
      // 保留旧设置或使用默认值
      threshold: 1,
      mode: "all",
      randomCount: 1,
      specificMemberIds: [],
    },
  };

  await db.tukeyAccountingGroups.put(groupData);
  activeTukeyGroup = groupData;

  document
    .getElementById("tukey-group-manager-modal")
    .classList.remove("visible");
  await loadTukeyGroupData(); // 重新加载并渲染主界面
}

/**
 * 打开AI回复设置模态框
 */
function openReplySettingsModal() {
  if (!activeTukeyGroup) return;

  const settings = activeTukeyGroup.replySettings;
  document.getElementById("tukey-reply-threshold-input").value =
    settings.threshold;
  document.querySelector(
    `input[name="tukey-reply-mode"][value="${settings.mode}"]`,
  ).checked = true;

  const specificOptions = document.getElementById(
    "tukey-specific-reply-options",
  );
  specificOptions.style.display =
    settings.mode === "random" || settings.mode === "specific"
      ? "block"
      : "none";

  document.getElementById("tukey-random-count-input").value =
    settings.randomCount;

  // 渲染指定成员选择列表
  const specificMemberList = document.getElementById(
    "tukey-specific-member-picker-list",
  );
  specificMemberList.innerHTML = "";
  activeTukeyGroup.members.forEach((member) => {
    const isChecked = settings.specificMemberIds.includes(member.id)
      ? "checked"
      : "";
    specificMemberList.innerHTML += `<label><input type="checkbox" value="${member.id}" ${isChecked}> ${member.name}</label>`;
  });

  document
    .getElementById("tukey-reply-settings-modal")
    .classList.add("visible");
}

/**
 * 保存AI回复设置
 */
async function saveReplySettings() {
  const threshold = parseInt(
    document.getElementById("tukey-reply-threshold-input").value,
  );
  const mode = document.querySelector(
    'input[name="tukey-reply-mode"]:checked',
  ).value;
  const randomCount = parseInt(
    document.getElementById("tukey-random-count-input").value,
  );
  const specificMemberIds = Array.from(
    document.querySelectorAll(
      "#tukey-specific-member-picker-list input:checked",
    ),
  ).map((cb) => cb.value);

  activeTukeyGroup.replySettings = {
    threshold,
    mode,
    randomCount,
    specificMemberIds,
  };
  await db.tukeyAccountingGroups.put(activeTukeyGroup);

  document
    .getElementById("tukey-reply-settings-modal")
    .classList.remove("visible");
  alert("Đã lưu cài đặt trả lời!");
}

/**
 * 【全新】解散记账群聊
 */
async function dissolveTukeyGroup() {
  if (!activeTukeyGroup) return;

  // 1. 弹出红色警告确认框
  const confirmed = await showCustomConfirm(
    "Xác nhận giải tán",
    "Bạn có chắc muốn giải tán nhóm chat ghi sổ?\n\nLưu ý:\n1. Các bản ghi sổ sách trước đó **sẽ không** bị xóa, vẫn có thể xem trong báo cáo.\n2. Sau khi giải tán bạn có thể tạo lại một nhóm ghi sổ mới.",
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    try {
      // 2. 从数据库删除群组配置
      await db.tukeyAccountingGroups.delete("main_group");

      // 3. 重置内存状态
      activeTukeyGroup = null;

      // 4. 刷新界面（会自动显示回“创建群聊”的空状态页面）
      await loadTukeyGroupData();

      alert("Đã giải tán nhóm chat ghi sổ.");
    } catch (error) {
      console.error("解散群聊失败:", error);
      alert("Giải tán thất bại, vui lòng thử lại.");
    }
  }
}

/**
 * 【V3修正版】打开浮动记账卡片并初始化 (已修复自定义按钮点击报错)
 */
async function openRecordEditor() {
  const card = document.getElementById("tukey-record-input-card");
  if (!card) return;

  // 清空旧数据
  document.getElementById("tukey-card-amount-input").value = "";
  document.getElementById("tukey-card-remarks-input").value = "";

  // 设置时间默认为当前时间
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("tukey-card-time-input").value = now
    .toISOString()
    .slice(0, 16);

  // 渲染账户下拉列表
  const accountSelect = document.getElementById("tukey-card-account-select");
  accountSelect.innerHTML = "";
  const accounts = await db.tukeyAccounts.toArray();
  if (accounts.length === 0) {
    alert("Hãy thêm một tài khoản ở trang \"Ví\" trước!");
    return;
  }
  accounts.forEach((acc) => {
    accountSelect.innerHTML += `<option value="${acc.id}" data-name="${acc.name}">${acc.name}</option>`;
  });

  // 默认显示支出分类，并重置已选分类
  switchRecordType("expense");
  updateSelectedCategoryDisplay();

  // ---- 事件绑定 (使用克隆节点防止重复绑定) ----
  const typeSelector = card.querySelector(".type-selector");
  const newTypeSelector = typeSelector.cloneNode(true);
  typeSelector.parentNode.replaceChild(newTypeSelector, typeSelector);
  newTypeSelector.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      switchRecordType(e.target.dataset.type);
    }
  });

  const categoryGrid = card.querySelector(".category-grid");
  const newCategoryGrid = categoryGrid.cloneNode(true);
  categoryGrid.parentNode.replaceChild(newCategoryGrid, categoryGrid);

  // ★★★★★ 核心修复在这里 ★★★★★
  newCategoryGrid.addEventListener("click", (e) => {
    // 1. 找到被点击的项
    const item = e.target.closest(".tukey-category-item");

    // 2. 检查：如果点到了，并且它不是“添加自定义”按钮
    if (item && !item.classList.contains("add-custom-btn")) {
      newCategoryGrid
        .querySelectorAll(".tukey-category-item")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      // 3. 现在可以安全地读取 img.src 了
      updateSelectedCategoryDisplay(
        item.dataset.category,
        item.querySelector("img").src,
      );
    }
  });
  // ★★★★★ 修复结束 ★★★★★

  const closeBtn = card.querySelector(".close-card-btn");
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener("click", () => card.classList.remove("visible"));

  const saveBtn = card.querySelector("#tukey-save-from-card-btn");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener("click", saveTukeyRecordFromCard);

  // 显示卡片
  card.classList.add("visible");
  document.getElementById("tukey-card-amount-input").focus();
}

// ▼▼▼ 【修改】使用新的渲染函数，支持自定义按钮 ▼▼▼
function switchRecordType(type) {
  const card = document.getElementById("tukey-record-input-card");
  card.querySelectorAll(".type-selector .type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  // 使用新函数来渲染，包含那个“+”号
  renderRecordCategories(type);

  // 切换后清空已选分类
  updateSelectedCategoryDisplay();
}
// ▲▲▲ 替换结束 ▲▲▲

/**
 * 【全新】更新金额输入框旁边已选分类的显示
 */
function updateSelectedCategoryDisplay(
  categoryName = "Vui lòng chọn phân loại",
  iconSrc = "",
) {
  const displayEl = document.getElementById("tukey-card-selected-category");
  const imgEl = displayEl.querySelector("img");
  const spanEl = displayEl.querySelector("span");

  if (iconSrc) {
    imgEl.src = iconSrc;
    imgEl.style.display = "inline";
  } else {
    imgEl.style.display = "none";
  }
  spanEl.textContent = categoryName;
}

/**
 * 【V3版-核心】从记账卡片中读取数据并保存
 */
async function saveTukeyRecordFromCard() {
  const card = document.getElementById("tukey-record-input-card");

  const type = card.querySelector(".type-selector .type-btn.active").dataset
    .type;
  const selectedCategoryItem = card.querySelector(
    ".tukey-category-item.selected",
  );
  const amount = parseFloat(
    document.getElementById("tukey-card-amount-input").value,
  );
  const remarks = document
    .getElementById("tukey-card-remarks-input")
    .value.trim();

  // 【核心修改】从对应的选择器读取账户和时间
  const accountSelect = document.getElementById("tukey-card-account-select");
  const accountId = parseInt(accountSelect.value);
  const accountName =
    accountSelect.options[accountSelect.selectedIndex].dataset.name;
  const timeValue = document.getElementById("tukey-card-time-input").value;
  const timestamp = timeValue ? new Date(timeValue).getTime() : Date.now();

  if (!selectedCategoryItem) {
    alert("Vui lòng chọn một phân loại!");
    return;
  }
  const category = selectedCategoryItem.dataset.category;

  if (isNaN(amount) || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ!");
    return;
  }

  const newRecord = {
    groupId: activeTukeyGroup.id,
    timestamp,
    type,
    amount,
    category,
    remarks,
    accountId,
    accountName,
    isRepliedTo: false,
  };

  // 【核心修改】更新正确的账户余额
  const account = await db.tukeyAccounts.get(accountId);
  if (account) {
    const currentBalance = parseFloat(account.balance);
    const change = type === "expense" ? -amount : amount;

    // 特殊处理信用账户和借贷
    const categoryInfo = ACCOUNT_STRUCTURE[account.category];
    if (categoryInfo.isAsset === false) {
      // 信用账户
      account.balance =
        currentBalance + (type === "expense" ? amount : -amount);
    } else if (account.type === "Vay vào") {
      account.balance =
        currentBalance + (type === "expense" ? -amount : amount);
    } else {
      // 资产账户
      account.balance = currentBalance + change;
    }

    await db.tukeyAccounts.put(account);
  }

  await db.tukeyAccountingRecords.add(newRecord);
  // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
  // 【核心】检查同步开关，如果开启，则更新桃宝余额
  if (tukeyUserSettings.syncWithTaobao) {
    const syncAmount =
      newRecord.type === "expense" ? -newRecord.amount : newRecord.amount;
    const syncDescription = `[Đồng bộ Thỏ K Ghi Sổ] ${newRecord.category} - ${newRecord.remarks || "Không có ghi chú"}`;
    await updateUserBalanceAndLogTransaction(syncAmount, syncDescription);
    console.log(
      `桃宝余额已同步: ${syncAmount > 0 ? "+" : ""}${syncAmount.toFixed(2)}`,
    );
  }
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  card.classList.remove("visible"); // 保存后隐藏卡片
  await renderTukeyRecordsList(); // 刷新列表
  await checkAndTriggerAiReply(); // 检查AI回复
}
/**
 * 【重构渲染】渲染记账记录和AI回复列表（美化版气泡模式）
 */
async function renderTukeyRecordsList() {
  const listEl = document.getElementById("tukey-records-list");
  listEl.innerHTML = ""; // 清空
  if (!activeTukeyGroup) return;

  // 获取所有记录并按时间升序排列（旧的在前，新的在后）
  const records = await db.tukeyAccountingRecords
    .where("groupId")
    .equals(activeTukeyGroup.id)
    .sortBy("timestamp");

  if (records.length === 0) {
    listEl.innerHTML =
      '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#ccc;">' +
      '<span style="font-size:40px; margin-bottom:10px;">📝</span>' +
      "<span>Chưa ghi sổ gì cả, bấm góc dưới bên phải để bắt đầu nhé~</span>" +
      "</div>";
    return;
  }

  for (const record of records) {
    const recordTime = new Date(record.timestamp);
    const timeString = `${recordTime.getMonth() + 1}/${recordTime.getDate()} ${String(recordTime.getHours()).padStart(2, "0")}:${String(recordTime.getMinutes()).padStart(2, "0")}`;

    // 找到对应分类的图标
    let categoryIcon = "";
    // 尝试在支出和收入里找
    const expenseCat = ACCOUNTING_CATEGORIES["expense"]?.find(
      (c) => c.name === record.category,
    );
    const incomeCat = ACCOUNTING_CATEGORIES["income"]?.find(
      (c) => c.name === record.category,
    );
    const customCat = (ACCOUNTING_CATEGORIES["expense"] || [])
      .concat(ACCOUNTING_CATEGORIES["income"] || [])
      .find((c) => c.name === record.category);

    if (expenseCat) categoryIcon = expenseCat.icon;
    else if (incomeCat) categoryIcon = incomeCat.icon;
    else if (customCat) categoryIcon = customCat.icon;
    else categoryIcon = "https://i.postimg.cc/y88P16yW/default-icon.png"; // 默认图标

    // --- 创建用户记账气泡 (右侧) ---
    const userRecordWrapper = document.createElement("div");
    userRecordWrapper.className = "tukey-record-wrapper user-record";

    // 创建记账气泡本身
    // 添加删除按钮 logic
    const recordBubble = document.createElement("div");
    recordBubble.className = `tukey-record-bubble ${record.type}`;
    recordBubble.innerHTML = `
            <div class="record-header">
                <img src="${categoryIcon}" class="record-category-icon" alt="${record.category}">
                <span class="record-category-name">${record.category}</span>
                <span class="record-amount" style="margin-left:auto;">${record.type === "expense" ? "-" : "+"} ${record.amount.toFixed(2)}</span>
            </div>
            <div class="record-body" style="margin-bottom:0;">
                <span class="record-remarks">${record.remarks || "Không có ghi chú"}</span>
            </div>
            <div class="record-footer">
                <span>${record.accountName || "Tài khoản"}</span> · <span>${timeString}</span>
            </div>
<!-- nút xóa (định vị tuyệt đối hơi lệch ra ngoài bên trái bong bóng, hoặc hiện khi rê chuột, ở đây xử lý đơn giản là đặt ở góc trong bong bóng) -->
            <div class="delete-record-btn" data-id="${record.id}" style="position:absolute; top:-5px; left:-10px; background:#fff; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.1); cursor:pointer; color:#ff3b30; font-size:14px; opacity:0; transition:opacity 0.2s;">×</div>
        `;

    // 鼠标悬停显示删除按钮
    recordBubble.addEventListener("mouseenter", () => {
      recordBubble.querySelector(".delete-record-btn").style.opacity = "1";
    });
    recordBubble.addEventListener("mouseleave", () => {
      recordBubble.querySelector(".delete-record-btn").style.opacity = "0";
    });

    // 绑定删除事件
    recordBubble
      .querySelector(".delete-record-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTukeyAccountingRecord(record.id);
      });

    // 创建头像
    const userAvatarImg = document.createElement("img");
    userAvatarImg.src =
      tukeyUserSettings.avatar || "https://i.postimg.cc/PxZrFFFL/o-o-1.jpg";
    userAvatarImg.className = "record-user-avatar";

    // 组装用户消息
    userRecordWrapper.appendChild(recordBubble);
    userRecordWrapper.appendChild(userAvatarImg);
    listEl.appendChild(userRecordWrapper);

    // --- 查询并渲染对应的 AI 回复 (左侧) ---
    const replies = await db.tukeyAccountingReplies
      .where("recordId")
      .equals(record.id)
      .toArray();

    if (replies.length > 0) {
      const repliesContainer = document.createElement("div");
      repliesContainer.className = "tukey-replies-container"; // 这个容器是列布局

      for (const reply of replies) {
        const member = activeTukeyGroup.members.find(
          (m) => m.id === reply.charId,
        );
        if (member) {
          const replyEl = document.createElement("div");
          replyEl.className = "tukey-reply-item"; // flex row
          replyEl.innerHTML = `
                <img src="${member.avatar}" class="reply-avatar" alt="${member.name}">
                <div class="reply-content">
                    <div class="reply-sender-name">${member.groupNickname || member.name}</div>
                    <div class="reply-bubble">${reply.content}</div>
                </div>
            `;
          repliesContainer.appendChild(replyEl);
        }
      }

      // ★★★ 新增：添加重Roll按钮 ★★★
      const rerollBtn = document.createElement("div");
      rerollBtn.className = "tukey-reroll-btn";
      rerollBtn.dataset.recordId = record.id; // 绑定账单ID
      rerollBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
<span>Tạo lại</span>
      `;
      repliesContainer.appendChild(rerollBtn);
      // ★★★ 新增结束 ★★★

      listEl.appendChild(repliesContainer);
    }
  }

  // 滚动到底部
  setTimeout(() => {
    listEl.scrollTop = listEl.scrollHeight;
  }, 100);
}

// ▼▼▼ 【兔k记账】这是全新的AI回复核心逻辑，请完整粘贴 ▼▼▼

/**
 * 检查是否达到阈值，并触发AI回复
 */
async function checkAndTriggerAiReply() {
  if (!activeTukeyGroup) return;

  const settings = activeTukeyGroup.replySettings;
  // ▼▼▼ 【核心修复】使用 .filter() 来正确查找未回复的记录 ▼▼▼
  const unrepliedRecords = await db.tukeyAccountingRecords
    .where("groupId")
    .equals(activeTukeyGroup.id)
    .filter((record) => !record.isRepliedTo) // 这会匹配 isRepliedTo 为 false, undefined 或 null 的所有情况
    .toArray();
  // ▲▲▲ 修复结束 ▲▲▲

  console.log(
    `[记账AI检查] 未回复记录数: ${unrepliedRecords.length}, 阈值: ${settings.threshold}`,
  );

  // 如果未回复的记录数达到了阈值
  if (unrepliedRecords.length >= settings.threshold) {
    console.log(`[记账AI触发] 达到阈值，准备生成回复...`);
    await triggerAccountingAiResponse(unrepliedRecords);
  }
}
/**
 * 【全局函数】处理单条账单的AI回复重生成
 * 放在代码的最外层，不要放在其他函数里面！
 */
window.handleTukeyReroll = async function (recordId) {
  console.log("正在重Roll账单 ID:", recordId); // 调试日志

  // 1. 检查是否有激活的群组
  if (!window.activeTukeyGroup && window.state.chats) {
    // 尝试自动修复 activeTukeyGroup (防止刷新后丢失)
    // 这里假设群组ID固定为 main_group，如果你的逻辑不同请调整
    window.activeTukeyGroup =
      await window.db.tukeyAccountingGroups.get("main_group");
  }

  if (!window.activeTukeyGroup) {
    alert("Không lấy được thông tin nhóm chat hiện tại, vui lòng làm mới trang và thử lại.");
    return;
  }

  // 2. 获取账单记录
  const record = await window.db.tukeyAccountingRecords.get(recordId);
  if (!record) {
    alert("Không tìm thấy hóa đơn này!");
    return;
  }

  // 3. 视觉反馈：将按钮变成“生成中...”
  const listEl = document.getElementById("tukey-records-list");
  // 使用更精确的选择器找到那个被点击的按钮
  const btn = listEl.querySelector(
    `.tukey-reroll-btn[data-record-id="${recordId}"]`,
  );
  if (btn) {
    btn.innerHTML = "<span>⏳ Đang tạo...</span>";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
  }

  try {
    // 4. 删除旧的回复
    const oldReplies = await window.db.tukeyAccountingReplies
      .where("recordId")
      .equals(recordId)
      .toArray();

    if (oldReplies.length > 0) {
      const replyIds = oldReplies.map((r) => r.id);
      await window.db.tukeyAccountingReplies.bulkDelete(replyIds);
      console.log(`已删除 ${replyIds.length} 条旧回复`);
    }

    // 5. 重新调用生成函数 (注意：传入数组)
    // 确保 triggerAccountingAiResponse 也是全局可访问的，或者在同一作用域
    if (typeof triggerAccountingAiResponse === "function") {
      await triggerAccountingAiResponse([record]);
    } else if (typeof window.triggerAccountingAiResponse === "function") {
      await window.triggerAccountingAiResponse([record]);
    } else {
      alert("Lỗi: không tìm thấy hàm tạo triggerAccountingAiResponse");
    }
  } catch (error) {
    console.error("重Roll失败:", error);
    alert("Tạo lại thất bại: " + error.message);
    // 如果失败，尝试恢复界面
    if (typeof renderTukeyRecordsList === "function") {
      await renderTukeyRecordsList();
    }
  }
};

/**
 * 【AI核心】触发记账群聊的AI回复
 * @param {Array} recordsToReply - 需要AI进行评论的账单记录数组
 */
async function triggerAccountingAiResponse(recordsToReply) {
  if (!activeTukeyGroup) return;

  // 显示一个加载提示
  const listEl = document.getElementById("tukey-records-list");
  const loadingEl = document.createElement("div");
  loadingEl.className = "tukey-reply-item";
  loadingEl.innerHTML = `<div class="reply-bubble">Các thành viên đang trên đường tới...</div>`;
  listEl.appendChild(loadingEl);
  listEl.scrollTop = listEl.scrollHeight;

  const { proxyUrl, apiKey, model, temperature } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    loadingEl.remove();
    alert("Hãy cấu hình xong trong Cài đặt API mới kích hoạt được AI trả lời nhé!");
    return;
  }

  const settings = activeTukeyGroup.replySettings;
  let membersToReply = [];

  // 根据设置决定哪些成员需要回复
  switch (settings.mode) {
    case "all":
      membersToReply = activeTukeyGroup.members;
      break;
    case "random":
      const shuffled = [...activeTukeyGroup.members].sort(
        () => 0.5 - Math.random(),
      );
      membersToReply = shuffled.slice(0, settings.randomCount || 1);
      break;
    case "specific":
      membersToReply = activeTukeyGroup.members.filter((m) =>
        settings.specificMemberIds.includes(m.id),
      );
      break;
  }

  if (membersToReply.length === 0) {
    loadingEl.remove();
    console.warn("[记账AI] 没有找到需要回复的成员。");
    return;
  }

  // 构建给AI的指令 (Prompt)
  const recordsText = recordsToReply
    .map(
      (r) =>
        `- [${new Date(r.timestamp).toLocaleString()}] ${r.type === "expense" ? "Chi tiêu" : "Thu nhập"} ${r.amount.toFixed(
          2,
        )} tệ, phân loại: ${r.category}, ghi chú: ${r.remarks || "Không"}`,
    )
    .join("\n");

  // ... 在 triggerAccountingAiResponse 函数内部 ...

  const membersText = membersToReply
    .map((m) => `- ${m.name} (thiết lập: ${m.persona})`)
    .join("\n");

  // ▼▼▼ 用这整块新代码替换旧的 systemPrompt ▼▼▼
  const systemPrompt = `
# Vai trò
Bạn là AI nhập vai nhiều nhân vật, đang ở trong một nhóm chat ghi sổ.

# Thông tin người dùng (đây là người ghi hóa đơn)
- Tên người dùng: ${tukeyUserSettings.username}
- Nghề nghiệp: ${tukeyUserSettings.profession || "Chưa đặt"}

# Nhiệm vụ
Người dùng trong nhóm vừa ghi lại vài khoản dưới đây. Hãy dựa vào danh sách nhân vật được chỉ định bên dưới cùng thiết lập của họ, và thông tin nghề nghiệp của người dùng, tạo bình luận của từng người về các khoản này bằng tiếng Việt.

# Các khoản cần bình luận
${recordsText}

# Nhân vật bạn cần đóng (kèm thiết lập)
${membersText}

# Quy tắc trả lời
1.  Câu trả lời của bạn 【phải phù hợp nghiêm ngặt】 với thiết lập của từng nhân vật.
2.  Câu trả lời có thể kết hợp với 【nghề nghiệp】 của người dùng để bình luận, giúp cuộc trò chuyện chân thật hơn. Ví dụ, nếu người dùng là sinh viên, có thể nói "Sinh viên mà tiêu tiền hào phóng ghê"; nếu là dân văn phòng, có thể nói "Xem ra tháng này lương ổn ha".
3.  Câu trả lời của bạn 【bắt buộc】 là một mảng JSON, mỗi đối tượng đại diện cho bình luận của một nhân vật.
4.  【Quy tắc sắt về định dạng】: \`[{"charName": "tên nhân vật A", "comment": "nội dung bình luận của nhân vật A"}, {"charName": "tên nhân vật B", "comment": "nội dung bình luận của nhân vật B"}]\`
5.  Nội dung bình luận nên ngắn gọn, mang tính khẩu ngữ, như nhóm chat thật.

Bây giờ, hãy bắt đầu tạo bình luận.
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
      temperature,
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
            temperature: parseFloat(temperature) || 0.8,
            response_format: { type: "json_object" },
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
    const replies = JSON.parse(rawContent);

    if (Array.isArray(replies)) {
      // 为所有被评论的账单都添加这些回复
      for (const record of recordsToReply) {
        for (const reply of replies) {
          const member = activeTukeyGroup.members.find(
            (m) => m.name === reply.charName,
          );
          if (member && reply.comment) {
            await db.tukeyAccountingReplies.add({
              recordId: record.id,
              charId: member.id,
              charName: member.name,
              content: reply.comment,
              timestamp: Date.now(),
            });
          }
        }
      }

      // 【关键】将所有已回复的记录标记为 isRepliedTo: true
      const recordIdsToUpdate = recordsToReply.map((r) => r.id);
      await db.tukeyAccountingRecords
        .where("id")
        .anyOf(recordIdsToUpdate)
        .modify({ isRepliedTo: true });

      await renderTukeyRecordsList(); // 重新渲染，显示新回复
    }
  } catch (error) {
    console.error("生成记账回复失败:", error);
    await showCustomAlert("Tạo câu trả lời thất bại", `Có lỗi: ${error.message}`);
  } finally {
    // 无论成功失败，都移除加载提示
    loadingEl.remove();
  }
}
// ▲▲▲ 新增AI回复逻辑结束 ▲▲▲
// ▼▼▼ 在你的JS功能区添加下面这些全新的报表功能函数 ▼▼▼

/**
 * 【报表总入口】渲染报表主视图，填充筛选器并显示默认报表
 */
async function renderTukeyReportsView() {
  await populateReportFilters();
  // 默认显示“每日明细”
  document.getElementById("report-type-filter").value = "daily_details";
  handleReportFilterChange(); // 触发一次渲染
}

/**
 * 【辅助】填充报表的筛选器（账户、月份）
 */
async function populateReportFilters() {
  // 填充账户筛选器
  const accountSelect = document.getElementById("report-account-filter");
  const accounts = await db.tukeyAccounts.toArray();
  accountSelect.innerHTML = '<option value="all">Tất cả tài khoản</option>';
  accounts.forEach((acc) => {
    accountSelect.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
  });

  // 填充月份筛选器
  const monthSelect = document.getElementById("report-month-filter");
  const records = await db.tukeyAccountingRecords
    .orderBy("timestamp")
    .reverse()
    .toArray();
  const months = new Set();
  records.forEach((rec) => {
    const date = new Date(rec.timestamp);
    months.add(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  });

  monthSelect.innerHTML = "";
  months.forEach((month) => {
    monthSelect.innerHTML += `<option value="${month}">${month}</option>`;
  });
  // 如果没有记录，给一个默认当前月份
  if (months.size === 0) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthSelect.innerHTML = `<option value="${currentMonth}">${currentMonth}</option>`;
  }
}

/**
 * 【核心】处理筛选条件变化，并调用相应的报表渲染函数
 */
function handleReportFilterChange() {
  const reportType = document.getElementById("report-type-filter").value;
  const accountId = document.getElementById("report-account-filter").value;
  const monthValue = document.getElementById("report-month-filter").value;

  const dailyView = document.getElementById("daily-report-view");
  const monthlyView = document.getElementById("monthly-report-view");

  if (reportType === "daily_details") {
    dailyView.style.display = "block";
    monthlyView.style.display = "none";
    renderDailyDetailView(accountId === "all" ? null : parseInt(accountId));
  } else if (reportType === "monthly_summary") {
    dailyView.style.display = "none";
    monthlyView.style.display = "block";
    if (monthValue) {
      const [year, month] = monthValue.split("-");
      renderMonthlySummaryView(
        parseInt(year),
        parseInt(month),
        accountId === "all" ? null : parseInt(accountId),
      );
    }
  }
}

/**
 * 【渲染 - 美化版】每日明细视图 (精致的删除按钮)
 */
async function renderDailyDetailView(accountId) {
  const view = document.getElementById("daily-report-view");
  view.innerHTML = '<p class="report-placeholder">Đang tải chi tiết hằng ngày...</p>';

  let records;
  if (accountId) {
    records = await db.tukeyAccountingRecords
      .where({ accountId: accountId })
      .reverse()
      .sortBy("timestamp");
  } else {
    records = await db.tukeyAccountingRecords.reverse().sortBy("timestamp");
  }

  if (records.length === 0) {
    view.innerHTML = '<p class="report-placeholder">Không tìm thấy bản ghi sổ sách nào.</p>';
    return;
  }

  const recordsByDay = records.reduce((acc, rec) => {
    const day = new Date(rec.timestamp).toISOString().split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(rec);
    return acc;
  }, {});

  view.innerHTML = "";

  for (const day in recordsByDay) {
    const dayRecords = recordsByDay[day];
    let dailyIncome = 0;
    let dailyExpense = 0;

    let transactionsHtml = "";
    dayRecords.forEach((rec) => {
      if (rec.type === "income") dailyIncome += rec.amount;
      else dailyExpense += rec.amount;

      const categoryData = ACCOUNTING_CATEGORIES[rec.type].find(
        (c) => c.name === rec.category,
      );
      const categoryIcon = categoryData ? categoryData.icon : "";
      const recordTime = new Date(rec.timestamp);
      const timeString = `${String(recordTime.getHours()).padStart(2, "0")}:${String(
        recordTime.getMinutes(),
      ).padStart(2, "0")}`;

      // ▼▼▼ 找到 renderDailyDetailView 函数内的 forEach 循环，替换 transactionsHtml 生成部分 ▼▼▼

      transactionsHtml += `
    <div class="report-record-item">
<!-- thân bong bóng -->
        <div class="tukey-record-bubble ${rec.type}"> 
            <div class="record-main-row">
<!-- bên trái: biểu tượng và phân loại -->
                <div class="record-icon-wrapper">
                    <img src="${categoryIcon}" class="record-category-icon" alt="${rec.category}">
                </div>

<!-- ở giữa: tên phân loại và ghi chú -->
                <div class="record-info-col">
                    <div class="record-category-name">${rec.category}</div>
                    ${rec.remarks ? `<div class="record-remarks">${rec.remarks}</div>` : ""}
                    <div class="record-meta">
                        <span>${rec.accountName}</span> · <span>${timeString}</span>
                    </div>
                </div>

<!-- bên phải: số tiền -->
                <div class="record-amount-col">
                    <span class="record-amount">${rec.type === "expense" ? "-" : "+"}</span>
                    <span class="record-amount-num">${rec.amount.toFixed(2)}</span>
                </div>
            </div>
        </div>

<!-- nút xóa (hiện khi rê chuột) -->
<button class="delete-record-btn" data-id="${rec.id}" title="Xóa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    </div>
`;
      // ▲▲▲ 替换结束 ▲▲▲
    });

    const dayGroup = document.createElement("div");
    dayGroup.className = "report-day-group";
    dayGroup.innerHTML = `
            <div class="day-header">
                <span class="date">${day}</span>
                <span class="day-summary">
<span class="expense">Chi tiêu: ${dailyExpense.toFixed(2)}</span>
<span class="income">Thu nhập: ${dailyIncome.toFixed(2)}</span>
                </span>
            </div>
            <div class="transaction-list">${transactionsHtml}</div>
        `;
    view.appendChild(dayGroup);
  }
}

/**
 * 【全新】删除一条记账记录并回滚账户余额
 * @param {number} recordId - 要删除的记录ID
 */
async function deleteTukeyAccountingRecord(recordId) {
  // 1. 获取记录详情
  const record = await db.tukeyAccountingRecords.get(recordId);
  if (!record) {
    alert("Không tìm thấy bản ghi này, có thể đã bị xóa.");
    return;
  }

  // 2. 弹出确认框
  const confirmed = await showCustomConfirm(
    "Xác nhận xóa",
    `Bạn có chắc muốn xóa khoản ${record.type === "expense" ? "Chi tiêu" : "Thu nhập"} (¥${record.amount}) này?\nSau khi xóa, số dư của tài khoản liên quan sẽ tự động hoàn lại.`,
    { confirmButtonClass: "btn-danger" },
  );
  if (!confirmed) return;

  try {
    // 3. 回滚账户余额
    const account = await db.tukeyAccounts.get(record.accountId);
    if (account) {
      let currentBalance = parseFloat(account.balance);

      // 核心回滚逻辑：
      // 如果删的是支出(expense)，余额应该加回去 (+ amount)
      // 如果删的是收入(income)，余额应该减出来 (- amount)
      if (record.type === "expense") {
        // 特殊处理：如果是借入/信用账户，支出意味着欠款增加，删除支出意味着欠款减少（数值逻辑取决于您是如何存储的）
        // 根据您之前的 saveTukeyRecordFromCard 逻辑：
        // 资产账户：余额 = 余额 - 支出。 回滚：余额 + 支出
        // 信用账户：余额 = 余额 + 支出 (欠款变多)。 回滚：余额 - 支出

        const categoryInfo = ACCOUNT_STRUCTURE[account.category];
        // 检查是否是信用账户(isAsset === false) 或 借入账户
        if (
          (categoryInfo && categoryInfo.isAsset === false) ||
          account.type === "Vay vào"
        ) {
          // 信用账户之前是加了金额，现在要减去
          account.balance = currentBalance - record.amount;
        } else {
          // 普通资产账户之前是减了金额，现在要加回
          account.balance = currentBalance + record.amount;
        }
      } else {
        // 如果删的是收入/还款
        // 资产账户：余额 = 余额 + 收入。 回滚：余额 - 收入
        // 信用账户：余额 = 余额 - 收入 (还款)。 回滚：余额 + 收入
        const categoryInfo = ACCOUNT_STRUCTURE[account.category];
        if (
          (categoryInfo && categoryInfo.isAsset === false) ||
          account.type === "Vay vào"
        ) {
          account.balance = currentBalance + record.amount;
        } else {
          account.balance = currentBalance - record.amount;
        }
      }

      // 保存账户余额更新
      await db.tukeyAccounts.put(account);
    }

    // 4. 如果开启了桃宝同步，也要回滚桃宝余额
    if (tukeyUserSettings.syncWithTaobao) {
      // 逻辑取反：删支出=加钱，删收入=扣钱
      const reverseAmount =
        record.type === "expense" ? record.amount : -record.amount;
      await updateUserBalanceAndLogTransaction(
        reverseAmount,
        `[Hủy ghi sổ] ${record.category}`,
      );
    }

    // 5. 删除记录本身
    await db.tukeyAccountingRecords.delete(recordId);

    // 6. 删除关联的AI回复 (如果有)
    const replies = await db.tukeyAccountingReplies
      .where("recordId")
      .equals(recordId)
      .toArray();
    if (replies.length > 0) {
      const replyIds = replies.map((r) => r.id);
      await db.tukeyAccountingReplies.bulkDelete(replyIds);
    }

    // 7. 刷新界面
    await renderTukeyReportsView(); // 刷新报表
    // 如果记账群聊界面也在后台，可能需要标记刷新，这里暂只刷新当前报表

    alert("Đã xóa bản ghi, số dư đã được hoàn lại.");
  } catch (error) {
    console.error("删除账单失败:", error);
    alert(`Xóa thất bại: ${error.message}`);
  }
}

/**
 * 【渲染】月度统计视图
 */
async function renderMonthlySummaryView(year, month, accountId) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  let query = db.tukeyAccountingRecords
    .where("timestamp")
    .between(startDate.getTime(), endDate.getTime());
  if (accountId) {
    query = query.and((record) => record.accountId === accountId);
  }
  const records = await query.toArray();

  // 1. 计算月度总收支
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};
  const expenseByDay = {};

  records.forEach((rec) => {
    if (rec.type === "income") {
      totalIncome += rec.amount;
    } else {
      totalExpense += rec.amount;
      // 为饼图准备数据
      expenseByCategory[rec.category] =
        (expenseByCategory[rec.category] || 0) + rec.amount;
      // 为折线图准备数据
      const day = new Date(rec.timestamp).getDate();
      expenseByDay[day] = (expenseByDay[day] || 0) + rec.amount;
    }
  });

  document.getElementById("monthly-summary-card").innerHTML = `
        <div class="summary-item">
<span class="label">Tổng chi</span>
            <span class="value expense">¥ ${totalExpense.toFixed(2)}</span>
        </div>
        <div class="summary-item">
<span class="label">Tổng thu</span>
            <span class="value income">¥ ${totalIncome.toFixed(2)}</span>
        </div>
        <div class="summary-item">
<span class="label">Còn lại</span>
            <span class="value">¥ ${(totalIncome - totalExpense).toFixed(2)}</span>
        </div>
    `;

  // 2. 渲染饼图
  createCategoryPieChart(expenseByCategory);

  // 3. 渲染折线图
  createExpenditureLineChart(expenseByDay, endDate.getDate());
}

/**
 * 【图表】创建支出分类饼图
 */
function createCategoryPieChart(data) {
  const ctx = document.getElementById("category-pie-chart").getContext("2d");
  if (pieChartInstance) {
    pieChartInstance.destroy(); // 销毁旧图表实例
  }
  pieChartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(data),
      datasets: [
        {
          data: Object.values(data),
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
            "#C9CBCF",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed !== null) {
                label += new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "CNY",
                }).format(context.parsed);
              }
              return label;
            },
          },
        },
      },
    },
  });
}

/**
 * 【图表】创建月度支出折线图
 */
function createExpenditureLineChart(data, daysInMonth) {
  const ctx = document
    .getElementById("expenditure-line-chart")
    .getContext("2d");
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const chartData = labels.map((day) => data[day] || 0);

  if (lineChartInstance) {
    lineChartInstance.destroy();
  }
  lineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Chi tiêu hằng ngày",
          data: chartData,
          borderColor: "#F44336",
          backgroundColor: "rgba(244, 67, 54, 0.2)",
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "¥" + value;
            },
          },
        },
      },
    },
  });
}
