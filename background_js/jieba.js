// background_js/jieba.js - 管理 jieba wasm 初始化与分词/词性请求处理。

import initJieba, * as jieba from '../vendor/jieba_rs_wasm.js';

const JIEBA_ERROR_UNAVAILABLE = 'jieba-unavailable';
const JIEBA_ERROR_FAILED = 'jieba-failed';

let jiebaReady = null;

// 确保 jieba wasm 模块已初始化并可用于分词/词性调用。
async function ensureJiebaReady() {
    if (jiebaReady) {
        return jiebaReady;
    }

    const wasmUrl = chrome.runtime.getURL('vendor/jieba_rs_wasm_bg.wasm');
    jiebaReady = (async () => {
        const resp = await fetch(wasmUrl);
        const bytes = await resp.arrayBuffer();
        await initJieba({module_or_path: bytes});
        return jieba;
    })().catch((error) => {
        console.error('Failed to initialize jieba-wasm in background:', error);
        return null;
    });

    return jiebaReady;
}

// 统一处理 jieba 消息并将结果写入指定响应键。
function handleJiebaRequest(message, sendResponse, execute, resultKey) {
    if (typeof message.text !== 'string' || message.text.length === 0) {
        sendResponse({ok: true, [resultKey]: []});
        return true;
    }

    (async () => {
        const mod = await ensureJiebaReady();
        if (!mod) {
            sendResponse({ok: false, error: JIEBA_ERROR_UNAVAILABLE});
            return;
        }

        try {
            const result = execute(mod, message.text);
            sendResponse({ok: true, [resultKey]: result});
        } catch (error) {
            console.error('[jieba]', message.type, 'failed:', error);
            sendResponse({ok: false, error: JIEBA_ERROR_FAILED});
        }
    })();

    return true;
}

// 处理中文分词消息。
export function handleJiebaTokenize(message, sendResponse) {
    return handleJiebaRequest(
        message,
        sendResponse,
        (mod, text) => mod.tokenize(text, 'default', true),
        'tokens'
    );
}

// 处理词性标注消息。
export function handleJiebaTag(message, sendResponse) {
    return handleJiebaRequest(
        message,
        sendResponse,
        (mod, text) => mod.tag(text, true),
        'tags'
    );
}
