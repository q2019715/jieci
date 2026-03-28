/**
 * 文件说明：popup 页面最小装配入口。
 * 职责：创建运行上下文并启动 popup 应用引导流程。
 */
import { collectPopupElements } from './popup_js/app/elements.js';
import { bootstrapPopupApp } from './popup_js/app/bootstrap.js';

/**
 * 创建 popup 运行上下文。
 */
function createContext(doc = document) {
    return {
        document: doc,
        elements: collectPopupElements(doc)
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    const context = createContext(document);
    await bootstrapPopupApp(context);
});
