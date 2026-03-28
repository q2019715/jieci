/**
 * 文件说明：search 模块常量。
 */

export const SEARCH_MAX_SETTINGS_RESULTS = 40;
export const SEARCH_MAX_WORD_RESULTS = 30;

export const SEARCH_SETTING_ITEMS = [
    {
        id: 'display-mode',
        title: '插件工作模式',
        description: '设置插件在网页上标注的模式',
        targetPage: 'main',
        keywords: ['工作模式','标注模式', '显示模式', '下划线', '标注', '替换', 'display mode', 'underline', 'annotation', 'replace']
    },
    {
        id: 'display-mode-language',
        title: '中英文网页标注模式独立设置',
        description: '让插件分别在中文网页和英文网页下处于不同的标注模式。',
        targetPage: 'quickAnnotationBehavior',
        keywords: ['按语言模式', '中文模式', '英文模式', '工作模式','标注模式', '显示模式', '下划线', '标注', '替换','split by language']
    },
    {
        id: 'display-mode-language-cn',
        title: '中文网页下的标注模式',
        description: '设置中文网页的显示模式',
        targetPage: 'quickAnnotationBehavior',
        keywords: ['中文网页', '中文标注模式']
    },
    {
        id: 'display-mode-language-en',
        title: '英文网页下的标注模式',
        description: '设置英文网页的显示模式',
        targetPage: 'quickAnnotationBehavior',
        keywords: ['英文网页', '英文标注模式']
    },
    {
        id: 'quick-site-block',
        title: '将一个网址添加到(黑/白）名单中',
        description: '将某一站点添加到网站列表（黑/白名单）中',
        targetPage: 'siteBlock',
        keywords: ['不标注此网站', '禁用当前网站', 'quick block', '想让插件不标注此网站', '想让插件不标注此网站？','想要插件标注此网站'
        ,'黑名单','白名单','网址列表','网站列表','通配'

        ]
    },
    {
        id: 'style',
        title: '段落内标注样式设置',
        description: '设置网页中标注的样式',
        targetPage: 'style',
        keywords: ['样式', '颜色', '顺序', '中英顺序', '高亮', 'style', 'color', 'highlight','标注顺序','下划线','中','英']
    },
    {
        id: 'style-cn-en-order',
        title: '中→英 标注顺序',
        description: '设置中文到英文的显示顺序',
        targetPage: 'style',
        keywords: ['中译英', '中英顺序', '显示顺序']
    },
    {
        id: 'style-en-cn-order',
        title: '英→中 标注顺序',
        description: '设置英文到中文的显示顺序',
        targetPage: 'style',
        keywords: ['英译中', '英中顺序', '显示顺序']
    },
    {
        id: 'style-highlight-color',
        title: '标注颜色',
        description: '设置标注高亮颜色模式与色值',
        targetPage: 'style',
        keywords: ['高亮颜色', '颜色模式', 'color', 'highlight']
    },
    {
        id: 'style-disable-underline',
        title: '关闭替换内容的下划线',
        description: '替换模式下不显示下划线',
        targetPage: 'style',
        keywords: ['关闭下划线', 'disable underline']
    },
    {
        id: 'annotation',
        title: '段落内标注行为设置',
        description: '标注模式、数量限制、去重、最小文本长度',
        targetPage: 'annotation',
        keywords: ['行为', '标注模式', '最小文本', '去重', 'annotation mode', 'dedupe']
    },
    {
        id: 'annotation-ai-entry',
        title: 'AI辅助标注设置',
        description: '进入 AI 辅助标注参数页面',
        targetPage: 'aiSettings',
        keywords: ['ai', 'ai设置', 'ai辅助']
    },
    {
        id: 'annotation-language-entry',
        title: '分语言设置网站标注模式',
        description: '进入按语言模式设置页面',
        targetPage: 'quickAnnotationBehavior',
        keywords: ['分语言', '网站标注模式']
    },
    {
        id: 'annotation-mode',
        title: '标注模式设置',
        description: '切换标注模式策略',
        targetPage: 'annotation',
        keywords: ['标注模式', 'annotation mode']
    },
    {
        id: 'annotation-dedupe-mode',
        title: '智能标注去重',
        description: '控制重复词的智能去重行为',
        targetPage: 'annotation',
        keywords: ['去重', '去重模式', 'dedupe mode']
    },
    {
        id: 'annotation-dedupe-repeat-count',
        title: '单个单词标注去重间隔次数',
        description: '设置同一单词再次标注的间隔次数',
        targetPage: 'annotation',
        keywords: ['去重间隔', 'repeat count', '去重次数']
    },
    {
        id: 'annotation-clear-dedupe-counts',
        title: '删除单词次数统计',
        description: '清空去重计数统计',
        targetPage: 'annotation',
        keywords: ['删除次数统计', '清空计数', 'clear dedupe counts']
    },
    {
        id: 'annotation-smart-skip-code-links',
        title: '智能跳过代码链接',
        description: '跳过代码块与链接文本',
        targetPage: 'annotation',
        keywords: ['跳过代码', '跳过链接', 'smart skip code links']
    },
    {
        id: 'annotation-smart-skip-editable',
        title: '智能跳过可编辑文本框',
        description: '跳过输入框和可编辑区域',
        targetPage: 'annotation',
        keywords: ['可编辑文本框', 'editable textbox', 'smart skip editable']
    },
    {
        id: 'annotation-max-matches',
        title: '单句标注上限',
        description: '限制单句最多标注词数',
        targetPage: 'annotation',
        keywords: ['最大匹配', 'max matches', '数量限制']
    },
    {
        id: 'annotation-min-text-length',
        title: '容器最小字数',
        description: '只处理达到最小字数的容器',
        targetPage: 'annotation',
        keywords: ['最小文本长度', 'min text length']
    },
    {
        id: 'ai',
        title: 'AI辅助标注设置',
        description: 'AI模型来源、触发条件、阈值和延迟',
        targetPage: 'aiSettings',
        keywords: ['ai', '模型', '阈值', '延迟', '推理']
    },
    {
        id: 'ai-work-mode',
        title: 'AI工作模式设置',
        description: '切换 AI 处理工作模式',
        targetPage: 'aiSettings',
        keywords: ['ai工作模式', 'ai mode']
    },
    {
        id: 'ai-model-status',
        title: 'AI 模型权重下载状态',
        description: '查看模型安装与下载状态',
        targetPage: 'aiSettings',
        keywords: ['模型状态', '模型权重']
    },
    {
        id: 'ai-model-download',
        title: '下载模型',
        description: '下载本地 AI 模型',
        targetPage: 'aiSettings',
        keywords: ['下载ai模型', 'download model']
    },
    {
        id: 'ai-model-uninstall',
        title: '卸载模型',
        description: '删除本地 AI 模型',
        targetPage: 'aiSettings',
        keywords: ['卸载ai模型', 'uninstall model']
    },
    {
        id: 'ai-trigger',
        title: 'AI 触发条件',
        description: '配置 AI 介入的触发规则',
        targetPage: 'aiSettings',
        keywords: ['触发条件', 'trigger']
    },
    {
        id: 'ai-threshold',
        title: 'AI语义匹配阈值过滤设置',
        description: '设置语义匹配分数阈值',
        targetPage: 'aiSettings',
        keywords: ['语义阈值', '匹配阈值', 'threshold']
    },
    {
        id: 'ai-delay',
        title: 'AI 处理防卡顿延迟',
        description: '设置 AI 处理延迟避免卡顿',
        targetPage: 'aiSettings',
        keywords: ['防卡顿', '处理延迟', 'delay']
    },
    {
        id: 'ai-session-timeout',
        title: 'AI 后台会话超时释放时间设置',
        description: '控制后台会话释放时长',
        targetPage: 'aiSettings',
        keywords: ['会话超时', 'session timeout']
    },
    {
        id: 'ai-benchmark',
        title: '测试AI推理功能',
        description: '测试当前设备 AI 推理速度',
        targetPage: 'aiSettings',
        keywords: ['测试ai', 'benchmark', '推理速度', '测试电脑ai推理速度']
    },
    {
        id: 'word-card',
        title: '单词卡片设置',
        description: '弹窗开关、查词站点、发音音色',
        targetPage: 'wordCardSettings',
        keywords: ['单词卡片', '发音', '查词', '弹窗', 'speech', 'voice', 'search provider']
    },
    {
        id: 'word-card-popup',
        title: '单词弹窗功能开关',
        description: '控制悬浮时是否显示词卡弹窗',
        targetPage: 'wordCardSettings',
        keywords: ['词卡弹窗', '词卡开关', 'popup']
    },
    {
        id: 'word-card-highlight-matched-chinese',
        title: '卡片中高亮显示匹配的中文单词',
        description: '在词卡中高亮命中的中文释义',
        targetPage: 'wordCardSettings',
        keywords: ['高亮中文释义', 'matched chinese']
    },
    {
        id: 'word-card-reset-size',
        title: '重置词卡尺寸',
        description: '恢复词卡弹窗默认尺寸',
        targetPage: 'wordCardSettings',
        keywords: ['重置尺寸']
    },
    {
        id: 'word-card-provider',
        title: '默认查词站点',
        description: '设置无结果时打开的查词网站',
        targetPage: 'wordCardSettings',
        keywords: ['查词站点', 'search provider', 'youdao', 'bing', 'cambridge', 'collins']
    },
    {
        id: 'word-card-voice',
        title: '发音音色',
        description: '设置语音朗读音色',
        targetPage: 'wordCardSettings',
        keywords: ['音色', '语音', 'voice', 'speech']
    },
    {
        id: 'word-card-test-zh',
        title: '播放中文发音',
        description: '试听插件TTS中文语音效果',
        targetPage: 'wordCardSettings',
        keywords: ['测试中文发音','TTS']
    },
    {
        id: 'word-card-test-en',
        title: '测试英文发音',
        description: '试听英文语音效果',
        targetPage: 'wordCardSettings',
        keywords: ['播放英文发音']
    },
    {
        id: 'vocab',
        title: '词库管理',
        description: '导入、下载、更新词库',
        targetPage: 'vocab',
        keywords: ['词库', '导入', '下载', '更新', 'dictionary', 'vocabulary']
    },
    {
        id: 'vocab-download',
        title: '从服务器下载整理好的词库',
        description: '从服务器下载词库',
        targetPage: 'vocab',
        keywords: ['下载词库', 'download dictionary']
    },
    {
        id: 'vocab-update-all',
        title: '更新全部',
        description: '一键更新已安装词库',
        targetPage: 'vocab',
        keywords: ['更新全部词库', 'update all']
    },
    {
        id: 'vocab-import-local',
        title: '本地导入',
        description: '从本地文件导入词库',
        targetPage: 'vocab',
        keywords: ['本地导入词库', 'import json']
    },
    {
        id: 'vocab-search',
        title: '搜索已导入词库',
        description: '筛选已安装词库',
        targetPage: 'vocab',
        keywords: ['词库搜索']
    },
    {
        id: 'blocked',
        title: '已屏蔽的单词管理',
        description: '查看、删除、导入导出屏蔽词',
        targetPage: 'blocked',
        keywords: ['屏蔽', '黑名单单词', 'blocked words']
    },
    {
        id: 'blocked-delete-selected',
        title: '删除选中屏蔽词',
        description: '批量删除选中的屏蔽词',
        targetPage: 'blocked',
        keywords: ['删除选中', '批量删除屏蔽词']
    },
    {
        id: 'blocked-import',
        title: '输入或导入单词列表（屏蔽词）',
        description: '导入或粘贴屏蔽词列表',
        targetPage: 'blocked',
        keywords: ['屏蔽词导入', '从文件导入', '手动输入', '选择文件', '导入输入内容']
    },
    {
        id: 'blocked-export',
        title: '导出屏蔽词',
        description: '导出屏蔽词列表',
        targetPage: 'blocked',
        keywords: ['屏蔽词导出']
    },
    {
        id: 'favorites',
        title: '收藏的单词管理',
        description: '查看、删除、导入导出收藏词',
        targetPage: 'favorites',
        keywords: ['收藏', '收藏词', 'favorite words']
    },
    {
        id: 'favorites-delete-selected',
        title: '删除选中收藏词',
        description: '批量删除选中的收藏词',
        targetPage: 'favorites',
        keywords: ['删除选中', '批量删除收藏词']
    },
    {
        id: 'favorites-import',
        title: '输入或导入单词列表（收藏词）',
        description: '导入或粘贴收藏词列表',
        targetPage: 'favorites',
        keywords: ['收藏词导入', '从文件导入', '手动输入', '选择文件', '导入输入内容']
    },
    {
        id: 'favorites-export',
        title: '导出收藏词',
        description: '导出收藏词列表',
        targetPage: 'favorites',
        keywords: ['收藏词导出']
    },
    {
        id: 'site-block',
        title: '网站黑白名单设置',
        description: '配置插件在哪些网站启用或禁用',
        targetPage: 'siteBlock',
        keywords: ['网站', '黑名单', '白名单', '域名', 'site block', 'whitelist', 'blacklist']
    },
    {
        id: 'site-block-mode',
        title: '网站黑白名单模式',
        description: '切换黑名单模式或白名单模式',
        targetPage: 'siteBlock',
        keywords: ['插件工作模式', '黑名单模式', '白名单模式', 'site mode']
    },
    {
        id: 'site-block-delete-selected',
        title: '删除选中网站规则',
        description: '批量删除选中的网站规则',
        targetPage: 'siteBlock',
        keywords: ['删除选中网站']
    },
    {
        id: 'site-block-import',
        title: '输入或导入网站列表',
        description: '导入或粘贴站点规则',
        targetPage: 'siteBlock',
        keywords: ['网站规则导入', '从文件导入', '手动输入', '选择文件', '导入输入内容']
    },
    {
        id: 'site-block-export',
        title: '导出名单到文件',
        description: '导出网站黑白名单规则',
        targetPage: 'siteBlock',
        keywords: ['网站规则导出']
    },
    {
        id: 'site-rule',
        title: '网站规则配置',
        description: '添加当前网站规则',
        targetPage: 'siteRule',
        keywords: ['添加规则', '站点规则']
    },
    {
        id: 'sync',
        title: '数据同步设置',
        description: '启用同步、查看容量、手动推送与拉取',
        targetPage: 'sync',
        keywords: ['同步', 'sync', '云端', 'storage sync']
    },
    {
        id: 'sync-enable',
        title: '启用浏览器同步',
        description: '开启后通过浏览器账号同步数据',
        targetPage: 'sync',
        keywords: ['启用同步', '浏览器同步', 'sync enabled']
    },
    {
        id: 'sync-status',
        title: '云端版本状态',
        description: '查看当前云端版本信息',
        targetPage: 'sync',
        keywords: ['同步状态', '云端状态']
    },
    {
        id: 'sync-usage',
        title: '同步容量占用',
        description: '查看同步容量使用比例',
        targetPage: 'sync',
        keywords: ['容量占用', 'sync usage']
    },
    {
        id: 'sync-push',
        title: '立即同步到云端',
        description: '手动推送本地数据到云端',
        targetPage: 'sync',
        keywords: ['推送同步', 'push now', '同步到云端']
    },
    {
        id: 'sync-pull',
        title: '尝试从云端加载',
        description: '手动从云端拉取数据',
        targetPage: 'sync',
        keywords: ['拉取同步', 'pull now', '从云端加载']
    },
    {
        id: 'sync-conflict',
        title: '同步异常恢复',
        description: '恢复因同步出现异常导致的数据丢失',
        targetPage: 'sync',
        keywords: ['同步冲突', '恢复', '数据丢失', '同步出现问题导致数据丢失点此查看可能的解决方案', '同步出现问题导致数据丢失？点此查看可能的解决方案', '恢复上次冲突前数据']
    },
    {
        id: 'sync-enable-confirm',
        title: '确认启用同步',
        description: '完成勾选后确认启用同步功能',
        targetPage: 'sync',
        keywords: ['确认启用', '启用同步确认']
    },
    {
        id: 'about',
        title: '关于',
        description: '插件的关于页面',
        targetPage: 'about',
        keywords: ['关于', '版本', '官网', '调试', 'debug']
    },
    {
        id: 'about-version',
        title: '版本号',
        description: '查看当前插件版本',
        targetPage: 'about',
        keywords: ['版本']
    },
    {
        id: 'about-site',
        title: '官网',
        description: '访问插件官网',
        targetPage: 'about',
        keywords: ['官方网站','网站']
    },
    {
        id: 'about-debug',
        title: '调试模式',
        description: '启用或关闭插件调试模式',
        targetPage: 'about',
        keywords: ['debug mode','调试','测试']
    },
    {
        id: 'about-help',
        title: '帮助文档',
        description: '查看使用说明',
        targetPage: 'about',
        keywords: ['文档', 'help']
    },
    {
        id: 'about-contact',
        title: '联系我们',
        description: '查看联系方式',
        targetPage: 'about',
        keywords: ['联系', '反馈']
    },
    {
        id: 'about-thanks',
        title: '感谢您使用我的插件',
        description: '感谢文案与致谢信息',
        targetPage: 'about',
        keywords: ['感谢您使用我的插件( • ̀ω•́ )✧', '感谢']
    }
];
