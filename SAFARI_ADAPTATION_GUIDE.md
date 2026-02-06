# 截词助手 — Safari 适配指南

## 1. 背景

截词助手原本是一个 Chrome/Edge 浏览器扩展（Manifest V3），使用纯 JavaScript 编写，无构建工具。Safari 从 15.4 版本开始支持基于 WebExtensions 标准的 MV3 扩展，因此具备适配的基础条件。

本文档记录了将截词助手从 Chrome 专属扩展改造为 Chrome/Edge/Safari 三端兼容扩展的完整过程。

---

## 2. 兼容性分析

### 2.1 无需改动的部分

以下 API 已有 fallback 或跨平台支持，不需要任何改动：

| API | 位置 | 说明 |
|-----|------|------|
| `requestIdleCallback` | content.js:3219 | 已有 `setTimeout` fallback |
| `Intl.Segmenter` | content.js:236 | 有 null 检测，Safari 16.4+ 支持 |
| `SpeechSynthesis` | content.js:1318 | 有 `canSpeakWord()` 检测 |
| `MutationObserver` | content.js | 全平台支持 |
| `history.pushState` 拦截 | content.js:2795 | 标准 Web API |
| `WebAssembly` | vendor/ | 有 streaming/非 streaming fallback |

### 2.2 需要改动的三大阻塞项

**阻塞项 1：`chrome.*` → 跨浏览器 API 命名空间**

Safari Web Extension 使用标准 `browser.*` 命名空间（返回 Promise），也部分兼容 `chrome.*`，但行为不完全一致。全代码库共 85 处 `chrome.*` API 调用：

| 文件 | `chrome.storage` | `chrome.runtime` | `chrome.tabs` | 合计 |
|------|-----------------|------------------|---------------|------|
| content.js | 10 | 5 | 0 | 15 |
| background.js | 16 | 3 | 0 | 19 |
| popup.js | 43 | 3 | 5 | 51 |
| **总计** | **69** | **11** | **5** | **85** |

**阻塞项 2：Callback / Promise 混用**

Safari 的 `browser.*` API 统一返回 Promise，而代码中有 2 处使用了 callback 模式：

- `content.js` — `requestJiebaPayload()` 使用 `chrome.runtime.sendMessage(msg, callback)`
- `popup.js` — `requestTabHost()` 使用 `chrome.tabs.sendMessage(tabId, msg, callback)`

**阻塞项 3：WASM + CSP**

`manifest.json` 中的 `wasm-unsafe-eval` 是加载 jieba-rs WASM 所必需的 CSP 指令。WebKit 已实现该指令，但在 Safari Web Extension 中可能仍有限制。这是最大的运行时风险点。

---

## 3. 核心代码改动

### 3.1 跨浏览器 API Shim

在 `background.js`、`content.js`、`popup.js` 三个文件头部各添加一行 shim：

```js
// 跨浏览器 API 兼容 shim (Chrome/Edge 用 chrome.*, Safari 用 browser.*)
const api = globalThis.browser ?? globalThis.chrome;
```

然后将所有 `chrome.storage.local`、`chrome.runtime`、`chrome.tabs` 替换为 `api.storage.local`、`api.runtime`、`api.tabs`。

使用 `globalThis` 而非 `typeof browser !== 'undefined'` 是因为前者在非扩展环境下不会抛出 `ReferenceError`，更安全。

**Chrome/Edge 向后兼容**：在 Chrome 中 `globalThis.browser` 为 `undefined`，`??` 运算符回退到 `globalThis.chrome`，行为完全不变。

### 3.2 Callback → Async/Await

**content.js — `requestJiebaPayload()`**

```js
// 改前：callback 模式
function requestJiebaPayload(messageType, text, resultKey) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            resolve(null);
            return;
        }
        chrome.runtime.sendMessage({type: messageType, text}, (response) => {
            if (chrome.runtime.lastError) {
                diagLog('[jieba]', messageType, 'failed:', chrome.runtime.lastError);
                resolve(null);
                return;
            }
            if (!response || !response.ok || !Array.isArray(response[resultKey])) {
                resolve(null);
                return;
            }
            resolve(response[resultKey]);
        });
    });
}

// 改后：async/await 模式
async function requestJiebaPayload(messageType, text, resultKey) {
    if (!api.runtime || !api.runtime.sendMessage) {
        return null;
    }
    try {
        const response = await api.runtime.sendMessage({type: messageType, text});
        if (!response || !response.ok || !Array.isArray(response[resultKey])) {
            return null;
        }
        return response[resultKey];
    } catch (e) {
        diagLog('[jieba]', messageType, 'failed:', e);
        return null;
    }
}
```

