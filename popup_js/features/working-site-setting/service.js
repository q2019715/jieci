/**
 * 文件说明：working-site-setting 模块服务层。
 * 职责：处理站点规则的归一化、匹配判断、导入导出与活动页域名获取。
 */
import {
    getActiveTabs as queryActiveTabs,
    sendMessageToTab
} from '../../shared/platform/chrome-tabs.js';

/**
 * 规范化主机名。
 */
export function normalizeHost(host) {
    return String(host || '').trim().toLowerCase().replace(/\.+$/, '');
}

/**
 * 规范化站点规则。
 */
export function normalizeSiteRule(rule) {
    if (!rule) {
        return '';
    }
    let cleaned = String(rule).trim().toLowerCase();
    cleaned = cleaned.replace(/^(https?:)?\/\//, '');
    cleaned = cleaned.split(/[/?#]/)[0];
    if (cleaned.startsWith('*.')) {
        cleaned = `*.${cleaned.slice(2).split(':')[0]}`;
    } else {
        cleaned = cleaned.split(':')[0];
    }
    return cleaned.replace(/\.+$/, '');
}

/**
 * 规范化规则页输入域名。
 */
export function normalizeSiteHostInput(input) {
    const cleaned = normalizeSiteRule(input);
    if (!cleaned) {
        return '';
    }
    return normalizeHost(cleaned.startsWith('*.') ? cleaned.slice(2) : cleaned);
}

/**
 * 编译站点规则索引。
 */
export function compileSiteRules(rules) {
    const exact = new Set();
    const wildcards = [];
    rules.forEach((rule) => {
        const cleaned = normalizeSiteRule(rule);
        if (!cleaned) {
            return;
        }
        if (cleaned.startsWith('*.')) {
            const suffix = cleaned.slice(2);
            if (suffix) {
                wildcards.push({ suffix, parts: suffix.split('.').length });
            }
        } else {
            exact.add(cleaned);
        }
    });
    return {
        exact: Array.from(exact),
        wildcards: wildcards.sort((a, b) => b.parts - a.parts)
    };
}

/**
 * 判断主机是否匹配规则。
 */
export function isHostMatchedByRules(host, rules) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
        return false;
    }
    const { exact, wildcards } = compileSiteRules(rules);
    if (exact.includes(normalizedHost)) {
        return true;
    }
    const hostParts = normalizedHost.split('.').length;
    return wildcards.some(({ suffix, parts }) => hostParts > parts && normalizedHost.endsWith(`.${suffix}`));
}

/**
 * 判断主机在当前模式下是否被拦截。
 */
export function isHostBlocked(host, rules, mode) {
    const matched = isHostMatchedByRules(host, rules);
    return mode === 'whitelist' ? !matched : matched;
}

/**
 * 查找最匹配当前主机的规则。
 */
export function findBestMatchingRule(host, rules = []) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
        return '';
    }
    const normalizedRules = rules.map(normalizeSiteRule).filter(Boolean);
    const exactMatch = normalizedRules.find((rule) => !rule.startsWith('*.') && rule === normalizedHost);
    if (exactMatch) {
        return exactMatch;
    }
    const hostParts = normalizedHost.split('.').length;
    const wildcardMatches = normalizedRules.filter((rule) => {
        if (!rule.startsWith('*.')) {
            return false;
        }
        const suffix = rule.slice(2);
        const parts = suffix.split('.').length;
        return hostParts > parts && normalizedHost.endsWith(`.${suffix}`);
    });
    wildcardMatches.sort((a, b) => b.length - a.length);
    return wildcardMatches[0] || '';
}

/**
 * 生成规则候选集合。
 */
export function resolveSiteRuleCandidates(host) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
        return null;
    }
    const parts = normalizedHost.split('.').filter(Boolean);
    const parentSuffix = parts.length >= 2 ? parts.slice(-2).join('.') : normalizedHost;
    return {
        parentWildcard: `*.${parentSuffix}`,
        exact: normalizedHost,
        subdomainWildcard: `*.${normalizedHost}`
    };
}

/**
 * 解析批量导入的规则文本。
 */
export function parseSiteRuleBulkInput(content) {
    return String(content || '')
        .split(/[\r\n,，\s;；]+/)
        .map((token) => normalizeSiteRule(token))
        .filter(Boolean);
}

/**
 * 导出规则到文本文件。
 */
export function exportSiteRules(rules = [], filename = 'site-blacklist.txt') {
    const content = rules.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * 获取当前活动标签页。
 */
export async function getActiveTabs() {
    return queryActiveTabs();
}

/**
 * 通过内容脚本请求标签页主机名。
 */
export function requestTabHost(tabId) {
    return sendMessageToTab(tabId, { action: 'getPageHost' })
        .then((response) => (response && response.host ? response.host : ''));
}

/**
 * 获取当前活动页面主机名。
 */
export async function fetchCurrentSiteHost() {
    try {
        const tabs = await getActiveTabs();
        const tab = tabs[0];
        let host = '';
        if (tab && tab.url) {
            try {
                host = new URL(tab.url).hostname;
            } catch {
                host = '';
            }
        }
        if (!host && tab && tab.id != null) {
            host = await requestTabHost(tab.id);
        }
        return normalizeHost(host);
    } catch {
        return '';
    }
}
