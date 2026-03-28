/**
 * 文件说明：wordinfo 模块初始化入口。
 */
import { bindWordInfoEvents } from './bind.js';
import { renderWordInfo } from './render.js';
import { previewSpeech } from '../word-card-settings/service.js';
import { buildEnglishTrieIndex } from '../../shared/tools/trie.js';

const WORDINFO_PHRASES_EXPANDED_KEY = 'wordInfoPhrasesExpanded';
const WORDINFO_EXAMPLES_EXPANDED_KEY = 'wordInfoExamplesExpanded';

export function initWordInfoFeature({
    elements,
    actions
}) {
    let currentWord = '';
    let currentEntry = null;
    let backTarget = 'main';
    let favoriteWordsSet = new Set();
    let blockedWordsSet = new Set();
    let sectionExpanded = {
        phrases: true,
        examples: true
    };

    function normalizeWord(word) {
        return String(word || '').trim().toLowerCase();
    }

    function getWordActions() {
        const normalized = normalizeWord(currentWord);
        return {
            isFavorite: normalized ? favoriteWordsSet.has(normalized) : false,
            isBlocked: normalized ? blockedWordsSet.has(normalized) : false
        };
    }

    async function loadWordActionState() {
        try {
            const result = await chrome.storage.local.get(['favoriteWords', 'blockedWords']);
            favoriteWordsSet = new Set(
                Array.isArray(result.favoriteWords)
                    ? result.favoriteWords.map(normalizeWord).filter(Boolean)
                    : []
            );
            blockedWordsSet = new Set(
                Array.isArray(result.blockedWords)
                    ? result.blockedWords.map(normalizeWord).filter(Boolean)
                    : []
            );
        } catch {
            favoriteWordsSet = new Set();
            blockedWordsSet = new Set();
        }
    }

    function buildExternalSearchUrl(provider, query) {
        const safeQuery = String(query || '').trim();
        const encodedQuery = encodeURIComponent(safeQuery);
        const slugWord = safeQuery.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        if (provider === 'bing') {
            return `https://www.bing.com/dict/search?q=${encodedQuery}`;
        }
        if (provider === 'cambridge') {
            return `https://dictionary.cambridge.org/zhs/spellcheck/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/?q=${encodedQuery}`;
        }
        if (provider === 'collins') {
            if (slugWord) {
                return `https://www.collinsdictionary.com/dictionary/english/${slugWord}`;
            }
            return `https://www.collinsdictionary.com/search/?dictCode=english&q=${encodedQuery}`;
        }
        return `https://www.youdao.com/result?word=${encodedQuery}&lang=en`;
    }

    async function getSearchProvider() {
        try {
            const result = await chrome.storage.local.get(['searchProvider']);
            return String(result && result.searchProvider || 'youdao');
        } catch {
            return 'youdao';
        }
    }

    function repaintCurrentWordInfo() {
        renderWordInfo(elements, currentEntry, {
            onSpeakText: speakText,
            wordActions: getWordActions()
        });
        applySectionExpandedState();
    }

    function getSectionMeta(sectionName) {
        if (sectionName === 'phrases') {
            return {
                content: elements.wordInfoPhrases,
                storageKey: WORDINFO_PHRASES_EXPANDED_KEY,
                label: '短语'
            };
        }
        if (sectionName === 'examples') {
            return {
                content: elements.wordInfoExamples,
                storageKey: WORDINFO_EXAMPLES_EXPANDED_KEY,
                label: '例句'
            };
        }
        return null;
    }

    function applySectionExpandedState() {
        ['phrases', 'examples'].forEach((sectionName) => {
            const meta = getSectionMeta(sectionName);
            if (!meta || !meta.content || typeof meta.content.closest !== 'function') {
                return;
            }
            const section = meta.content.closest('.wordinfo-section');
            if (!section) {
                return;
            }
            const title = section.querySelector('.wordinfo-section-title');
            const expanded = sectionExpanded[sectionName] !== false;
            section.classList.toggle('is-collapsed', !expanded);
            if (title) {
                title.classList.add('wordinfo-section-toggle');
                title.setAttribute('role', 'button');
                title.setAttribute('tabindex', '0');
                title.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                title.setAttribute('aria-label', `${expanded ? '收起' : '展开'}${meta.label}`);
            }
        });
    }

    async function loadSectionExpandedState() {
        try {
            const result = await chrome.storage.local.get([
                WORDINFO_PHRASES_EXPANDED_KEY,
                WORDINFO_EXAMPLES_EXPANDED_KEY
            ]);
            sectionExpanded.phrases = result[WORDINFO_PHRASES_EXPANDED_KEY] !== false;
            sectionExpanded.examples = result[WORDINFO_EXAMPLES_EXPANDED_KEY] !== false;
        } catch {
            sectionExpanded.phrases = true;
            sectionExpanded.examples = true;
        }
    }

    async function toggleSectionExpanded(sectionName) {
        const meta = getSectionMeta(sectionName);
        if (!meta) {
            return;
        }
        const current = sectionExpanded[sectionName] !== false;
        const next = !current;
        sectionExpanded[sectionName] = next;
        applySectionExpandedState();
        try {
            await chrome.storage.local.set({
                [meta.storageKey]: next
            });
        } catch {
            // ignore storage failures and keep in-memory state
        }
    }

    function setupSectionToggle(sectionName) {
        const meta = getSectionMeta(sectionName);
        if (!meta || !meta.content || typeof meta.content.closest !== 'function') {
            return;
        }
        const section = meta.content.closest('.wordinfo-section');
        if (!section) {
            return;
        }
        const title = section.querySelector('.wordinfo-section-title');
        if (!title) {
            return;
        }
        title.addEventListener('click', () => {
            void toggleSectionExpanded(sectionName);
        });
        title.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            void toggleSectionExpanded(sectionName);
        });
    }

    function detectSpeechLang(text) {
        if (/[\u4e00-\u9fff]/.test(String(text || ''))) {
            return 'zh-CN';
        }
        return 'en-US';
    }

    async function speakText(text) {
        const safeText = String(text || '').trim();
        if (!safeText) {
            return;
        }
        if (typeof speechSynthesis !== 'undefined' && typeof speechSynthesis.getVoices === 'function') {
            const voices = speechSynthesis.getVoices();
            if (!Array.isArray(voices) || voices.length === 0) {
                speechSynthesis.getVoices();
            }
        }
        let speechVoiceURI = '';
        try {
            const result = await chrome.storage.local.get(['speechVoiceURI']);
            speechVoiceURI = String(result && result.speechVoiceURI || '');
        } catch {
            speechVoiceURI = '';
        }
        previewSpeech(safeText, detectSpeechLang(safeText), speechVoiceURI);
    }

    async function speakCurrentWord() {
        const text = String(currentWord || '').trim();
        if (!text) {
            return;
        }
        await speakText(text);
    }

    async function searchCurrentWordOutside() {
        const text = String(currentWord || '').trim();
        if (!text) {
            return;
        }
        const provider = await getSearchProvider();
        const url = buildExternalSearchUrl(provider, text);
        actions.openExternalUrl(url);
    }

    async function toggleFavoriteCurrentWord() {
        const normalized = normalizeWord(currentWord);
        if (!normalized) {
            return;
        }
        if (favoriteWordsSet.has(normalized)) {
            favoriteWordsSet.delete(normalized);
        } else {
            favoriteWordsSet.add(normalized);
        }
        const words = Array.from(favoriteWordsSet).sort();
        await chrome.storage.local.set({ favoriteWords: words });
        if (typeof actions.notifyFavoriteWordsUpdated === 'function') {
            await actions.notifyFavoriteWordsUpdated(words);
        }
        repaintCurrentWordInfo();
    }

    async function blockCurrentWord() {
        const normalized = normalizeWord(currentWord);
        if (!normalized) {
            return;
        }
        if (blockedWordsSet.has(normalized)) {
            blockedWordsSet.delete(normalized);
        } else {
            blockedWordsSet.add(normalized);
        }
        const words = Array.from(blockedWordsSet).sort();
        const trieIndex = buildEnglishTrieIndex(words);
        await chrome.storage.local.set({
            blockedWords: words,
            blockedWordsTrieIndex: trieIndex
        });
        if (typeof actions.notifyBlockedWordsUpdated === 'function') {
            await actions.notifyBlockedWordsUpdated(words, trieIndex);
        }
        repaintCurrentWordInfo();
    }

    bindWordInfoEvents({
        elements,
        actions: {
            goBackToSearch: () => {
                currentWord = '';
                currentEntry = null;
                renderWordInfo(elements, null);
                applySectionExpandedState();
                actions.navigateBack(backTarget);
            },
            speakCurrentWord,
            searchCurrentWordOutside,
            toggleFavoriteCurrentWord,
            blockCurrentWord
        }
    });

    setupSectionToggle('phrases');
    setupSectionToggle('examples');
    void loadSectionExpandedState().then(() => {
        applySectionExpandedState();
    });

    renderWordInfo(elements, null, {
        onSpeakText: speakText,
        wordActions: getWordActions()
    });
    applySectionExpandedState();

    async function openWordInfo(entry, options = {}) {
        currentWord = entry && entry.word ? String(entry.word).trim() : '';
        currentEntry = entry || null;
        backTarget = String(options.backTarget || 'main');
        await loadWordActionState();
        repaintCurrentWordInfo();
    }

    return {
        openWordInfo
    };
}
