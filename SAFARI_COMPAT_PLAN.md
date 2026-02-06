# Safari 兼容性改造计划

## 概要

将 jieci Chrome 扩展改造为同时兼容 Chrome/Edge 和 Safari 的跨浏览器扩展。
Safari 15.4+ 支持 MV3 Web Extensions，核心改动集中在 API 命名空间统一和 WASM 降级处理。

## 分析来源

- Claude (LD) 代码扫描：81+ 处 chrome.* API 调用，3 处 callback 模式
- Codex 交叉验证：确认三大阻塞项判断准确，补充了 storage 限制和 module script 风险点

## 改动清单

### Phase 1: API 命名空间统一 [低风险, 机械替换]

**目标**：所有 `chrome.*` 调用替换为跨浏览器兼容写法

**方案**：在每个 JS 文件头部添加 polyfill shim：
```js
const api = globalThis.browser ?? globalThis.chrome;
```
> Codex Review 建议：使用 `globalThis` 比 `typeof` 检查更安全，避免非扩展环境下的 ReferenceError

**影响文件及替换数量**：
| 文件 | chrome.storage.local | chrome.runtime | chrome.tabs | chrome.storage.onChanged | 合计 |
|------|---------------------|----------------|-------------|-------------------------|------|
| content.js | 10 | 5 | 0 | 0 | 15 |
| background.js | 15 | 3 | 0 | 1 | 19 |
| popup.js | 43 | 3 | 5 | 0 | 51 |
| **总计** | **68** | **11** | **5** | **1** | **85** |

**注意**：
- `chrome.runtime.lastError` 检查需要保留兼容（Safari 的 browser API 通过 Promise rejection 报错，但 callback 模式下仍可能需要 lastError）
- `chrome.runtime?.getManifest` (popup.js:266) 使用了可选链，替换为 `api.runtime?.getManifest`

### Phase 2: Callback → Async/Await [低风险, 小改动]

**需要转换的 3 处 callback**：

1. **content.js:445-463** — `requestJiebaPayload()`
   - 当前：`chrome.runtime.sendMessage(msg, callback)`
   - 改为：`try { const response = await api.runtime.sendMessage(msg); } catch(e) { ... }`
   - 保留 lastError 兼容检查

2. **background.js:177-225** — `chrome.runtime.onMessage.addListener`
   - 当前：使用 `sendResponse` callback + `return true` 异步模式
   - 改为：保持现有模式（Chrome/Safari 都支持 sendResponse pattern in onMessage）
   - 注意：这个不需要改，`sendResponse` 是 onMessage 的标准模式

3. **popup.js:794-807** — `requestTabHost()`
   - 当前：`chrome.tabs.sendMessage(tabId, msg, callback)`
   - 改为：`try { const response = await api.tabs.sendMessage(tabId, msg); } catch(e) { ... }`

### Phase 3: manifest.json 更新 [中风险]

**改动项**：

1. **CSP 指令** — `wasm-unsafe-eval` 保留（WebKit 已实现，但可能仍有问题）
2. **background 声明** — 保持 `service_worker` + `type: "module"` 不变，要求 Safari 17+
   > ⚠️ Codex Review 指出：`background.scripts` 在 Chrome MV3 中是非法字段，Chrome 会拒绝加载。
   > 且 background.js 使用 ES module `import` 语法，若以 classic script 加载会 parse 失败。
   > 因此**不添加 `scripts` fallback**，直接依赖 Safari 17+ 的 service worker 支持。
3. **content_scripts.type** — 移除 `"module"`（content.js 无 import/export，无影响）

### Phase 4: WASM 加载降级 [高风险, 最大不确定性]

**现状**：background.js 通过 `chrome.runtime.getURL()` + `fetch()` + `initJieba()` 加载 WASM

**策略**：增强现有错误处理，确保 WASM 失败时优雅降级

1. `ensureJiebaReady()` 已有 `.catch()` 返回 null 的处理
2. `handleJiebaRequest()` 已有 mod 为 null 时返回 `jieba-unavailable` 的处理
3. content.js 中 `requestJiebaPayload()` 已处理 null 返回值

**额外需要做的**：
- 在 WASM 加载失败时，通过 console.warn 明确提示 Safari CSP 限制
- 确保中文分词功能降级不影响英文标注主流程

### Phase 5: 验证与测试

1. 运行 `xcrun safari-web-extension-converter` 生成 Xcode 项目
2. Xcode Build & Run 安装到 Safari
3. 验证英文标注主流程
4. 验证中文分词（WASM）是否工作
5. 验证 popup 设置面板
6. 验证 storage 读写

## 风险评估

| 项目 | 风险 | 说明 |
|------|------|------|
| API shim | 低 | 机械替换，逻辑不变 |
| Callback 转换 | 低 | 仅 2 处需要改 |
| manifest 更新 | 中 | Chrome 会忽略未知字段 |
| WASM/CSP | 高 | 可能需要 Safari 实测才能确定 |
| module scripts | 中 | Safari 可能不支持 content_scripts type:module |

## Codex 补充的额外注意点

- Safari 15.4 有 sync-storage 大小限制（本项目用 `unlimitedStorage` 权限，需验证 Safari 是否支持）
- `type: "module"` content scripts 在 Safari 中支持情况不明确，可能需要降级
- Safari 支持 `background.scripts` + `preferred_environment` 作为 service worker 的备选
