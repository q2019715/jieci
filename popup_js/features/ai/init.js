/**
 * 文件说明：AI 模块初始化入口。
 * 职责：初始化 AI 设置页、模型下载状态、测速能力与参数同步。
 */
import { bindAINavigation } from './bind.js';
import { updateAISections, showAiModeErrorHint } from './render.js';
import { sendAIMessage, sleep, buildBenchmarkText } from './service.js';
import {
    AI_DEFAULT_MODE,
    AI_DEFAULT_MODEL_SOURCE,
    AI_DEFAULT_MODEL_INFO_URL,
    AI_DEFAULT_TRIGGER,
    AI_DEFAULT_THRESHOLD,
    AI_DEFAULT_DELAY_MS,
    AI_DOWNLOAD_MODEL_BUTTON_TEXT,
    AI_UNINSTALL_MODEL_BUTTON_TEXT,
    AI_DOWNLOAD_IN_PROGRESS_TEXT,
    AI_DOWNLOAD_DONE_TEXT,
    AI_DOWNLOAD_STATUS_TIMEOUT_TEXT,
    AI_DOWNLOAD_FAILED_PREFIX,
    AI_BENCHMARK_RUNNING_TEXT,
    AI_BENCHMARK_ERROR_TEXT,
    AI_BENCHMARK_FAILED_PREFIX,
    AI_NO_WEBGPU_TEXT,
    AI_WEBGPU_ADAPTER_FAILED_TEXT,
    AI_NO_WEBNN_TEXT,
    AI_REQUIRE_MODEL_FIRST_TEXT,
    AI_BENCHMARK_SUGGEST_SLOW_TEXT,
    AI_BENCHMARK_SUGGEST_GOOD_TEXT,
    AI_BENCHMARK_SUGGEST_SLOW_COLOR,
    AI_BENCHMARK_SUGGEST_GOOD_COLOR,
    AI_DOWNLOAD_PROGRESS_AUTO_HIDE_DELAY_MS,
    DEFAULT_AI_SESSION_TIMEOUT_MS,
    AI_BENCHMARK_GOOD_SPEED_THRESHOLD,
    AI_MESSAGE_TIMEOUT_MS,
    AI_WORKER_BUSY_TEXT,
    AI_BUSY_RETRY_INTERVAL_MS
} from './constants.js';

/**
 * 初始化 AI 功能模块。
 */
