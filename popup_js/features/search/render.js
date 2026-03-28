/**
 * 文件说明：search 模块渲染层。
 */

function createResultButton(doc, { title, subtitle, subtitleNode, onClick }) {
    const button = doc.createElement('button');
    button.className = 'search-result-item';
    button.type = 'button';

    const main = doc.createElement('div');
    main.className = 'search-result-main';
    main.textContent = title;
    button.appendChild(main);

    if (subtitleNode) {
        button.appendChild(subtitleNode);
    } else if (subtitle) {
        const sub = doc.createElement('div');
        sub.className = 'search-result-sub';
        sub.textContent = subtitle;
        button.appendChild(sub);
    }

    button.addEventListener('click', onClick);
    return button;
}

function createWordSubtitleNode(doc, meanings) {
    if (!Array.isArray(meanings) || meanings.length === 0) {
        return null;
    }
    const sub = doc.createElement('div');
    sub.className = 'search-result-sub';
    meanings.forEach((meaning, index) => {
        if (meaning && meaning.matched) {
            const part = doc.createElement('strong');
            part.className = 'search-result-sub-match';
            part.textContent = meaning && meaning.text ? meaning.text : '';
            sub.appendChild(part);
        } else {
            const part = doc.createElement('span');
            part.className = 'search-result-sub-item';
            part.textContent = meaning && meaning.text ? meaning.text : '';
            sub.appendChild(part);
        }
        if (index < meanings.length - 1) {
            sub.appendChild(doc.createTextNode('，'));
        }
    });
    return sub;
}

function createGroup(doc, title) {
    const group = doc.createElement('section');
    group.className = 'search-result-group';
    const heading = doc.createElement('div');
    heading.className = 'search-result-group-title';
    heading.textContent = title;
    group.appendChild(heading);
    return group;
}

export function renderSearchMeta(metaElement, text) {
    if (!metaElement) {
        return;
    }
    metaElement.textContent = text || '';
}

export function renderSearchResults({
    doc = document,
    resultsElement,
    settingsResults,
    wordResults,
    hasChinese,
    onSettingClick,
    onWordClick,
    noResultAction
}) {
    if (!resultsElement) {
        return;
    }
    resultsElement.replaceChildren();

    const renderSettings = () => {
        const group = createGroup(doc, `设置项 (${settingsResults.length})`);
        settingsResults.forEach((item) => {
            group.appendChild(createResultButton(doc, {
                title: item.title,
                subtitle: item.description,
                onClick: () => onSettingClick(item)
            }));
        });
        resultsElement.appendChild(group);
    };

    const renderWords = () => {
        const group = createGroup(doc, `词条 (${wordResults.length})`);
        wordResults.forEach((item) => {
            const subtitleNode = createWordSubtitleNode(doc, item.previewMeanings);
            group.appendChild(createResultButton(doc, {
                title: item.entry.word,
                subtitle: item.summary || '查看词条详情',
                subtitleNode,
                onClick: () => onWordClick(item.entry)
            }));
        });
        resultsElement.appendChild(group);
    };

    if (hasChinese) {
        if (settingsResults.length > 0) {
            renderSettings();
        }
        if (wordResults.length > 0) {
            renderWords();
        }
    } else {
        if (wordResults.length > 0) {
            renderWords();
        }
        if (settingsResults.length > 0) {
            renderSettings();
        }
    }

    if (resultsElement.childElementCount === 0 && noResultAction && typeof noResultAction.onClick === 'function') {
        const group = createGroup(doc, '搜索');
        group.appendChild(createResultButton(doc, {
            title: noResultAction.title || '暂无结果',
            subtitle: noResultAction.subtitle || '',
            onClick: noResultAction.onClick
        }));
        resultsElement.appendChild(group);
    }
}
