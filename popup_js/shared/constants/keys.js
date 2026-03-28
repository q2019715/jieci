/**
 * 文件说明：popup 使用的本地存储键与相关固定值。
 */
export const WORD_CARD_POPUP_SIZE_STORAGE_KEY = 'wordCardPopupSize';
export const OOBE_COMPLETION_KEY = 'oobeCompletedCount';
export const OOBE_STEP_KEY = 'oobeStep';
export const OOBE_REQUIRED_COUNT = 1;

/**
 * 显示模式滑块值到存储值的映射表。
 */
export const DISPLAY_MODE_MAP = {
    0: 'off',
    1: 'underline',
    2: 'annotation',
    3: 'replace'
};

/**
 * 显示模式存储值到滑块值的反向映射表。
 */
export const REVERSE_DISPLAY_MODE_MAP = {
    'off': 0,
    'underline': 1,
    'annotation': 2,
    'replace': 3
};

/**
 * 单节点最大匹配数默认值。
 */
export const DEFAULT_MAX_MATCHES_PER_NODE = 3;

/**
 * 最小文本长度默认值。
 */
export const DEFAULT_MIN_TEXT_LENGTH = 5;

/**
 * 查询服务提供商默认值。
 */
export const DEFAULT_SEARCH_PROVIDER = 'youdao';

/**
 * “删除选中”二次确认状态停留时长（毫秒）。
 */
export const DELETE_SELECTED_CONFIRM_DELAY_MS = 3000;

/**
 * “删除完成”提示状态停留时长（毫秒）。
 */
export const DELETE_SELECTED_DONE_DELAY_MS = 3000;

/**
 * 显示模式默认值。
 */
export const DEFAULT_DISPLAY_MODE = 'off';

/**
 * popup 初始化时需要读取的本地存储键集合。
 */
export const POPUP_SETTINGS_STORAGE_KEYS = [
    'displayMode',
    'displayModeChinese',
    'displayModeEnglish',
    'displayModeSplitByLanguage',
    'vocabularies',
    'maxMatchesPerNode',
    'minTextLength',
    'annotationMode',
    'highlightColorMode',
    'highlightColor',
    'cnToEnOrder',
    'enToCnOrder',
    'disableAnnotationUnderline',
    'annotationWordCardPopupEnabled',
    'wordCardHighlightMatchedChinese',
    'smartSkipCodeLinks',
    'smartSkipEditableTextboxes',
    'searchProvider',
    'speechVoiceURI',
    'blockedWords',
    'favoriteWords',
    'siteBlockRules',
    'siteBlockMode',
    'dedupeMode',
    'dedupeRepeatCount',
    'dedupeCooldownSeconds',
    'debugMode',
    'syncEnabled',
    'syncStatus',
    OOBE_COMPLETION_KEY,
    OOBE_STEP_KEY
];

/**
 * 通用状态提示自动隐藏时长（毫秒）。
 */
export const STATUS_TIP_AUTO_HIDE_DELAY_MS = 3000;

/**
 * 操作按钮完成态回弹时长（毫秒）。
 */
export const BUTTON_FEEDBACK_RESET_DELAY_MS = 1500;