export async function initAIFeature({ elements, actions, notifyActiveTabs }) {
    bindAINavigation(elements, actions);
    const aiSettingsPage = document.getElementById('pageAISettings');
    const aiSettingsHeader = aiSettingsPage ? aiSettingsPage.querySelector('.page-header') : null;
    let aiBusyBanner = document.getElementById('aiBusyBanner');
    if (!aiBusyBanner && aiSettingsPage) {
        aiBusyBanner = document.createElement('div');
        aiBusyBanner.id = 'aiBusyBanner';
        aiBusyBanner.className = 'ai-busy-banner';
        aiBusyBanner.setAttribute('role', 'alert');
        aiBusyBanner.style.display = 'none';
        if (aiSettingsHeader && aiSettingsHeader.parentNode === aiSettingsPage) {
            aiSettingsPage.insertBefore(aiBusyBanner, aiSettingsHeader.nextSibling);
        } else {
            aiSettingsPage.insertBefore(aiBusyBanner, aiSettingsPage.firstChild);
        }
    }

    const aiModeSelect = document.getElementById('aiModeSelect');
    const aiModeErrorHint = document.getElementById('aiModeErrorHint');
    const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');
    const speedValue = document.getElementById('speedValue');
    const aiModelSourceSection = document.getElementById('aiModelSourceSection');
    const aiModelStatus = document.getElementById('aiModelStatus');
    const aiDownloadSection = document.getElementById('aiDownloadSection');
    const aiDownloadBtn = document.getElementById('aiDownloadBtn');
    const aiUninstallBtn = document.getElementById('aiUninstallBtn');
    const aiDownloadProgressWrap = document.getElementById('aiDownloadProgressWrap');
    const aiDownloadText = document.getElementById('aiDownloadText');
    const aiDownloadPercent = document.getElementById('aiDownloadPercent');
    const aiDownloadBar = document.getElementById('aiDownloadBar');
    const aiTriggerSelect = document.getElementById('aiTriggerSelect');
    const aiTriggerDivider = document.getElementById('aiTriggerDivider');
    const aiTriggerSection = document.getElementById('aiTriggerSection');
    const aiParamsDivider = document.getElementById('aiParamsDivider');
    const aiThresholdSection = document.getElementById('aiThresholdSection');
    const aiThresholdSlider = document.getElementById('aiThresholdSlider');
    const aiThresholdLabel = document.getElementById('aiThresholdLabel');
    const aiDelaySection = document.getElementById('aiDelaySection');
    const aiDelaySlider = document.getElementById('aiDelaySlider');
    const aiDelayLabel = document.getElementById('aiDelayLabel');
    const aiTimeoutSection = document.getElementById('aiTimeoutSection');
    const aiTimeoutSlider = document.getElementById('aiTimeoutSlider');
    const aiTimeoutLabel = document.getElementById('aiTimeoutLabel');
    const aiBenchmarkDivider = document.getElementById('aiBenchmarkDivider');
    const aiBenchmarkSection = document.getElementById('aiBenchmarkSection');
    const benchmarkSuggestion = document.getElementById('benchmarkSuggestion');

    let modelReady = false;
    let aiModeErrorTimer = null;
    let aiDownloadProgressHideTimer = null;
    let aiBackendBusy = false;
    let aiBusyRetryTimer = null;

    if (!aiModeSelect || !runBenchmarkBtn || !aiTriggerSelect) {
        return;
    }

    const settings = await chrome.storage.local.get([
        'aiMode',
        'aiModelSource',
        'aiModelInfoUrl',
        'aiTrigger',
        'aiSimilarityThreshold',
        'aiProcessingDelay',
        'aiSessionTimeoutMs'
    ]);
    const currentAiMode = settings.aiMode || AI_DEFAULT_MODE;
    const currentModelSource = AI_DEFAULT_MODEL_SOURCE;
    const currentModelInfoUrl = settings.aiModelInfoUrl || AI_DEFAULT_MODEL_INFO_URL;
    const currentAiTrigger = settings.aiTrigger || AI_DEFAULT_TRIGGER;
    const currentThreshold = settings.aiSimilarityThreshold !== undefined ? settings.aiSimilarityThreshold : AI_DEFAULT_THRESHOLD;
    const currentDelay = settings.aiProcessingDelay !== undefined ? settings.aiProcessingDelay : AI_DEFAULT_DELAY_MS;
    const currentTimeoutMs = settings.aiSessionTimeoutMs !== undefined ? Number(settings.aiSessionTimeoutMs) : DEFAULT_AI_SESSION_TIMEOUT_MS;
    const currentTimeoutSec = Math.max(1, Math.min(15, Math.round(currentTimeoutMs / 1000)));

    aiModeSelect.value = currentAiMode;
    aiTriggerSelect.value = currentAiTrigger;
    if (aiThresholdSlider) {
        aiThresholdSlider.value = currentThreshold;
        if (aiThresholdLabel) aiThresholdLabel.textContent = parseFloat(currentThreshold).toFixed(2);
    }
    if (aiDelaySlider) {
        aiDelaySlider.value = currentDelay;
        if (aiDelayLabel) aiDelayLabel.textContent = `${currentDelay}ms`;
    }
    if (aiTimeoutSlider) {
        aiTimeoutSlider.value = currentTimeoutSec;
        if (aiTimeoutLabel) aiTimeoutLabel.textContent = `${currentTimeoutSec}s`;
    }

    const sectionElements = {
        aiModelSourceSection,
        aiTriggerDivider,
        aiTriggerSection,
        aiParamsDivider,
        aiThresholdSection,
        aiDelaySection,
        aiTimeoutSection,
        aiBenchmarkDivider,
        aiBenchmarkSection
    };
    updateAISections(sectionElements, currentAiMode);

    const normalizedTimeoutMs = currentTimeoutSec * 1000;
    const aiInitUpdates = {};
    if (settings.aiModelSource !== currentModelSource) {
        aiInitUpdates.aiModelSource = currentModelSource;
    }
    if (settings.aiModelInfoUrl !== currentModelInfoUrl) {
        aiInitUpdates.aiModelInfoUrl = currentModelInfoUrl;
    }
    if (settings.aiSessionTimeoutMs !== normalizedTimeoutMs) {
        aiInitUpdates.aiSessionTimeoutMs = normalizedTimeoutMs;
    }
    if (Object.keys(aiInitUpdates).length > 0) {
        await chrome.storage.local.set(aiInitUpdates);
    }

    function clearAiBusyRetryTimer() {
        if (aiBusyRetryTimer) {
            clearTimeout(aiBusyRetryTimer);
            aiBusyRetryTimer = null;
        }
    }

    function setAIControlsDisabled(disabled) {
        const controls = [
            aiModeSelect,
            aiTriggerSelect,
            aiThresholdSlider,
            aiDelaySlider,
            aiTimeoutSlider,
            aiDownloadBtn,
            aiUninstallBtn,
            runBenchmarkBtn
        ];
        controls.forEach((control) => {
            if (control) {
                control.disabled = !!disabled;
            }
        });
    }

    function setAiBackendBusyState(isBusy) {
        aiBackendBusy = isBusy === true;
        setAIControlsDisabled(aiBackendBusy);
        if (aiSettingsPage) {
            aiSettingsPage.classList.toggle('ai-backend-busy', aiBackendBusy);
        }
        if (aiBusyBanner) {
            aiBusyBanner.textContent = AI_WORKER_BUSY_TEXT;
            aiBusyBanner.style.display = aiBackendBusy ? 'block' : 'none';
        }
        if (aiDownloadBtn && aiBackendBusy) {
            aiDownloadBtn.style.display = 'none';
        }
        if (aiModelStatus) {
            if (aiBackendBusy) {
                aiModelStatus.textContent = AI_WORKER_BUSY_TEXT;
                aiModelStatus.style.display = 'block';
            } else if (aiModelStatus.textContent === AI_WORKER_BUSY_TEXT) {
                aiModelStatus.textContent = '';
                aiModelStatus.style.display = 'none';
            }
        }
        if (!aiBackendBusy) {
            clearAiBusyRetryTimer();
        }
    }

    async function sendAIMessageWithBusyState(message, options = {}) {
        const resp = await sendAIMessage(message, {
            timeoutMs: AI_MESSAGE_TIMEOUT_MS,
            ...options
        });
        if (resp && resp.timeout) {
            setAiBackendBusyState(true);
        } else if (aiBackendBusy) {
            setAiBackendBusyState(false);
        }
        return resp;
    }

    async function retryWhenAiBackendBusy() {
        if (!aiBackendBusy || aiBusyRetryTimer) {
            return;
        }
        aiBusyRetryTimer = setTimeout(async () => {
            aiBusyRetryTimer = null;
            const resp = await sendAIMessageWithBusyState({ type: 'ai-model-status', infoUrl: currentModelInfoUrl });
            if (!resp || resp.timeout || !resp.ok) {
                await retryWhenAiBackendBusy();
                return;
            }
            await refreshModelStatus();
        }, AI_BUSY_RETRY_INTERVAL_MS);
    }

    /**
     * 清理 AI 下载进度自动隐藏计时器。
     */
    function clearAiDownloadProgressHideTimer() {
        if (aiDownloadProgressHideTimer) {
            clearTimeout(aiDownloadProgressHideTimer);
            aiDownloadProgressHideTimer = null;
        }
    }

    /**
     * 延时隐藏 AI 下载进度。
     */
    function scheduleAiDownloadProgressHide() {
        clearAiDownloadProgressHideTimer();
        aiDownloadProgressHideTimer = setTimeout(() => {
            if (aiDownloadProgressWrap) {
                aiDownloadProgressWrap.style.display = 'none';
            }
            aiDownloadProgressHideTimer = null;
        }, AI_DOWNLOAD_PROGRESS_AUTO_HIDE_DELAY_MS);
    }

    /**
     * 刷新 AI 模型安装状态。
     */
    async function refreshModelStatus() {
        if (!aiModelStatus || !aiDownloadSection) {
            return;
        }
        if (!aiBackendBusy) {
            aiModelStatus.textContent = '';
            aiModelStatus.style.display = 'none';
        }
        const resp = await sendAIMessageWithBusyState({ type: 'ai-model-status', infoUrl: currentModelInfoUrl });
        if (resp && resp.timeout) {
            await retryWhenAiBackendBusy();
            return { busy: true };
        }
        if (!resp || !resp.ok || !resp.status) {
            modelReady = false;
            aiDownloadSection.style.display = 'block';
            if (aiDownloadBtn) aiDownloadBtn.style.display = 'inline-flex';
            if (aiUninstallBtn) aiUninstallBtn.style.display = 'none';
            return { busy: false };
        }
        const { cloudReady } = resp.status;
        modelReady = !!cloudReady;
        aiDownloadSection.style.display = 'block';
        if (aiDownloadBtn) aiDownloadBtn.textContent = AI_DOWNLOAD_MODEL_BUTTON_TEXT;
        if (aiUninstallBtn) aiUninstallBtn.textContent = AI_UNINSTALL_MODEL_BUTTON_TEXT;
        if (aiDownloadBtn) aiDownloadBtn.style.display = cloudReady ? 'none' : 'inline-flex';
        if (aiUninstallBtn) aiUninstallBtn.style.display = cloudReady ? 'inline-flex' : 'none';
        if (aiUninstallBtn) aiUninstallBtn.disabled = !cloudReady;
        return { busy: false };
    }

    /**
     * 轮询下载进度并刷新 UI。
     */
    async function trackDownloadProgress() {
        if (!aiDownloadProgressWrap || !aiDownloadPercent || !aiDownloadBar || !aiDownloadText) {
            return;
        }
        clearAiDownloadProgressHideTimer();
        aiDownloadProgressWrap.style.display = 'block';
        const start = Date.now();
        while (Date.now() - start < 10 * 60 * 1000) {
            const resp = await sendAIMessageWithBusyState({ type: 'ai-download-status' });
            if (resp && resp.timeout) {
                aiDownloadText.textContent = AI_WORKER_BUSY_TEXT;
                await retryWhenAiBackendBusy();
                return;
            }
            if (!resp || !resp.ok || !resp.status) {
                break;
            }
            const st = resp.status;
            const pct = Number(st.percent || 0);
            aiDownloadPercent.textContent = `${pct}%`;
            aiDownloadBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
            if (st.error) {
                aiDownloadText.textContent = `${AI_DOWNLOAD_FAILED_PREFIX}${st.error}`;
                return;
            }
            if (st.done) {
                aiDownloadText.textContent = AI_DOWNLOAD_DONE_TEXT;
                aiDownloadPercent.textContent = '100%';
                aiDownloadBar.style.width = '100%';
                scheduleAiDownloadProgressHide();
                return;
            }
            aiDownloadText.textContent = AI_DOWNLOAD_IN_PROGRESS_TEXT;
            await sleep(250);
        }
        aiDownloadText.textContent = AI_DOWNLOAD_STATUS_TIMEOUT_TEXT;
    }

    /**
     * 执行 AI 推理测速。
     */
    async function runBenchmark() {
        const mode = aiModeSelect.value;
        if (mode === 'none') {
            return;
        }
        runBenchmarkBtn.disabled = true;
        const originalText = runBenchmarkBtn.textContent;
        runBenchmarkBtn.textContent = AI_BENCHMARK_RUNNING_TEXT;
        speedValue.textContent = '--';

        try {
            if (mode === 'gpu') {
                if (!navigator.gpu) {
                    alert(AI_NO_WEBGPU_TEXT);
                    return;
                }
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    alert(AI_WEBGPU_ADAPTER_FAILED_TEXT);
                    return;
                }
            } else if (mode === 'npu') {
                if (!navigator.ml) {
                    alert(AI_NO_WEBNN_TEXT);
                    return;
                }
            }

            const resp = await chrome.runtime.sendMessage({
                type: 'ai-benchmark',
                mode,
                infoUrl: currentModelInfoUrl,
                text: buildBenchmarkText()
            }).catch((error) => {
                throw new Error(error && error.message ? error.message : 'benchmark request failed');
            });

            if (!resp || !resp.ok || !resp.result || typeof resp.result !== 'object') {
                const message = resp && resp.error ? String(resp.error) : 'benchmark failed';
                speedValue.textContent = AI_BENCHMARK_ERROR_TEXT;
                alert(`${AI_BENCHMARK_FAILED_PREFIX}${message}`);
                return;
            }
            const speed = Number(resp.result.speed || 0);
            speedValue.textContent = String(speed);
            if (benchmarkSuggestion) {
                benchmarkSuggestion.style.display = 'block';
                if (speed < AI_BENCHMARK_GOOD_SPEED_THRESHOLD) {
                    benchmarkSuggestion.textContent = AI_BENCHMARK_SUGGEST_SLOW_TEXT;
                    benchmarkSuggestion.style.color = AI_BENCHMARK_SUGGEST_SLOW_COLOR;
                } else {
                    benchmarkSuggestion.textContent = AI_BENCHMARK_SUGGEST_GOOD_TEXT;
                    benchmarkSuggestion.style.color = AI_BENCHMARK_SUGGEST_GOOD_COLOR;
                }
            }
        } catch (error) {
            speedValue.textContent = AI_BENCHMARK_ERROR_TEXT;
            alert(`${AI_BENCHMARK_FAILED_PREFIX}${error && error.message ? error.message : String(error)}`);
        } finally {
            runBenchmarkBtn.disabled = false;
            runBenchmarkBtn.textContent = originalText;
        }
    }

    const initialStatus = await refreshModelStatus();
    if (initialStatus && initialStatus.busy) {
        await retryWhenAiBackendBusy();
    } else if (currentAiMode !== AI_DEFAULT_MODE && !modelReady) {
        aiModeSelect.value = AI_DEFAULT_MODE;
        await chrome.storage.local.set({ aiMode: AI_DEFAULT_MODE });
        updateAISections(sectionElements, AI_DEFAULT_MODE);
        await notifyActiveTabs({ action: 'updateAIMode', mode: AI_DEFAULT_MODE });
    }

    aiModeSelect.addEventListener('change', async () => {
        const mode = aiModeSelect.value;
        if (mode !== AI_DEFAULT_MODE && !modelReady) {
            showAiModeErrorHint(aiModeErrorHint, AI_REQUIRE_MODEL_FIRST_TEXT, aiModeErrorTimer, (t) => {
                aiModeErrorTimer = t;
            });
            aiModeSelect.value = AI_DEFAULT_MODE;
            await chrome.storage.local.set({ aiMode: AI_DEFAULT_MODE });
            updateAISections(sectionElements, AI_DEFAULT_MODE);
            await notifyActiveTabs({ action: 'updateAIMode', mode: AI_DEFAULT_MODE });
            return;
        }
        await chrome.storage.local.set({ aiMode: mode });
        updateAISections(sectionElements, mode);
        await notifyActiveTabs({ action: 'updateAIMode', mode });
    });

    if (aiDownloadBtn) {
        aiDownloadBtn.addEventListener('click', async () => {
            if (aiBackendBusy) {
                return;
            }
            clearAiDownloadProgressHideTimer();
            aiDownloadBtn.disabled = true;
            const resp = await sendAIMessageWithBusyState({ type: 'ai-download-cloud-model', infoUrl: currentModelInfoUrl });
            if (resp && resp.timeout) {
                await retryWhenAiBackendBusy();
                return;
            }
            await trackDownloadProgress();
            aiDownloadBtn.disabled = false;
            await refreshModelStatus();
        });
    }

    if (aiUninstallBtn) {
        aiUninstallBtn.addEventListener('click', async () => {
            if (aiBackendBusy) {
                return;
            }
            aiUninstallBtn.disabled = true;
            const resp = await sendAIMessageWithBusyState({ type: 'ai-uninstall-cloud-model' });
            if (resp && resp.timeout) {
                await retryWhenAiBackendBusy();
                return;
            }
            clearAiDownloadProgressHideTimer();
            if (aiDownloadProgressWrap) {
                aiDownloadProgressWrap.style.display = 'none';
            }
            aiModeSelect.value = AI_DEFAULT_MODE;
            await chrome.storage.local.set({ aiMode: AI_DEFAULT_MODE });
            updateAISections(sectionElements, AI_DEFAULT_MODE);
            await notifyActiveTabs({ action: 'updateAIMode', mode: AI_DEFAULT_MODE });
            await refreshModelStatus();
            aiUninstallBtn.disabled = false;
        });
    }

    aiTriggerSelect.addEventListener('change', async () => {
        const trigger = aiTriggerSelect.value;
        await chrome.storage.local.set({ aiTrigger: trigger });
        await notifyActiveTabs({ action: 'updateAITrigger', trigger });
    });

    if (aiThresholdSlider) {
        aiThresholdSlider.addEventListener('input', async () => {
            const val = parseFloat(aiThresholdSlider.value);
            if (aiThresholdLabel) aiThresholdLabel.textContent = val.toFixed(2);
            await chrome.storage.local.set({ aiSimilarityThreshold: val });
            await notifyActiveTabs({ action: 'updateAIThreshold', threshold: val });
        });
    }

    if (aiDelaySlider) {
        aiDelaySlider.addEventListener('input', async () => {
            const val = parseInt(aiDelaySlider.value, 10);
            if (aiDelayLabel) aiDelayLabel.textContent = `${val}ms`;
            await chrome.storage.local.set({ aiProcessingDelay: val });
            await notifyActiveTabs({ action: 'updateAIDelay', delay: val });
        });
    }

    if (aiTimeoutSlider) {
        aiTimeoutSlider.addEventListener('input', async () => {
            const sec = parseInt(aiTimeoutSlider.value, 10);
            const timeoutMs = Math.max(1000, Math.min(15000, sec * 1000));
            if (aiTimeoutLabel) aiTimeoutLabel.textContent = `${sec}s`;
            await chrome.storage.local.set({ aiSessionTimeoutMs: timeoutMs });
            await notifyActiveTabs({ action: 'updateAITimeout', timeoutMs });
        });
    }

    runBenchmarkBtn.addEventListener('click', async () => {
        await runBenchmark();
    });
}
