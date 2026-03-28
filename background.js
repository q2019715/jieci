// background.js - 后台服务入口，负责监听注册与消息路由分发。

import {initializeOnInstalled, logLocalStorageChanges} from './background_js/settings.js';
import {handleJiebaTag, handleJiebaTokenize} from './background_js/jieba.js';
import {
    analyzeBatchWithAIBackground,
    analyzeWithAIBackground,
    getAIDownloadStatus,
    getAIModelStatus,
    runAIBenchmark,
    startCloudModelDownload,
    uninstallCloudModel
} from './background_js/ai.js';
import {
    getSyncOverview,
    handleLocalStorageChangedForSync,
    pullSyncDataToLocal,
    pushLocalDataToSync,
    restoreSyncConflictBackup,
    setSyncEnabled,
    triggerStartupSync
} from './background_js/sync.js';

// 处理扩展安装事件并初始化默认配置。
function handleRuntimeInstalled() {
    initializeOnInstalled().catch((error) => {
        console.error('[background] onInstalled failed:', error);
    });
}

// 处理单条 AI 分析消息。
function handleAIAnalyzeRequest(message, sendResponse) {
    (async () => {
        try {
            const result = await analyzeWithAIBackground(message);
            sendResponse({ok: true, result});
        } catch (error) {
            console.error('[AI-bg] analyze failed:', error);
            sendResponse({ok: false, error: 'ai-failed'});
        }
    })();
    return true;
}

// 处理批量 AI 分析消息。
function handleAIBatchAnalyzeRequest(message, sendResponse) {
    (async () => {
        try {
            const result = await analyzeBatchWithAIBackground(message);
            sendResponse({ok: true, result});
        } catch (error) {
            console.error('[AI-bg] batch analyze failed:', error);
            sendResponse({ok: false, error: 'ai-batch-failed'});
        }
    })();
    return true;
}

// 处理 AI 模型状态查询消息。
function handleAIModelStatusRequest(message, sendResponse) {
    (async () => {
        try {
            const status = await getAIModelStatus(message.infoUrl);
            sendResponse({ok: true, status});
        } catch (error) {
            sendResponse({ok: false, error: String(error)});
        }
    })();
    return true;
}

// 处理云模型卸载消息。
function handleAIUninstallRequest(sendResponse) {
    uninstallCloudModel().then(() => {
        sendResponse({ok: true});
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 处理 AI 基准测试消息。
function handleAIBenchmarkRequest(message, sendResponse) {
    runAIBenchmark(message).then((result) => {
        sendResponse({ok: true, result});
    }).catch((error) => {
        sendResponse({ok: false, error: error && error.message ? error.message : String(error)});
    });
    return true;
}

// 处理同步开关更新消息。
function handleSyncToggleRequest(message, sendResponse) {
    setSyncEnabled(message && message.enabled === true).then((result) => {
        sendResponse({ok: true, ...result});
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 处理立即推送同步消息。
function handleSyncPushNowRequest(sendResponse) {
    pushLocalDataToSync('manual').then((result) => {
        sendResponse(result);
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 处理立即从云端加载消息。
function handleSyncPullNowRequest(sendResponse) {
    pullSyncDataToLocal('manual-pull').then((result) => {
        sendResponse(result);
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 处理同步概览查询消息。
function handleSyncOverviewRequest(sendResponse) {
    getSyncOverview().then((overview) => {
        sendResponse({ok: true, overview});
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 处理冲突备份恢复请求。
function handleSyncConflictRestoreRequest(sendResponse) {
    restoreSyncConflictBackup('manual-restore').then((result) => {
        sendResponse(result);
    }).catch((error) => {
        sendResponse({ok: false, error: String(error)});
    });
    return true;
}

// 统一分发 runtime 消息到对应功能模块。
function handleRuntimeMessage(message, sender, sendResponse) {
    void sender;

    if (!message) {
        return false;
    }

    if (message.type === 'jieba-tokenize') {
        return handleJiebaTokenize(message, sendResponse);
    }

    if (message.type === 'jieba-tag') {
        return handleJiebaTag(message, sendResponse);
    }

    if (message.type === 'ai-analyze') {
        return handleAIAnalyzeRequest(message, sendResponse);
    }

    if (message.type === 'ai-analyze-batch') {
        return handleAIBatchAnalyzeRequest(message, sendResponse);
    }

    if (message.type === 'ai-model-status') {
        return handleAIModelStatusRequest(message, sendResponse);
    }

    if (message.type === 'ai-download-status') {
        sendResponse({ok: true, status: getAIDownloadStatus()});
        return true;
    }

    if (message.type === 'ai-download-cloud-model') {
        startCloudModelDownload(message.infoUrl).then(() => {
            // no-op
        }).catch(() => {
            // 状态里会带 error
        });
        sendResponse({ok: true});
        return true;
    }

    if (message.type === 'ai-uninstall-cloud-model') {
        return handleAIUninstallRequest(sendResponse);
    }

    if (message.type === 'ai-benchmark') {
        return handleAIBenchmarkRequest(message, sendResponse);
    }

    if (message.type === 'sync-toggle') {
        return handleSyncToggleRequest(message, sendResponse);
    }

    if (message.type === 'sync-push-now') {
        return handleSyncPushNowRequest(sendResponse);
    }

    if (message.type === 'sync-pull-now') {
        return handleSyncPullNowRequest(sendResponse);
    }

    if (message.type === 'sync-overview') {
        return handleSyncOverviewRequest(sendResponse);
    }

    if (message.type === 'sync-conflict-restore') {
        return handleSyncConflictRestoreRequest(sendResponse);
    }

    return false;
}

// 注册后台监听器。
function registerBackgroundListeners() {
    chrome.runtime.onInstalled.addListener(handleRuntimeInstalled);
    chrome.storage.onChanged.addListener(logLocalStorageChanges);
    chrome.storage.onChanged.addListener(handleLocalStorageChangedForSync);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

registerBackgroundListeners();
triggerStartupSync();

// SPA navigation is handled inside the page (content script) to avoid webNavigation permission.
