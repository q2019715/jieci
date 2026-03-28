// background_js/settings.js - 管理后台安装初始化与本地配置默认值。

import {buildChineseTrieIndex} from './trie.js';

const INSTALL_LOG_TEXT = '截词记忆已安装';
const SETTINGS_KEYS = [
    'displayMode',
    'displayModeChinese',
    'displayModeEnglish',
    'displayModeSplitByLanguage',
    'vocabularies',
    'vocabularyTrieIndex',
    'maxMatchesPerNode',
    'minTextLength',
    'annotationMode',
    'cnToEnOrder',
    'enToCnOrder',
    'disableAnnotationUnderline',
    'annotationWordCardPopupEnabled',
    'wordCardHighlightMatchedChinese',
    'speechVoiceURI',
    'highlightColorMode',
    'highlightColor',
    'siteBlockMode',
    'aiSimilarityThreshold',
    'aiProcessingDelay',
    'syncEnabled',
    'syncDirty',
    'syncLocalMeta',
    'syncDeviceId',
    'syncStatus'
];

// 在值为空或未定义时写入默认值。
async function setDefaultIfMissing(result, key, defaultValue) {
    if (result[key] === undefined || result[key] === null || result[key] === '') {
        await chrome.storage.local.set({[key]: defaultValue});
    }
}

// 安装时初始化默认设置并按需补建 Trie 索引。
export async function initializeOnInstalled() {
    console.log(INSTALL_LOG_TEXT);
    const result = await chrome.storage.local.get(SETTINGS_KEYS);

    if (!result.displayMode) {
        await chrome.storage.local.set({displayMode: 'off'});
    }
    if (!result.displayModeChinese) {
        await chrome.storage.local.set({displayModeChinese: result.displayMode || 'off'});
    }
    if (!result.displayModeEnglish) {
        await chrome.storage.local.set({displayModeEnglish: result.displayMode || 'off'});
    }
    if (result.displayModeSplitByLanguage === undefined) {
        await chrome.storage.local.set({displayModeSplitByLanguage: false});
    }
    if (!result.vocabularies) {
        await chrome.storage.local.set({vocabularies: []});
    }

    if (result.vocabularies && result.vocabularies.length > 0 && !result.vocabularyTrieIndex) {
        console.log('检测到词库但无Trie树索引，开始构建...');
        const trieIndex = buildChineseTrieIndex(result.vocabularies);
        await chrome.storage.local.set({vocabularyTrieIndex: trieIndex});
        console.log('Trie树索引构建完成');
    }

    await setDefaultIfMissing(result, 'maxMatchesPerNode', 3);
    await setDefaultIfMissing(result, 'minTextLength', 10);
    await setDefaultIfMissing(result, 'annotationMode', 'auto');
    await setDefaultIfMissing(result, 'speechVoiceURI', '');
    await setDefaultIfMissing(result, 'cnToEnOrder', 'source-first');
    await setDefaultIfMissing(result, 'enToCnOrder', 'source-first');

    if (result.disableAnnotationUnderline === undefined) {
        await chrome.storage.local.set({disableAnnotationUnderline: false});
    }
    if (result.annotationWordCardPopupEnabled === undefined) {
        await chrome.storage.local.set({annotationWordCardPopupEnabled: true});
    }
    if (result.wordCardHighlightMatchedChinese === undefined) {
        await chrome.storage.local.set({wordCardHighlightMatchedChinese: true});
    }

    await setDefaultIfMissing(result, 'highlightColorMode', 'none');
    await setDefaultIfMissing(result, 'highlightColor', '#2196f3');
    await setDefaultIfMissing(result, 'siteBlockMode', 'blacklist');

    if (result.aiSimilarityThreshold === undefined) {
        await chrome.storage.local.set({aiSimilarityThreshold: 0.25});
    }
    if (result.aiProcessingDelay === undefined) {
        await chrome.storage.local.set({aiProcessingDelay: 0});
    }

    if (result.syncEnabled === undefined) {
        await chrome.storage.local.set({syncEnabled: false});
    }
    if (result.syncDirty === undefined) {
        await chrome.storage.local.set({syncDirty: false});
    }
    if (result.syncLocalMeta === undefined) {
        await chrome.storage.local.set({
            syncLocalMeta: {
                domains: {
                    settings: {updatedAt: 0, deviceId: ''},
                    blockedWords: {updatedAt: 0, deviceId: ''},
                    favoriteWords: {updatedAt: 0, deviceId: ''},
                    siteBlockRules: {updatedAt: 0, deviceId: ''}
                }
            }
        });
    }
    if (result.syncDeviceId === undefined) {
        await chrome.storage.local.set({syncDeviceId: ''});
    }
    if (result.syncStatus === undefined) {
        await chrome.storage.local.set({
            syncStatus: {
                lastSyncAt: '',
                lastSyncStatus: 'idle',
                lastReason: '',
                lastError: '',
                lastUsageBytes: 0,
                lastAutoSyncAt: ''
            }
        });
    }
}

// 记录 storage.local 变更，便于排查用户配置问题。
export function logLocalStorageChanges(changes, namespace) {
    if (namespace === 'local') {
        console.log('存储已更新:', changes);
    }
}