**popup.js — `requestTabHost()`**

```js
// 改前
const requestTabHost = (tabId) => {
    return new Promise((resolve) => {
        if (tabId == null) { resolve(''); return; }
        chrome.tabs.sendMessage(tabId, {action: 'getPageHost'}, (response) => {
            if (chrome.runtime.lastError) { resolve(''); return; }
            resolve(response && response.host ? response.host : '');
        });
    });
};

// 改后
const requestTabHost = async (tabId) => {
    if (tabId == null) { return ''; }
    try {
        const response = await api.tabs.sendMessage(tabId, {action: 'getPageHost'});
        return response && response.host ? response.host : '';
    } catch (e) { return ''; }
};
```

### 3.3 `manifest.json` 更新

```diff
  "content_scripts": [{
      ...
-     "run_at": "document_idle",
-     "type": "module"
+     "run_at": "document_idle"
  }],
```

- **移除 `content_scripts` 的 `"type": "module"`** — `content.js` 没有使用任何 ES module 语法（无 `import`/`export`），移除后不影响功能，且避免 Safari 的兼容问题。
- **保留 `background` 的 `"type": "module"`** — `background.js` 使用了 `import initJieba from './vendor/jieba_rs_wasm.js'`，必须以 ES module 模式加载。
- **不添加 `background.scripts` fallback** — Chrome MV3 中 `background.scripts` 是非法字段，会导致整个 manifest 被拒绝。且 `background.js` 的 ES module `import` 语法在 classic script 模式下会 parse 失败。Safari 17+ 已支持 module service worker。

### 3.4 WASM 加载降级增强

`background.js` 中 `ensureJiebaReady()` 增强了错误处理：

```js
// WASM 加载失败时的处理
}).catch((error) => {
    // Safari Web Extension 中 wasm-unsafe-eval CSP 可能不被支持，
    // 此时中文分词功能不可用，但英文标注主流程不受影响
    console.warn('[jieba] WASM initialization failed (Chinese segmentation unavailable):',
        error.message || error);
    jiebaModule = null;
    jiebaReady = null; // 允许后续重试
    return null;
});
```

- 将 `console.error` 改为 `console.warn`，明确标识这是降级而非致命错误
- `jiebaReady = null` 允许后续重试（例如 Safari 更新修复了 CSP 限制后）
- 中文分词不可用时，英文标注主流程完全不受影响

### 3.5 未修改的部分

- `background.js` 的 `onMessage.addListener` + `sendResponse` + `return true` 异步模式 — Safari 兼容此标准模式
- `content.js` 的 `onMessage.addListener` + `sendResponse` — 同上
- CSP 中的 `wasm-unsafe-eval` — WebKit 已实现，保留

---

## 4. 改动文件总览

| 文件 | 改动量 | 改动内容 |
|------|--------|---------|
| `manifest.json` | 7 行 | 移除 content_scripts 的 `type: "module"` |
| `background.js` | 108 行 | shim + 19 处 API 替换 + WASM 降级增强 |
| `content.js` | 643 行 | shim + 15 处 API 替换 + callback→async |
| `popup.js` | 1854 行 | shim + 51 处 API 替换 + callback→async |

注：行数差异中大部分是空白符变化（编辑器格式化），实际逻辑改动很少。

---

## 5. 编译步骤

### 5.1 环境要求

- **macOS** — Safari 扩展只能在 macOS 上开发和运行
- **Xcode** — 需要安装完整的 Xcode（非仅 Command Line Tools）
- **Safari 17+** — 需要 module service worker 支持

### 5.2 生成 Xcode 项目

```bash
xcrun safari-web-extension-converter /path/to/jieci \
    --project-location /path/to/output/jieci-safari \
    --app-name "截词助手" \
    --bundle-identifier com.jieci.safari-extension \
    --macos-only \
    --no-open \
    --no-prompt
```

参数说明：
- `--project-location` — Xcode 项目输出目录
- `--app-name` — macOS app 显示名称
- `--bundle-identifier` — app 唯一标识符
- `--macos-only` — 仅生成 macOS 版本（不含 iOS）
- `--no-open` — 不自动打开 Xcode
- `--no-prompt` — 不弹出交互确认

