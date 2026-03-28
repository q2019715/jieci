/**
 * 文件说明：AI 模块渲染层。
 * 职责：封装 AI 设置页面中的 UI 渲染与状态提示逻辑。
 */
import { AI_MODE_ERROR_HINT_HIDE_DELAY_MS } from './constants.js';

/**
 * 根据 AI 模式更新参数区显示状态。
 */
export function updateAISections(elements, mode) {
    const {
        aiModelSourceSection,
        aiTriggerDivider,
        aiTriggerSection,
        aiParamsDivider,
        aiThresholdSection,
        aiDelaySection,
        aiTimeoutSection,
        aiBenchmarkDivider,
        aiBenchmarkSection
    } = elements;
    const isEnabled = mode !== 'none';
    if (aiModelSourceSection) aiModelSourceSection.style.display = 'block';
    if (aiTriggerDivider) aiTriggerDivider.style.display = isEnabled ? 'block' : 'none';
    if (aiTriggerSection) aiTriggerSection.style.display = isEnabled ? 'block' : 'none';
    if (aiParamsDivider) aiParamsDivider.style.display = isEnabled ? 'block' : 'none';
    if (aiThresholdSection) aiThresholdSection.style.display = isEnabled ? 'block' : 'none';
    if (aiDelaySection) aiDelaySection.style.display = isEnabled ? 'block' : 'none';
    if (aiTimeoutSection) aiTimeoutSection.style.display = isEnabled ? 'block' : 'none';
    if (aiBenchmarkDivider) aiBenchmarkDivider.style.display = isEnabled ? 'block' : 'none';
    if (aiBenchmarkSection) aiBenchmarkSection.style.display = isEnabled ? 'block' : 'none';
}

/**
 * 显示 AI 模式错误提示，并在延时后自动隐藏。
 */
export function showAiModeErrorHint(aiModeErrorHint, message, timerRef, setTimerRef) {
    if (!aiModeErrorHint) {
        return;
    }
    if (timerRef) {
        clearTimeout(timerRef);
    }
    aiModeErrorHint.textContent = message;
    aiModeErrorHint.style.display = 'block';
    const timer = setTimeout(() => {
        aiModeErrorHint.style.display = 'none';
        setTimerRef(null);
    }, AI_MODE_ERROR_HINT_HIDE_DELAY_MS);
    setTimerRef(timer);
}
