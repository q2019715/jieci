/**
 * 文件说明：AI 模块文案与默认值常量。
 * 职责：集中维护 AI 功能使用到的用户可见文案与默认配置。
 */

/**
 * AI 模式默认值。
 */
export const AI_DEFAULT_MODE = 'none';

/**
 * AI 模型来源默认值。
 */
export const AI_DEFAULT_MODEL_SOURCE = 'cloud';

/**
 * AI 模型信息地址默认值。
 */
export const AI_DEFAULT_MODEL_INFO_URL = 'https://api.jieci.top/model/onnx/info.json';

/**
 * AI 触发方式默认值。
 */
export const AI_DEFAULT_TRIGGER = 'all';

/**
 * AI 相似度阈值默认值。
 */
export const AI_DEFAULT_THRESHOLD = 0.25;

/**
 * AI 处理延迟默认值（毫秒）。
 */
export const AI_DEFAULT_DELAY_MS = 0;

/**
 * 模型下载按钮文案。
 */
export const AI_DOWNLOAD_MODEL_BUTTON_TEXT = '下载模型';

/**
 * 模型卸载按钮文案。
 */
export const AI_UNINSTALL_MODEL_BUTTON_TEXT = '模型已经下载 点击卸载';

/**
 * 下载中状态文案。
 */
export const AI_DOWNLOAD_IN_PROGRESS_TEXT = '下载中...';

/**
 * 下载完成状态文案。
 */
export const AI_DOWNLOAD_DONE_TEXT = '下载完成';

/**
 * 下载状态超时文案。
 */
export const AI_DOWNLOAD_STATUS_TIMEOUT_TEXT = '下载状态超时，请重试';

/**
 * 下载失败文案前缀。
 */
export const AI_DOWNLOAD_FAILED_PREFIX = '下载失败: ';

/**
 * 测速中按钮文案。
 */
export const AI_BENCHMARK_RUNNING_TEXT = '测速中...';

/**
 * 速度错误占位文案。
 */
export const AI_BENCHMARK_ERROR_TEXT = 'Error';

/**
 * 测速失败前缀。
 */
export const AI_BENCHMARK_FAILED_PREFIX = '测速失败: ';

/**
 * WebGPU 不支持提示文案。
 */
export const AI_NO_WEBGPU_TEXT = '当前浏览器不支持 WebGPU';

/**
 * WebGPU 适配器失败提示文案。
 */
export const AI_WEBGPU_ADAPTER_FAILED_TEXT = 'WebGPU 请求适配器失败';

/**
 * WebNN 不支持提示文案。
 */
export const AI_NO_WEBNN_TEXT = '当前浏览器不支持 WebNN (NPU)';

/**
 * AI 模型未就绪提示文案。
 */
export const AI_REQUIRE_MODEL_FIRST_TEXT = '请先下载AI模型';

/**
 * AI 测速建议（慢）文案。
 */
export const AI_BENCHMARK_SUGGEST_SLOW_TEXT = 'AI 推理速度较低，不建议开启端侧AI';

/**
 * AI 测速建议（快）文案。
 */
export const AI_BENCHMARK_SUGGEST_GOOD_TEXT = 'AI 推理速度良好，可以开启端侧AI';

/**
 * AI 测速建议（慢）颜色。
 */
export const AI_BENCHMARK_SUGGEST_SLOW_COLOR = '#f44336';

/**
 * AI 测速建议（快）颜色。
 */
export const AI_BENCHMARK_SUGGEST_GOOD_COLOR = '#4caf50';

/**
 * AI 模式错误提示自动隐藏时长（毫秒）。
 */
export const AI_MODE_ERROR_HINT_HIDE_DELAY_MS = 3000;

/**
 * AI 下载进度条自动隐藏时长（毫秒）。
 */
export const AI_DOWNLOAD_PROGRESS_AUTO_HIDE_DELAY_MS = 5000;

/**
 * AI 会话超时默认值（毫秒）。
 */
export const DEFAULT_AI_SESSION_TIMEOUT_MS = 5000;

/**
 * AI 测速“速度良好”判定阈值（单位与测速结果一致）。
 */
export const AI_BENCHMARK_GOOD_SPEED_THRESHOLD = 500;

/**
 * popup 请求 background 的超时阈值（毫秒）。
 */
export const AI_MESSAGE_TIMEOUT_MS = 1000;

/**
 * AI 后台忙碌提示文案。
 */
export const AI_WORKER_BUSY_TEXT = 'AI 后台作业正在运行中，请等待当前 AI 作业完成即可';

/**
 * AI 后台忙碌时的状态探测间隔（毫秒）。
 */
export const AI_BUSY_RETRY_INTERVAL_MS = 1500;