### 5.3 修复 Bundle Identifier

转换器对中文 app 名称处理有 bug，会将父 app 的 bundle identifier 生成为 `com.jieci.----`。需要手动修复：

打开 Xcode 项目文件（或用文本编辑器编辑 `project.pbxproj`），将所有：

```
PRODUCT_BUNDLE_IDENTIFIER = "com.jieci.----";
```

替换为：

```
PRODUCT_BUNDLE_IDENTIFIER = "com.jieci.safari-extension";
```

确保父 app 的 bundle identifier 是扩展 bundle identifier（`com.jieci.safari-extension.Extension`）的前缀。

### 5.4 编译

**方式一：命令行**

```bash
xcodebuild \
    -project "/path/to/jieci-safari/截词助手/截词助手.xcodeproj" \
    -scheme "截词助手" \
    -configuration Debug \
    build
```

编译产物位于：
```
~/Library/Developer/Xcode/DerivedData/截词助手-*/Build/Products/Debug/截词助手.app
```

**方式二：Xcode GUI**

1. 用 Xcode 打开 `截词助手.xcodeproj`
2. 左上角选择 scheme "截词助手"，target 为 "My Mac"
3. 点击运行按钮（或 `Cmd+R`）

### 5.5 启动

```bash
open ~/Library/Developer/Xcode/DerivedData/截词助手-*/Build/Products/Debug/截词助手.app
```

---

## 6. 在 Safari 中使用

### 6.1 启用开发者模式

首次使用未签名的扩展，需要启用开发者选项：

1. 打开 **Safari → 设置 → 高级**
2. 勾选 **"在菜单栏中显示'开发'菜单"**
3. 菜单栏点击 **开发 → 允许未签名的扩展**（每次重启 Safari 后需要重新勾选）

### 6.2 启用扩展

1. 打开 **Safari → 设置 → 扩展**
2. 找到 **"截词助手"**，勾选启用
3. 在权限中选择 **"在所有网站上始终允许"**（或按需选择具体网站）

### 6.3 使用

- 点击 Safari 工具栏中的截词助手图标，打开设置面板
- 选择显示模式（关闭 / 下划线 / 标注）
- 下载或导入词库
- 打开任意网页，扩展会自动标注匹配的词汇

### 6.4 调试

如果扩展行为异常：

1. **开发 → Web 扩展后台页面 → 截词助手** — 查看 background service worker 的控制台日志
2. **开发 → 当前网页的 Web 检查器** — 查看 content script 的控制台日志
3. 关注 `[jieba]` 开头的日志，确认 WASM 是否加载成功

---

## 7. 已知限制

### 7.1 WASM / 中文分词

Safari Web Extension 中 `wasm-unsafe-eval` CSP 指令的支持不完全稳定。如果 WASM 加载失败：

- 控制台会输出 `[jieba] WASM initialization failed (Chinese segmentation unavailable)`
- **中文→英文标注模式**可能无法使用（依赖 jieba 分词）
- **英文→中文标注模式**完全不受影响

### 7.2 最低版本要求

| 浏览器 | 最低版本 | 原因 |
|--------|---------|------|
| Chrome | 88+ | MV3 + Promise-based API |
| Safari | 17+ | module service worker 支持 |
| Edge | 88+ | 与 Chrome 相同（Chromium 内核） |

### 7.3 `unlimitedStorage` 权限

Safari 可能忽略 `unlimitedStorage` 权限。如果词库数据量很大，可能受到 Safari 的存储配额限制。实际使用中，常规词库体积一般不会触及限制。

### 7.4 代码签名

通过 Xcode 本地编译的扩展使用 "Sign to Run Locally" 签名，仅在当前 Mac 上可用。每次重启 Safari 后需要重新在「开发」菜单中允许未签名扩展。如需分发给其他用户，需要 Apple Developer 账号进行正式签名。

---

## 8. 后续维护

由于代码改动仅涉及 API 命名空间替换和 2 处 callback→async 转换，改造后的代码**同时兼容 Chrome/Edge 和 Safari**，无需维护两套代码。日常开发仍然以 Chrome 为主开发/调试，定期在 Safari 中验证即可。

如需重新生成 Safari 版本（例如代码更新后），重复执行第 5 节的编译步骤。Xcode 项目通过相对路径引用源代码目录，源码更新后直接重新编译即可，不需要重新运行 converter。
