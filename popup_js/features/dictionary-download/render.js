/**
 * 文件说明：dictionary-download 模块渲染逻辑。
 * 职责：负责词库列表、标签筛选与文件大小等纯视图渲染。
 */
import {
    DICT_DOWNLOAD_EMPTY_TEXT,
    DICT_DOWNLOAD_UNNAMED_TEXT,
    DICT_DOWNLOAD_COUNT_PREFIX,
    DICT_DOWNLOAD_UPDATED_AT_PREFIX
} from './constants.js';

/**
 * 格式化文件字节大小为易读文本。
 */
export function formatFileSize(bytes) {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / (k ** i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * 渲染词库标签筛选区。
 */
export function renderDictTagFilters({
    dictTagFilters,
    dictionaries,
    selectedDictTags,
    onTagChange
}) {
    if (!dictTagFilters) {
        return;
    }
    dictTagFilters.innerHTML = '';
    const tagSet = new Set();
    const sourceList = Array.isArray(dictionaries) ? dictionaries : [];
    sourceList.forEach((dict) => {
        const tags = Array.isArray(dict && dict.tags) ? dict.tags : [];
        tags.forEach((tag) => {
            const normalizedTag = String(tag || '').trim();
            if (normalizedTag) {
                tagSet.add(normalizedTag);
            }
        });
    });
    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    if (tags.length === 0) {
        dictTagFilters.style.display = 'none';
        return;
    }
    tags.forEach((tag) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dict-tag-chip';
        chip.textContent = tag;
        chip.addEventListener('click', () => {
            if (selectedDictTags.has(tag)) {
                selectedDictTags.delete(tag);
                chip.classList.remove('active');
            } else {
                selectedDictTags.add(tag);
                chip.classList.add('active');
            }
            onTagChange();
        });
        dictTagFilters.appendChild(chip);
    });
    dictTagFilters.style.display = 'flex';
}

/**
 * 渲染词库列表。
 */
export function renderDictList({
    dictList,
    dictionaries,
    query,
    normalizeWord,
    selectedDictTags,
    onDictionaryClick
}) {
    const sourceList = Array.isArray(dictionaries) ? dictionaries : [];
    const normalizedQuery = normalizeWord(query);
    const filtered = sourceList.filter((dict) => {
        const name = normalizeWord(dict && dict.name);
        const desc = normalizeWord(dict && dict.description);
        const filename = normalizeWord(dict && dict.filename);
        const searchMatched = !normalizedQuery || name.includes(normalizedQuery) || desc.includes(normalizedQuery) || filename.includes(normalizedQuery);
        if (!searchMatched) {
            return false;
        }
        if (selectedDictTags.size === 0) {
            return true;
        }
        const tags = Array.isArray(dict && dict.tags) ? dict.tags : [];
        const tagSet = new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean));
        for (const tag of selectedDictTags) {
            if (!tagSet.has(tag)) {
                return false;
            }
        }
        return true;
    });
    dictList.innerHTML = '';
    if (filtered.length === 0) {
        dictList.innerHTML = `<div style="text-align: center; color: #999; padding: 20px;">${DICT_DOWNLOAD_EMPTY_TEXT}</div>`;
        dictList.style.display = 'block';
        dictList.classList.add('show');
        return;
    }
    filtered.forEach((dict) => {
        const dictItem = document.createElement('div');
        dictItem.className = 'dict-item';

        const dictName = document.createElement('div');
        dictName.className = 'dict-name';
        dictName.textContent = dict.name || DICT_DOWNLOAD_UNNAMED_TEXT;

        const dictInfo = document.createElement('div');
        dictInfo.className = 'dict-info';

        const dictCount = document.createElement('span');
        dictCount.textContent = `${DICT_DOWNLOAD_COUNT_PREFIX}${dict.wordCount || 0}`;

        const dictSize = document.createElement('span');
        dictSize.className = 'dict-size';
        dictSize.textContent = formatFileSize(dict.size || 0);

        const dictLastModify = document.createElement('span');
        dictLastModify.className = 'dict-size';
        dictLastModify.textContent = `${DICT_DOWNLOAD_UPDATED_AT_PREFIX}${dict['last-modify'] || '-'}`;

        dictInfo.appendChild(dictCount);
        dictInfo.appendChild(dictSize);
        dictInfo.appendChild(dictLastModify);
        dictItem.appendChild(dictName);
        dictItem.appendChild(dictInfo);

        const dictDescription = String(dict.description || '').trim();
        if (dictDescription) {
            const desc = document.createElement('div');
            desc.className = 'dict-description';
            desc.textContent = dictDescription;
            dictItem.appendChild(desc);
        }
        dictItem.addEventListener('click', () => {
            onDictionaryClick(dict);
        });
        dictList.appendChild(dictItem);
    });
    dictList.style.display = 'block';
    dictList.classList.add('show');
}

