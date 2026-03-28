/**
 * 文件作用：
 * 该文件是 content.js 的 tooltip 子模块入口（非 ESModule 版本）。
 * 通过 window.JieciTooltip 暴露能力，供普通 content script 直接调用。
 */
(function initJieciTooltipGlobal(global) {
/**
 * 文件作用：
 * 管理内容脚本中的 tooltip 通用能力（状态、显示/隐藏、定位、拖拽、缩放、事件监听）。
 * 对外暴露统一控制器，业务层只需提供内容渲染函数和少量状态读写依赖。
 */

const WORD_CARD_POPUP_SIZE_STORAGE_KEY = 'wordCardPopupSize';
const TOOLTIP_SIZE_DEFAULT = {width: 360, height: 280};
const TOOLTIP_SIZE_MIN = {width: 260, height: 200};
const TOOLTIP_SIZE_MAX = {width: 600, height: 480};
const TOOLTIP_HIDE_DELAY_MS = 100;

/**
 * 作用：创建 tooltip 控制器并注入外部依赖。
 * 输入：deps（外部状态读写与回调函数集合）
 * 输出：tooltip 控制器对象
 */
function createTooltipController(deps) {
    let globalTooltip = null;
    let globalTooltipOwner = null;
    let isTooltipVisible = false;
    let globalTooltipHideTimer = null;
    let tooltipListenersAttached = false;
    let isHoveringHighlight = false;
    let isHoveringTooltip = false;
    let isTooltipPinned = false;
    let isTooltipDragging = false;
    let tooltipDragOffset = null;
    let tooltipManualPositioned = false;
    let pointerTrackerAttached = false;
    let lastPointerPosition = null;
    let tooltipResizeState = null;
    let tooltipSizeSaveTimer = null;
    let tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
    let docMouseMoveHandler = null;
    let docMouseLeaveHandler = null;
    let docDragMoveHandler = null;
    let docDragUpHandler = null;
    let voicesReadyPromise = null;
    let currentSpeakText = '';
    let isSpeaking = false;
    let speakToken = 0;
    let speechVoiceURI = '';
    let searchProvider = 'youdao';

    /**
     * 作用：判断元素是否处于 hover 状态。
     * 输入：element
     * 输出：是否 hover
     */
    function isElementHovered(element) {
        if (!element || !element.isConnected) {
            return false;
        }
        try {
            return element.matches(':hover');
        } catch {
            return false;
        }
    }

    /**
     * 作用：判断当前环境是否支持浏览器语音朗读能力。
     * 输入：无
     * 输出：是否支持语音
     */
    function canSpeakWord() {
        return typeof window !== 'undefined'
            && 'speechSynthesis' in window
            && typeof window.SpeechSynthesisUtterance === 'function';
    }

    /**
     * 作用：停止当前所有语音播放并清理语音状态。
     * 输入：无
     * 输出：无
     */
    function stopSpeaking() {
        if (!canSpeakWord()) {
            return;
        }
        window.speechSynthesis.cancel();
        isSpeaking = false;
        currentSpeakText = '';
    }

    /**
     * 作用：等待浏览器语音列表准备完成（首轮获取语音时可能为空）。
     * 输入：无
     * 输出：Promise
     */
    function waitForVoices() {
        if (!canSpeakWord()) {
            return Promise.resolve();
        }
        if (window.speechSynthesis.getVoices().length > 0) {
            return Promise.resolve();
        }
        if (voicesReadyPromise) {
            return voicesReadyPromise;
        }
        voicesReadyPromise = new Promise((resolve) => {
            let resolved = false;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                if ('onvoiceschanged' in window.speechSynthesis) {
                    window.speechSynthesis.onvoiceschanged = null;
                }
                resolve();
            };
            if ('onvoiceschanged' in window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = () => {
                    cleanup();
                };
            }
            setTimeout(cleanup, 400);
        });
        return voicesReadyPromise;
    }

    /**
     * 作用：推断朗读语言（优先识别中文，否则默认英文）。
     * 输入：text
     * 输出：语音语言标签
     */
    function getSpeakLang(text) {
        if (!text) {
            return 'en-US';
        }
        for (const ch of text) {
            const isZh = typeof deps.isChinese === 'function'
                ? deps.isChinese(ch)
                : /[\u4E00-\u9FFF]/.test(ch);
            if (isZh) {
                return 'zh-CN';
            }
        }
        return 'en-US';
    }

    /**
     * 作用：执行一次语音朗读，支持按配置选择语音。
     * 输入：text
     * 输出：Promise
     */
    async function speakWord(text) {
        if (!canSpeakWord() || !text) {
            return;
        }
        if (speechVoiceURI) {
            await waitForVoices();
        }
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = speechVoiceURI
            ? voices.find((voice) => voice.voiceURI === speechVoiceURI)
            : null;
        const utterance = new SpeechSynthesisUtterance(text);
        const token = ++speakToken;
        currentSpeakText = text;
        isSpeaking = true;
        if (preferredVoice) {
            utterance.voice = preferredVoice;
            utterance.lang = preferredVoice.lang || getSpeakLang(text);
        } else {
            utterance.lang = getSpeakLang(text);
        }
        utterance.onend = () => {
            if (token === speakToken) {
                isSpeaking = false;
                currentSpeakText = '';
            }
        };
        utterance.onerror = () => {
            if (token === speakToken) {
                isSpeaking = false;
                currentSpeakText = '';
            }
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    /**
     * 作用：切换朗读状态；同词再次点击会停止，否则开始播放。
     * 输入：text
     * 输出：无
     */
    function toggleSpeak(text) {
        if (!canSpeakWord() || !text) {
            return;
        }
        const speaking = window.speechSynthesis.speaking || window.speechSynthesis.pending || isSpeaking;
        if (speaking && currentSpeakText === text) {
            stopSpeaking();
            return;
        }
        speakWord(text);
    }

    /**
     * 作用：更新语音配置中的 voiceURI。
     * 输入：voiceURI
     * 输出：无
     */
    function setSpeechVoiceURI(voiceURI) {
        speechVoiceURI = String(voiceURI || '');
    }

    /**
     * 作用：更新词典搜索提供方配置。
     * 输入：provider
     * 输出：无
     */
    function setSearchProvider(provider) {
        searchProvider = String(provider || 'youdao');
    }

    /**
     * 作用：根据当前词典提供方构造查询配置（标题与URL）。
     * 输入：word，provider（可选）
     * 输出：搜索配置对象
     */
    function getSearchProviderConfig(word, provider) {
        const safeWord = String(word || '');
        const encodedWord = encodeURIComponent(safeWord);
        const slugWord = encodeURIComponent(safeWord.trim().toLowerCase().replace(/\s+/g, '-'));
        const queryWord = encodedWord.replace(/%20/g, '+');
        const providers = {
            youdao: {
                label: '有道词典',
                url: `https://www.youdao.com/result?word=${encodedWord}&lang=en`
            },
            bing: {
                label: '必应词典',
                url: `https://www.bing.com/dict/search?q=${encodedWord}`
            },
            cambridge: {
                label: '剑桥在线词典',
                url: `https://dictionary.cambridge.org/zhs/spellcheck/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/?q=${queryWord}`
            },
            collins: {
                label: '柯林斯在线词典',
                url: `https://www.collinsdictionary.com/dictionary/english/${slugWord}`
            }
        };
        return providers[provider || searchProvider] || providers.youdao;
    }

    /**
     * 作用：刷新当前 tooltip 内所有搜索按钮链接。
     * 输入：无
     * 输出：无
     */
    function refreshTooltipSearchLinks() {
        if (!globalTooltip) {
            return;
        }
        const searchLinks = globalTooltip.querySelectorAll('.vocab-search-btn[data-word]');
        searchLinks.forEach((searchLink) => {
            const word = searchLink.dataset.word || '';
            const searchConfig = getSearchProviderConfig(word);
            searchLink.href = searchConfig.url;
            searchLink.title = searchConfig.label;
            searchLink.setAttribute('aria-label', searchConfig.label);
        });
    }

    /**
     * 作用：限制 tooltip 尺寸在最小值和最大值之间。
     * 输入：size
     * 输出：裁剪后的尺寸对象
     */
    function clampTooltipSize(size) {
        const rawWidth = size && typeof size.width === 'number' ? size.width : TOOLTIP_SIZE_DEFAULT.width;
        const rawHeight = size && typeof size.height === 'number' ? size.height : TOOLTIP_SIZE_DEFAULT.height;
        const width = Math.min(TOOLTIP_SIZE_MAX.width, Math.max(TOOLTIP_SIZE_MIN.width, Math.round(rawWidth)));
        const height = Math.min(TOOLTIP_SIZE_MAX.height, Math.max(TOOLTIP_SIZE_MIN.height, Math.round(rawHeight)));
        return {width, height};
    }

    /**
     * 作用：将尺寸应用到 tooltip DOM 上并同步内容区域最大高度。
     * 输入：tooltip，size
     * 输出：应用后的尺寸
     */
    function applyTooltipSize(tooltip, size) {
        if (!tooltip || !size) {
            return tooltipSize;
        }
        const clamped = clampTooltipSize(size);
        tooltip.style.width = `${clamped.width}px`;
        tooltip.style.height = `${clamped.height}px`;
        const content = tooltip.querySelector('.vocab-tooltip-content');
        if (content) {
            const contentHeight = Math.max(120, clamped.height - 36);
            content.style.maxHeight = `${contentHeight}px`;
        }
        return clamped;
    }

    /**
     * 作用：异步保存 tooltip 尺寸到本地存储。
     * 输入：size
     * 输出：无
     */
    function saveTooltipSize(size) {
        if (!size) {
            return;
        }
        const clamped = clampTooltipSize(size);
        tooltipSize = clamped;
        if (tooltipSizeSaveTimer) {
            clearTimeout(tooltipSizeSaveTimer);
        }
        tooltipSizeSaveTimer = setTimeout(() => {
            chrome.storage.local.set({[WORD_CARD_POPUP_SIZE_STORAGE_KEY]: clamped}).catch(() => {
            });
        }, 200);
    }

    /**
     * 作用：确保 tooltip 仅创建一次 8 个方向的缩放手柄。
     * 输入：tooltip
     * 输出：无
     */
    function ensureTooltipResizeHandles(tooltip) {
        if (!tooltip || tooltip.querySelector('.vocab-tooltip-resize-handle')) {
            return;
        }
        const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        directions.forEach((dir) => {
            const handle = document.createElement('div');
            handle.className = `vocab-tooltip-resize-handle handle-${dir}`;
            handle.dataset.dir = dir;
            tooltip.appendChild(handle);
        });
    }

    /**
     * 作用：统一读取鼠标/触摸指针坐标。
     * 输入：event
     * 输出：指针坐标对象
     */
    function getPointerPosition(event) {
        if (event.touches && event.touches.length > 0) {
            return {x: event.touches[0].clientX, y: event.touches[0].clientY};
        }
        return {x: event.clientX, y: event.clientY};
    }

    /**
     * 作用：开始 tooltip 缩放流程并记录初始几何信息。
     * 输入：event，direction
     * 输出：无
     */
    function startTooltipResize(event, direction) {
        if (!globalTooltip || !direction) {
            return;
        }
        event.preventDefault();
        const {x, y} = getPointerPosition(event);
        const rect = globalTooltip.getBoundingClientRect();
        tooltipResizeState = {
            direction: direction,
            startX: x,
            startY: y,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        };
        tooltipManualPositioned = true;
        isTooltipDragging = false;
        tooltipDragOffset = null;
    }

    /**
     * 作用：处理缩放中的尺寸与位置更新。
     * 输入：event
     * 输出：无
     */
    function handleTooltipResizeMove(event) {
        if (!tooltipResizeState || !globalTooltip) {
            return;
        }
        event.preventDefault();
        const {x, y} = getPointerPosition(event);
        const deltaX = x - tooltipResizeState.startX;
        const deltaY = y - tooltipResizeState.startY;
        let width = tooltipResizeState.startWidth;
        let height = tooltipResizeState.startHeight;
        let left = tooltipResizeState.startLeft;
        let top = tooltipResizeState.startTop;
        if (tooltipResizeState.direction.includes('e')) {
            width = tooltipResizeState.startWidth + deltaX;
        }
        if (tooltipResizeState.direction.includes('w')) {
            width = tooltipResizeState.startWidth - deltaX;
        }
        if (tooltipResizeState.direction.includes('s')) {
            height = tooltipResizeState.startHeight + deltaY;
        }
        if (tooltipResizeState.direction.includes('n')) {
            height = tooltipResizeState.startHeight - deltaY;
        }
        const clamped = clampTooltipSize({width, height});
        if (tooltipResizeState.direction.includes('w')) {
            left = tooltipResizeState.startLeft + (tooltipResizeState.startWidth - clamped.width);
        }
        if (tooltipResizeState.direction.includes('n')) {
            top = tooltipResizeState.startTop + (tooltipResizeState.startHeight - clamped.height);
        }
        tooltipSize = applyTooltipSize(globalTooltip, clamped);
        globalTooltip.style.left = `${Math.round(left)}px`;
        globalTooltip.style.top = `${Math.round(top)}px`;
    }

    /**
     * 作用：结束缩放流程并持久化当前尺寸。
     * 输入：无
     * 输出：无
     */
    function finishTooltipResize() {
        if (!tooltipResizeState) {
            return;
        }
        tooltipResizeState = null;
        saveTooltipSize(tooltipSize);
    }

    /**
     * 作用：判断最后一次指针位置是否在 tooltip 内。
     * 输入：无
     * 输出：是否在 tooltip 内
     */
    function isPointerInsideTooltip() {
        if (!lastPointerPosition || !globalTooltip || !globalTooltip.isConnected) {
            return false;
        }
        const rect = globalTooltip.getBoundingClientRect();
        return (
            lastPointerPosition.x >= rect.left &&
            lastPointerPosition.x <= rect.right &&
            lastPointerPosition.y >= rect.top &&
            lastPointerPosition.y <= rect.bottom
        );
    }

    /**
     * 作用：将 tooltip 定位到目标高亮元素附近，并自动选择上下显示位置。
     * 输入：span，tooltip
     * 输出：无
     */
    function positionTooltip(span, tooltip) {
        if (!span || !span.isConnected || span.getClientRects().length === 0) {
            if (!isPointerInsideTooltip() && !isElementHovered(tooltip)) {
                hideGlobalTooltip(true);
            }
            return;
        }
        tooltip.classList.remove('show-above');
        const rect = span.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const gap = 6;
        const padding = 8;
        let left = rect.left;
        let top = rect.bottom + gap;
        const tipRect = tooltip.getBoundingClientRect();
        if (left + tipRect.width > viewportWidth - padding) {
            left = Math.max(padding, viewportWidth - tipRect.width - padding);
        }
        if (top + tipRect.height > viewportHeight - padding) {
            top = rect.top - tipRect.height - gap;
            tooltip.classList.add('show-above');
        }
        if (top < padding) {
            top = padding;
        }
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    /**
     * 作用：构建 tooltip 固定头部（图钉、拖拽区、关闭按钮）。
     * 输入：无
     * 输出：header DOM
     */
    function buildTooltipHeader() {
        const header = document.createElement('div');
        header.className = 'vocab-tooltip-header';
        const pinButton = document.createElement('button');
        pinButton.className = 'vocab-tooltip-pin';
        pinButton.type = 'button';
        pinButton.setAttribute('aria-label', '图钉');
        pinButton.setAttribute('aria-pressed', 'false');
        const svgNs = 'http://www.w3.org/2000/svg';
        const pinSvg = document.createElementNS(svgNs, 'svg');
        pinSvg.setAttribute('viewBox', '0 0 16 16');
        pinSvg.setAttribute('aria-hidden', 'true');
        pinSvg.setAttribute('focusable', 'false');
        const pinPath = document.createElementNS(svgNs, 'path');
        pinPath.setAttribute('d', 'M6 0h4l1 1v3l2 2v1H3V6l2-2V1zM8 9c.6 0 1 .4 1 1v6H7v-6c0-.6.4-1 1-1z');
        pinSvg.appendChild(pinPath);
        pinButton.appendChild(pinSvg);
        const dragHandle = document.createElement('div');
        dragHandle.className = 'vocab-tooltip-drag';
        dragHandle.setAttribute('aria-label', '拖动');
        const closeButton = document.createElement('button');
        closeButton.className = 'vocab-tooltip-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '关闭');
        closeButton.textContent = '×';
        header.appendChild(pinButton);
        header.appendChild(dragHandle);
        header.appendChild(closeButton);
        return header;
    }

    /**
     * 作用：在首次使用时创建 tooltip 容器并挂载必要事件。
     * 输入：无
     * 输出：tooltip DOM
     */
    function getGlobalTooltip() {
        if (!globalTooltip) {
            globalTooltip = document.createElement('div');
            globalTooltip.className = 'vocab-tooltip';
            document.body.appendChild(globalTooltip);
        }
        if (!tooltipListenersAttached) {
            window.addEventListener('scroll', repositionGlobalTooltip, true);
            window.addEventListener('resize', repositionGlobalTooltip);
            globalTooltip.addEventListener('mouseenter', () => {
                if (globalTooltipHideTimer) {
                    clearTimeout(globalTooltipHideTimer);
                    globalTooltipHideTimer = null;
                }
                isHoveringTooltip = true;
            });
            globalTooltip.addEventListener('mousemove', () => {
                if (globalTooltipHideTimer) {
                    clearTimeout(globalTooltipHideTimer);
                    globalTooltipHideTimer = null;
                }
                isHoveringTooltip = true;
            });
            globalTooltip.addEventListener('mouseleave', () => {
                isHoveringTooltip = false;
                if (globalTooltipOwner) {
                    const owner = globalTooltipOwner;
                    if (!isElementHovered(owner)) {
                        if (globalTooltipHideTimer) {
                            clearTimeout(globalTooltipHideTimer);
                        }
                        globalTooltipHideTimer = setTimeout(() => {
                            const hoveringHighlight = isElementHovered(owner);
                            const hoveringTooltip = isElementHovered(globalTooltip);
                            const pointerInsideTooltip = isPointerInsideTooltip();
                            if (hoveringHighlight || hoveringTooltip || pointerInsideTooltip || isHoveringHighlight || isHoveringTooltip) {
                                return;
                            }
                            hideGlobalTooltip();
                        }, TOOLTIP_HIDE_DELAY_MS);
                    }
                }
            });
            globalTooltip.addEventListener('click', (event) => {
                const target = event.target;
                if (!target || !target.closest) {
                    return;
                }
                const closeButton = target.closest('.vocab-tooltip-close');
                if (closeButton) {
                    hideGlobalTooltip(true);
                    return;
                }
                const pinButton = target.closest('.vocab-tooltip-pin');
                if (pinButton) {
                    isTooltipPinned = !isTooltipPinned;
                    pinButton.classList.toggle('is-pinned', isTooltipPinned);
                    pinButton.setAttribute('aria-pressed', isTooltipPinned ? 'true' : 'false');
                    if (isTooltipPinned) {
                        tooltipManualPositioned = true;
                    } else {
                        tooltipManualPositioned = false;
                        repositionGlobalTooltip();
                    }
                    return;
                }
                const phrasesToggle = target.closest('.vocab-phrases-toggle');
                if (phrasesToggle) {
                    const phrasesBlock = phrasesToggle.parentElement?.querySelector('.vocab-phrases');
                    if (!phrasesBlock) {
                        return;
                    }
                    const isOpen = phrasesBlock.classList.toggle('is-open');
                    phrasesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                    deps.setPhrasesExpanded(isOpen);
                    chrome.storage.local.set({phrasesExpanded: isOpen}).catch(() => {
                    });
                    if (event.detail > 0) {
                        phrasesToggle.blur();
                    }
                }
                const examplesToggle = target.closest('.vocab-examples-toggle');
                if (examplesToggle) {
                    const examplesBlock = examplesToggle.parentElement?.querySelector('.vocab-examples');
                    if (!examplesBlock) {
                        return;
                    }
                    const isOpen = examplesBlock.classList.toggle('is-open');
                    examplesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                    deps.setExamplesExpanded(isOpen);
                    chrome.storage.local.set({examplesExpanded: isOpen}).catch(() => {
                    });
                    if (event.detail > 0) {
                        examplesToggle.blur();
                    }
                }
            });
            globalTooltip.addEventListener('mousedown', (event) => {
                if (event.button !== 0) {
                    return;
                }
                const target = event.target;
                if (!target || !target.closest) {
                    return;
                }
                const resizeHandle = target.closest('.vocab-tooltip-resize-handle');
                if (resizeHandle) {
                    startTooltipResize(event, resizeHandle.dataset.dir);
                    return;
                }
                const dragHandle = target.closest('.vocab-tooltip-drag');
                if (!dragHandle) {
                    return;
                }
                const rect = globalTooltip.getBoundingClientRect();
                if (!isTooltipPinned) {
                    isTooltipPinned = true;
                    const pinButton = globalTooltip.querySelector('.vocab-tooltip-pin');
                    if (pinButton) {
                        pinButton.classList.add('is-pinned');
                        pinButton.setAttribute('aria-pressed', 'true');
                    }
                }
                isTooltipDragging = true;
                tooltipManualPositioned = true;
                tooltipDragOffset = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top
                };
                event.preventDefault();
            });
            docDragMoveHandler = (event) => {
                if (tooltipResizeState) {
                    handleTooltipResizeMove(event);
                    return;
                }
                if (!isTooltipDragging || !globalTooltip || !tooltipDragOffset) {
                    return;
                }
                const left = event.clientX - tooltipDragOffset.x;
                const top = event.clientY - tooltipDragOffset.y;
                globalTooltip.style.left = `${Math.round(left)}px`;
                globalTooltip.style.top = `${Math.round(top)}px`;
            };
            docDragUpHandler = () => {
                if (tooltipResizeState) {
                    finishTooltipResize();
                    return;
                }
                if (!isTooltipDragging) {
                    return;
                }
                isTooltipDragging = false;
                tooltipDragOffset = null;
            };
            document.addEventListener('mousemove', docDragMoveHandler);
            document.addEventListener('mouseup', docDragUpHandler);
            tooltipListenersAttached = true;
        }
        if (!pointerTrackerAttached) {
            docMouseMoveHandler = (event) => {
                lastPointerPosition = {x: event.clientX, y: event.clientY};
                if (isTooltipVisible && globalTooltip && globalTooltipOwner) {
                    const tooltipRect = globalTooltip.getBoundingClientRect();
                    const ownerRect = globalTooltipOwner.getBoundingClientRect();
                    const isInsideTooltip = (
                        event.clientX >= tooltipRect.left &&
                        event.clientX <= tooltipRect.right &&
                        event.clientY >= tooltipRect.top &&
                        event.clientY <= tooltipRect.bottom
                    );
                    const isInsideOwner = (
                        event.clientX >= ownerRect.left &&
                        event.clientX <= ownerRect.right &&
                        event.clientY >= ownerRect.top &&
                        event.clientY <= ownerRect.bottom
                    );
                    if (!isInsideTooltip && !isInsideOwner) {
                        if (globalTooltipHideTimer) {
                            clearTimeout(globalTooltipHideTimer);
                        }
                        globalTooltipHideTimer = setTimeout(() => {
                            const currentTooltipRect = globalTooltip.getBoundingClientRect();
                            const currentOwnerRect = globalTooltipOwner.getBoundingClientRect();
                            const stillInsideTooltip = lastPointerPosition && (
                                lastPointerPosition.x >= currentTooltipRect.left &&
                                lastPointerPosition.x <= currentTooltipRect.right &&
                                lastPointerPosition.y >= currentTooltipRect.top &&
                                lastPointerPosition.y <= currentTooltipRect.bottom
                            );
                            const stillInsideOwner = lastPointerPosition && (
                                lastPointerPosition.x >= currentOwnerRect.left &&
                                lastPointerPosition.x <= currentOwnerRect.right &&
                                lastPointerPosition.y >= currentOwnerRect.top &&
                                lastPointerPosition.y <= currentOwnerRect.bottom
                            );
                            if (!stillInsideTooltip && !stillInsideOwner) {
                                hideGlobalTooltip();
                            }
                        }, TOOLTIP_HIDE_DELAY_MS);
                    } else {
                        if (globalTooltipHideTimer) {
                            clearTimeout(globalTooltipHideTimer);
                            globalTooltipHideTimer = null;
                        }
                    }
                }
            };
            docMouseLeaveHandler = () => {
                if (!globalTooltip || !isTooltipVisible) {
                    return;
                }
                if (globalTooltipHideTimer) {
                    clearTimeout(globalTooltipHideTimer);
                }
                globalTooltipHideTimer = setTimeout(() => {
                    if (!isPointerInsideTooltip()) {
                        hideGlobalTooltip();
                    }
                }, TOOLTIP_HIDE_DELAY_MS);
            };
            document.addEventListener('mousemove', docMouseMoveHandler);
            document.addEventListener('mouseleave', docMouseLeaveHandler);
            pointerTrackerAttached = true;
        }
        return globalTooltip;
    }

    /**
     * 作用：隐藏全局 tooltip，可按 force 忽略图钉和 hover 保护。
     * 输入：force
     * 输出：无
     */
    function hideGlobalTooltip(force = false) {
        if (!globalTooltip) {
            return;
        }
        if (!force && isTooltipPinned) {
            return;
        }
        if (!force && isElementHovered(globalTooltip)) {
            return;
        }
        if (!force && isPointerInsideTooltip()) {
            return;
        }
        globalTooltip.style.display = 'none';
        globalTooltip.style.visibility = '';
        isTooltipVisible = false;
        isTooltipPinned = false;
        isTooltipDragging = false;
        tooltipDragOffset = null;
        tooltipManualPositioned = false;
        globalTooltipOwner = null;
        isHoveringHighlight = false;
        isHoveringTooltip = false;
        stopSpeaking();
    }

    /**
     * 作用：恢复高亮节点为原始文本（用于屏蔽词后回退显示）。
     * 输入：highlightElement
     * 输出：是否成功恢复
     */
    function restoreHighlightElement(highlightElement) {
        if (!highlightElement || !highlightElement.classList || !highlightElement.classList.contains('vocab-highlight')) {
            return false;
        }
        const originalText = highlightElement.dataset.originalText;
        const text = originalText || highlightElement.textContent.replace(/\([^)]+\)$/, '');
        highlightElement.replaceWith(text);
        return true;
    }

    /**
     * 作用：在页面滚动或窗口尺寸变化时重排 tooltip 位置。
     * 输入：无
     * 输出：无
     */
    function repositionGlobalTooltip() {
        if (!isTooltipVisible || !globalTooltip || !globalTooltipOwner) {
            return;
        }
        if (tooltipManualPositioned) {
            return;
        }
        positionTooltip(globalTooltipOwner, globalTooltip);
    }

    /**
     * 作用：构建词卡内容区域（释义、来源、短语、例句、收藏/屏蔽/朗读按钮）。
     * 输入：data、matchText
     * 输出：词卡内容 DOM
     */
    function createTooltipContent(data, matchText) {
    if (!data) {
        return null;
    }
    void matchText;
    const container = document.createElement('div');
    container.className = 'vocab-item';
    const wordRow = document.createElement('div');
    wordRow.className = 'vocab-word-row';
    const wordMain = document.createElement('div');
    wordMain.className = 'vocab-word-main';
    const rawWord = String(data.word || '').trim();
    const wordSpan = document.createElement('span');
    wordSpan.className = 'vocab-word';
    wordSpan.textContent = rawWord;
    const searchConfig = getSearchProviderConfig(rawWord);
    const searchLink = document.createElement('a');
    searchLink.className = 'vocab-search-btn';
    searchLink.href = searchConfig.url;
    searchLink.target = '_blank';
    searchLink.rel = 'noopener noreferrer';
    searchLink.title = searchConfig.label;
    searchLink.setAttribute('aria-label', searchConfig.label);
    searchLink.dataset.word = rawWord;
    const svgNs = 'http://www.w3.org/2000/svg';
    const searchSvg = document.createElementNS(svgNs, 'svg');
    searchSvg.classList.add('vocab-search-icon');
    searchSvg.setAttribute('viewBox', '0 0 24 24');
    searchSvg.setAttribute('aria-hidden', 'true');
    searchSvg.setAttribute('focusable', 'false');
    const searchCircle = document.createElementNS(svgNs, 'circle');
    searchCircle.setAttribute('cx', '11');
    searchCircle.setAttribute('cy', '11');
    searchCircle.setAttribute('r', '7');
    const searchLine = document.createElementNS(svgNs, 'line');
    searchLine.setAttribute('x1', '16.65');
    searchLine.setAttribute('y1', '16.65');
    searchLine.setAttribute('x2', '21');
    searchLine.setAttribute('y2', '21');
    searchSvg.appendChild(searchCircle);
    searchSvg.appendChild(searchLine);
    searchLink.appendChild(searchSvg);
    const normalizedWord = deps.normalizeWord(rawWord);
    const blockButton = document.createElement('button');
    blockButton.className = 'vocab-action-btn vocab-block-btn';
    blockButton.type = 'button';
    blockButton.title = '屏蔽该词';
    blockButton.setAttribute('aria-label', '屏蔽该词');
    blockButton.dataset.word = normalizedWord;
    if (!normalizedWord) {
        blockButton.disabled = true;
    }
    if (deps.getBlockedWordsSet().has(normalizedWord)) {
        blockButton.disabled = true;
    }
    const trashSvg = document.createElementNS(svgNs, 'svg');
    trashSvg.classList.add('vocab-action-icon');
    trashSvg.setAttribute('viewBox', '0 0 24 24');
    trashSvg.setAttribute('aria-hidden', 'true');
    const trashPath = document.createElementNS(svgNs, 'path');
    trashPath.setAttribute('d', 'M19 6h-3.5l-1-1h-5l-1 1H5v2h14V6zM6 9v11c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9H6z');
    trashSvg.appendChild(trashPath);
    blockButton.appendChild(trashSvg);
    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'vocab-action-btn vocab-favorite-btn';
    favoriteButton.type = 'button';
    favoriteButton.title = '收藏该词';
    favoriteButton.setAttribute('aria-label', '收藏该词');
    favoriteButton.dataset.word = normalizedWord;
    if (deps.getFavoriteWordsSet().has(normalizedWord)) {
        favoriteButton.classList.add('is-active');
    }
    const starSvg = document.createElementNS(svgNs, 'svg');
    starSvg.classList.add('vocab-action-icon');
    starSvg.setAttribute('viewBox', '0 0 24 24');
    starSvg.setAttribute('aria-hidden', 'true');
    const starPath = document.createElementNS(svgNs, 'path');
    starPath.setAttribute('d', 'M12 3l2.9 6 6.6.9-4.8 4.4 1.2 6.5L12 17.8 6.1 20.8l1.2-6.5L2.5 9.9l6.6-.9L12 3z');
    starSvg.appendChild(starPath);
    favoriteButton.appendChild(starSvg);
    const speakButton = document.createElement('button');
    speakButton.className = 'vocab-action-btn vocab-speak-btn';
    speakButton.type = 'button';
    speakButton.title = '朗读该词';
    speakButton.setAttribute('aria-label', '朗读该词');
    if (!rawWord || !canSpeakWord()) {
        speakButton.disabled = true;
    }
    const speakSvg = document.createElementNS(svgNs, 'svg');
    speakSvg.classList.add('vocab-action-icon');
    speakSvg.setAttribute('viewBox', '0 0 24 24');
    speakSvg.setAttribute('aria-hidden', 'true');
    const speakPath = document.createElementNS(svgNs, 'path');
    speakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
    speakSvg.appendChild(speakPath);
    speakButton.appendChild(speakSvg);
    blockButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!normalizedWord || deps.getBlockedWordsSet().has(normalizedWord)) {
            return;
        }
        deps.getBlockedWordsSet().add(normalizedWord);
        blockButton.disabled = true;
        await deps.persistBlockedWords();
        if (deps.getDisplayMode() !== 'off' && !deps.getIsSiteBlocked()) {
            const owner = getTooltipOwner();
            hideGlobalTooltip(true);
            restoreHighlightElement(owner);
        }
    });
    favoriteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!normalizedWord) {
            return;
        }
        if (deps.getFavoriteWordsSet().has(normalizedWord)) {
            deps.getFavoriteWordsSet().delete(normalizedWord);
            favoriteButton.classList.remove('is-active');
        } else {
            deps.getFavoriteWordsSet().add(normalizedWord);
            favoriteButton.classList.add('is-active');
        }
        await deps.persistFavoriteWords();
    });
    speakButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!rawWord) {
            return;
        }
        toggleSpeak(rawWord);
    });
    wordMain.appendChild(wordSpan);
    wordMain.appendChild(searchLink);
    wordMain.appendChild(blockButton);
    wordMain.appendChild(favoriteButton);
    wordMain.appendChild(speakButton);
    wordRow.appendChild(wordMain);
    // 合并显示词性和 AI 标签
    if (data._posTag || typeof data._aiScore === 'number') {
        const infoSpan = document.createElement('span');
        infoSpan.className = 'vocab-inferred-pos';
        
        let labelText = '';
        let titleLines = [];
        const isAi = typeof data._aiScore === 'number';

        // 1. 处理 AI 信息 (样式和 Title)
        if (isAi) {
            const percentage = (data._aiScore * 100).toFixed(0) + '%';
            titleLines.push(`AI 确信率: ${percentage}`);
            // 如果有 AI 分数，使用 AI 标签的配色（蓝底蓝字）
            infoSpan.style.backgroundColor = '#e3f2fd';
            infoSpan.style.color = '#1565c0';
        }

        // 2. 处理词性信息 (文本和 Title)
        if (data._posTag) {
            const posTag = data._posTag;
            let posLabel = '';
            let posReason = '';
            
            if (typeof posTag === 'object' && posTag.pos) {
                posLabel = String(posTag.pos).toUpperCase();
                const methodText = posTag.method === 'rule' ? '插件推测' : '词库推断';
                posReason = posTag.rule ? `${methodText}: ${posTag.rule}` : methodText;
            } else if (typeof posTag === 'string') {
                posLabel = posTag.toUpperCase();
                posReason = '插件推测 (jieba)';
            }
            
            labelText = posLabel; // 优先显示词性
            if (posReason) {
                titleLines.push(`词性推断理由: ${posReason}`);
            }
        } else if (isAi) {
            // 如果只有 AI 没有词性（极少情况），显示 AI
            labelText = 'AI';
        }

        if (labelText) {
            infoSpan.textContent = labelText;
            infoSpan.title = titleLines.join('\n');
            wordRow.appendChild(infoSpan);
        }
    }
    container.appendChild(wordRow);
    if (data.phonetics && (data.phonetics.uk || data.phonetics.us)) {
        const phonetics = document.createElement('div');
        phonetics.className = 'vocab-phonetics';
        if (data.phonetics.uk) {
            const ukSpan = document.createElement('span');
            ukSpan.className = 'vocab-phonetic';
            ukSpan.textContent = `UK ${data.phonetics.uk}`;
            phonetics.appendChild(ukSpan);
        }
        if (data.phonetics.us) {
            const usSpan = document.createElement('span');
            usSpan.className = 'vocab-phonetic';
            usSpan.textContent = `US ${data.phonetics.us}`;
            phonetics.appendChild(usSpan);
        }
        container.appendChild(phonetics);
    }
    if (data.sources && data.sources.length > 0) {
        const sourceNames = deps.formatSourceList(data.sources);
        if (sourceNames.length > 0) {
        const sources = document.createElement('div');
        sources.className = 'vocab-sources';
        sources.textContent = sourceNames.join(', ');
        container.appendChild(sources);
        }
    }
    if (data.byType && Object.keys(data.byType).length > 0) {
        const translations = document.createElement('div');
        translations.className = 'vocab-translations';
        const typeOrder = ['n', 'v', 'vt', 'vi', 'adj', 'adv', '_default'];
        const types = Object.keys(data.byType);
        const sortedTypes = types.sort((a, b) => {
            const indexA = typeOrder.indexOf(a);
            const indexB = typeOrder.indexOf(b);
            const orderA = indexA === -1 ? typeOrder.length : indexA;
            const orderB = indexB === -1 ? typeOrder.length : indexB;
            return orderA - orderB;
        });
        const inferredPOS = data._posTag
            ? (typeof data._posTag === 'string' ? data._posTag : data._posTag.pos)
            : null;
        sortedTypes.forEach(typeKey => {
            const typeData = data.byType[typeKey];
            if (!typeData) {
                return;
            }
            const displayType = typeData.type || '';
            const meanings = Array.isArray(typeData.meanings)
                ? typeData.meanings.map(item => String(item || '').trim()).filter(Boolean)
                : [];
            const isMatched = inferredPOS && deps.findMatchingType({[typeKey]: typeData}, inferredPOS) === typeKey;
            const selectedMeaning = String(data._selectedMeaning || '').trim();
            const matchedMeaning = String(data._matchedMeaning || selectedMeaning || '').trim();
            const effectiveMode = String(data._effectiveMode || '');
            const highlightMeaning = (effectiveMode === 'cn-to-en' && !deps.getWordCardHighlightMatchedChinese())
                ? ''
                : matchedMeaning;
            const item = document.createElement('div');
            item.className = `vocab-trans-item${isMatched ? ' vocab-trans-matched' : ''}`;
            if (displayType) {
                const typeSpan = document.createElement('span');
                typeSpan.className = 'vocab-type';
                typeSpan.textContent = displayType;
                item.appendChild(typeSpan);
                item.appendChild(document.createTextNode(' '));
            }
            if (meanings.length > 0) {
                const selectedIndex = highlightMeaning
                    ? meanings.findIndex((meaning) => {
                        if (meaning === highlightMeaning) {
                            return true;
                        }
                        const subMeanings = meaning
                            .split(/[,\uFF0C\u3001;\uFF1B]/)
                            .map(item => item.trim())
                            .filter(Boolean);
                        return subMeanings.includes(highlightMeaning);
                    })
                    : -1;
                if (selectedIndex >= 0) {
                    meanings.forEach((meaning, index) => {
                        if (index > 0) {
                            item.appendChild(document.createTextNode('，'));
                        }
                        if (index === selectedIndex) {
                            const hitMeaning = document.createElement('strong');
                            hitMeaning.className = 'vocab-meaning-hit';
                            hitMeaning.textContent = meaning;
                            item.appendChild(hitMeaning);
                        } else {
                            item.appendChild(document.createTextNode(meaning));
                        }
                    });
                } else {
                    item.appendChild(document.createTextNode(meanings.join('，')));
                }
            }
            if (typeData.sources && typeData.sources.length > 0) {
                const sourceNames = deps.formatSourceList(typeData.sources);
                if (sourceNames.length > 0) {
                item.appendChild(document.createTextNode(' '));
                const sources = document.createElement('span');
                sources.className = 'vocab-type-sources';
                sources.textContent = `[${sourceNames.join(', ')}]`;
                item.appendChild(sources);
                }
            }
            translations.appendChild(item);
        });
        container.appendChild(translations);
    }
    if (data.phrases && data.phrases.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'vocab-phrases-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', deps.getPhrasesExpanded() ? 'true' : 'false');
        toggle.textContent = '常用短语';
        container.appendChild(toggle);
        const phrases = document.createElement('div');
        phrases.className = 'vocab-phrases';
        if (deps.getPhrasesExpanded()) {
            phrases.classList.add('is-open');
        }
        data.phrases.forEach(phrase => {
            if (!phrase) {
                return;
            }
            const phraseItem = document.createElement('div');
            phraseItem.className = 'vocab-phrase';
            const phraseRow = document.createElement('div');
            phraseRow.className = 'vocab-phrase-row';
            const phraseText = document.createElement('div');
            phraseText.className = 'vocab-phrase-text';
            phraseText.textContent = phrase.phrase || '';
            const phraseSearchConfig = getSearchProviderConfig(phrase.phrase || '');
            const phraseSearchLink = document.createElement('a');
            phraseSearchLink.className = 'vocab-search-btn vocab-phrase-search';
            phraseSearchLink.href = phraseSearchConfig.url;
            phraseSearchLink.target = '_blank';
            phraseSearchLink.rel = 'noopener noreferrer';
            phraseSearchLink.title = phraseSearchConfig.label;
            phraseSearchLink.setAttribute('aria-label', phraseSearchConfig.label);
            phraseSearchLink.dataset.word = phrase.phrase || '';
            const phraseSearchSvg = document.createElementNS(svgNs, 'svg');
            phraseSearchSvg.classList.add('vocab-search-icon');
            phraseSearchSvg.setAttribute('viewBox', '0 0 24 24');
            phraseSearchSvg.setAttribute('aria-hidden', 'true');
            phraseSearchSvg.setAttribute('focusable', 'false');
            const phraseSearchCircle = document.createElementNS(svgNs, 'circle');
            phraseSearchCircle.setAttribute('cx', '11');
            phraseSearchCircle.setAttribute('cy', '11');
            phraseSearchCircle.setAttribute('r', '7');
            const phraseSearchLine = document.createElementNS(svgNs, 'line');
            phraseSearchLine.setAttribute('x1', '16.65');
            phraseSearchLine.setAttribute('y1', '16.65');
            phraseSearchLine.setAttribute('x2', '21');
            phraseSearchLine.setAttribute('y2', '21');
            phraseSearchSvg.appendChild(phraseSearchCircle);
            phraseSearchSvg.appendChild(phraseSearchLine);
            phraseSearchLink.appendChild(phraseSearchSvg);
            const phraseSpeakButton = document.createElement('button');
            phraseSpeakButton.className = 'vocab-action-btn vocab-speak-btn';
            phraseSpeakButton.type = 'button';
            phraseSpeakButton.title = '朗读短语';
            phraseSpeakButton.setAttribute('aria-label', '朗读短语');
            if (!phrase.phrase || !canSpeakWord()) {
                phraseSpeakButton.disabled = true;
            }
            const phraseSpeakSvg = document.createElementNS(svgNs, 'svg');
            phraseSpeakSvg.classList.add('vocab-action-icon');
            phraseSpeakSvg.setAttribute('viewBox', '0 0 24 24');
            phraseSpeakSvg.setAttribute('aria-hidden', 'true');
            const phraseSpeakPath = document.createElementNS(svgNs, 'path');
            phraseSpeakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
            phraseSpeakSvg.appendChild(phraseSpeakPath);
            phraseSpeakButton.appendChild(phraseSpeakSvg);
            phraseSpeakButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!phrase.phrase) {
                    return;
                }
                toggleSpeak(phrase.phrase);
            });
            phraseRow.appendChild(phraseText);
            phraseRow.appendChild(phraseSearchLink);
            phraseRow.appendChild(phraseSpeakButton);
            phraseItem.appendChild(phraseRow);
            if (phrase.translations && phrase.translations.length > 0) {
                const phraseTrans = document.createElement('div');
                phraseTrans.className = 'vocab-phrase-trans';
                phraseTrans.textContent = phrase.translations.join('，');
                phraseItem.appendChild(phraseTrans);
            }
            if (phrase.sources && phrase.sources.length > 0) {
                const sourceNames = deps.formatSourceList(phrase.sources);
                if (sourceNames.length > 0) {
                const phraseSources = document.createElement('div');
                phraseSources.className = 'vocab-phrase-sources';
                phraseSources.textContent = `[${sourceNames.join(', ')}]`;
                phraseItem.appendChild(phraseSources);
                }
            }
            phrases.appendChild(phraseItem);
        });
        container.appendChild(phrases);
    }
    if (Array.isArray(data.sentenceExamples) && data.sentenceExamples.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'vocab-examples-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', deps.getExamplesExpanded() ? 'true' : 'false');
        toggle.textContent = '例句';
        container.appendChild(toggle);
        const examples = document.createElement('div');
        examples.className = 'vocab-examples';
        if (deps.getExamplesExpanded()) {
            examples.classList.add('is-open');
        }
        data.sentenceExamples.forEach((example) => {
            if (!example || (!example.en && !example.zh)) {
                return;
            }
            const item = document.createElement('div');
            item.className = 'vocab-example';
            if (example.en) {
                const enRow = document.createElement('div');
                enRow.className = 'vocab-example-row';
                const en = document.createElement('div');
                en.className = 'vocab-example-en';
                en.textContent = example.en;
                const exampleSpeakButton = document.createElement('button');
                exampleSpeakButton.className = 'vocab-action-btn vocab-example-speak';
                exampleSpeakButton.type = 'button';
                exampleSpeakButton.title = '朗读例句';
                exampleSpeakButton.setAttribute('aria-label', '朗读例句');
                if (!example.en || !canSpeakWord()) {
                    exampleSpeakButton.disabled = true;
                }
                const exampleSpeakSvg = document.createElementNS(svgNs, 'svg');
                exampleSpeakSvg.classList.add('vocab-action-icon');
                exampleSpeakSvg.setAttribute('viewBox', '0 0 24 24');
                exampleSpeakSvg.setAttribute('aria-hidden', 'true');
                const exampleSpeakPath = document.createElementNS(svgNs, 'path');
                exampleSpeakPath.setAttribute('d', 'M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.25-3.9v7.8A4.5 4.5 0 0 0 16.5 12zm0-8a9 9 0 0 1 0 16v-2.1a6.9 6.9 0 0 0 0-11.8V4z');
                exampleSpeakSvg.appendChild(exampleSpeakPath);
                exampleSpeakButton.appendChild(exampleSpeakSvg);
                exampleSpeakButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (!example.en) {
                        return;
                    }
                    toggleSpeak(example.en);
                });
                enRow.appendChild(en);
                enRow.appendChild(exampleSpeakButton);
                item.appendChild(enRow);
            }
            if (example.zh) {
                const zh = document.createElement('div');
                zh.className = 'vocab-example-zh';
                zh.textContent = example.zh;
                item.appendChild(zh);
            }
            examples.appendChild(item);
        });
        container.appendChild(examples);
    }
    return container;
}

    /**
     * 作用：为高亮 span 绑定 tooltip 显示与隐藏逻辑。
     * 输入：span、dataWithPOS、matchText、allowTooltip
     * 输出：无
     */
    function bindHighlightTooltip({span, dataWithPOS, matchText, allowTooltip}) {
        const showTooltip = () => {
            if (globalTooltipHideTimer) {
                clearTimeout(globalTooltipHideTimer);
                globalTooltipHideTimer = null;
            }
            const tooltip = getGlobalTooltip();
            globalTooltipOwner = span;
            isHoveringHighlight = true;
            isHoveringTooltip = false;
            const wasPinned = isTooltipPinned;
            if (!wasPinned) {
                isTooltipPinned = false;
                tooltipManualPositioned = false;
            } else {
                tooltipManualPositioned = true;
            }
            isTooltipDragging = false;
            tooltipDragOffset = null;
            tooltip.replaceChildren();
            const header = buildTooltipHeader();
            const content = document.createElement('div');
            content.className = 'vocab-tooltip-content';
            const contentBody = createTooltipContent(dataWithPOS, matchText);
            if (contentBody) {
                content.appendChild(contentBody);
            }
            tooltip.appendChild(header);
            tooltip.appendChild(content);
            ensureTooltipResizeHandles(tooltip);
            tooltipSize = applyTooltipSize(tooltip, tooltipSize);
            const pinButton = tooltip.querySelector('.vocab-tooltip-pin');
            if (pinButton) {
                pinButton.classList.toggle('is-pinned', isTooltipPinned);
                pinButton.setAttribute('aria-pressed', isTooltipPinned ? 'true' : 'false');
            }
            tooltip.style.display = 'block';
            tooltip.style.visibility = 'hidden';
            const contentDiv = tooltip.querySelector('.vocab-tooltip-content');
            if (contentDiv) {
                contentDiv.scrollTop = 0;
            }
            isTooltipVisible = true;
            if (!isTooltipPinned) {
                positionTooltip(span, tooltip);
            }
            tooltip.style.visibility = 'visible';
        };

        const scheduleHide = () => {
            if (globalTooltipHideTimer) {
                clearTimeout(globalTooltipHideTimer);
            }
            globalTooltipHideTimer = setTimeout(() => {
                const hoveringHighlight = isElementHovered(span);
                const hoveringTooltip = isElementHovered(globalTooltip);
                const pointerInsideTooltip = isPointerInsideTooltip();
                if (hoveringHighlight || hoveringTooltip || pointerInsideTooltip || isHoveringHighlight || isHoveringTooltip) {
                    return;
                }
                hideGlobalTooltip();
            }, TOOLTIP_HIDE_DELAY_MS);
        };

        if (allowTooltip) {
            span.addEventListener('mouseenter', showTooltip);
            span.addEventListener('mouseleave', () => {
                isHoveringHighlight = false;
                scheduleHide();
            });
        }
    }

    /**
     * 作用：根据 storage 读取结果设置 tooltip 尺寸。
     * 输入：size
     * 输出：无
     */
    function setTooltipSizeFromStorage(size) {
        if (size) {
            tooltipSize = clampTooltipSize(size);
        } else {
            tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
        }
    }

    /**
     * 作用：重置 tooltip 尺寸到默认值并立刻应用到现有 tooltip。
     * 输入：无
     * 输出：无
     */
    function resetTooltipSize() {
        tooltipSize = {...TOOLTIP_SIZE_DEFAULT};
        if (globalTooltip) {
            tooltipSize = applyTooltipSize(globalTooltip, tooltipSize);
        }
    }

    /**
     * 作用：销毁 tooltip 节点和相关事件监听，回收内部状态。
     * 输入：无
     * 输出：无
     */
    function dispose() {
        if (globalTooltipHideTimer) {
            clearTimeout(globalTooltipHideTimer);
            globalTooltipHideTimer = null;
        }
        if (tooltipSizeSaveTimer) {
            clearTimeout(tooltipSizeSaveTimer);
            tooltipSizeSaveTimer = null;
        }
        if (tooltipListenersAttached) {
            window.removeEventListener('scroll', repositionGlobalTooltip, true);
            window.removeEventListener('resize', repositionGlobalTooltip);
            if (docDragMoveHandler) {
                document.removeEventListener('mousemove', docDragMoveHandler);
            }
            if (docDragUpHandler) {
                document.removeEventListener('mouseup', docDragUpHandler);
            }
            tooltipListenersAttached = false;
        }
        if (pointerTrackerAttached) {
            if (docMouseMoveHandler) {
                document.removeEventListener('mousemove', docMouseMoveHandler);
            }
            if (docMouseLeaveHandler) {
                document.removeEventListener('mouseleave', docMouseLeaveHandler);
            }
            pointerTrackerAttached = false;
        }
        if (globalTooltip) {
            globalTooltip.remove();
            globalTooltip = null;
        }
        globalTooltipOwner = null;
        isTooltipVisible = false;
        isTooltipPinned = false;
        isTooltipDragging = false;
        tooltipDragOffset = null;
        tooltipManualPositioned = false;
        isHoveringHighlight = false;
        isHoveringTooltip = false;
        stopSpeaking();
    }



    /**
     * 作用：返回当前 tooltip 的归属高亮节点。
     * 输入：无
     * 输出：owner 节点或 null
     */
    function getTooltipOwner() {
        return globalTooltipOwner;
    }

    return {
        bindHighlightTooltip,
        hideGlobalTooltip,
        setTooltipSizeFromStorage,
        resetTooltipSize,
        setSpeechVoiceURI,
        setSearchProvider,
        refreshTooltipSearchLinks,
        dispose
    };
}

    global.JieciTooltip = {
        createTooltipController,
        WORD_CARD_POPUP_SIZE_STORAGE_KEY,
        TOOLTIP_SIZE_DEFAULT
    };
})(window);



