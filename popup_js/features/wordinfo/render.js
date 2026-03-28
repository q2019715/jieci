/**
 * 文件说明：wordinfo 模块渲染层。
 */

function createSpeakButton(onClick, label = '朗读') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wordinfo-inline-speak-btn';
    button.setAttribute('aria-label', label);
    button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"><path d="M4 10v4h4l5 4V6L8 10H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M16 9.5a4 4 0 0 1 0 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M18.5 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>';
    button.addEventListener('click', onClick);
    return button;
}

function hasChineseChars(text) {
    return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function renderList(container, lines) {
    if (!container) {
        return;
    }
    container.replaceChildren();
    if (!Array.isArray(lines) || lines.length === 0) {
        return;
    }
    lines.forEach((line, index) => {
        const item = document.createElement('div');
        item.className = 'wordinfo-list-item';
        if (index < lines.length - 1) {
            item.classList.add('has-divider');
        }
        item.textContent = line;
        container.appendChild(item);
    });
}

function renderMeaningList(container, groups) {
    if (!container) {
        return;
    }
    container.replaceChildren();
    if (!Array.isArray(groups) || groups.length === 0) {
        return;
    }
    groups.forEach((group) => {
        const item = document.createElement('div');
        item.className = 'wordinfo-meaning-item';

        const type = document.createElement('span');
        type.className = 'wordinfo-meaning-type';
        type.textContent = String(group && group.type || '-');
        item.appendChild(type);

        const text = document.createElement('div');
        text.className = 'wordinfo-meaning-text';
        const meanings = Array.isArray(group && group.meanings) ? group.meanings.filter(Boolean) : [];
        if (meanings.length > 0) {
            const primary = document.createElement('span');
            primary.className = 'wordinfo-meaning-primary';
            primary.textContent = meanings[0];
            text.appendChild(primary);
            if (meanings.length > 1) {
                const rest = document.createElement('span');
                rest.textContent = `、${meanings.slice(1).join('、')}`;
                text.appendChild(rest);
            }
        } else {
            text.textContent = '-';
        }
        item.appendChild(text);

        container.appendChild(item);
    });
}

function renderPhraseList(container, phrases, onSpeakText) {
    if (!container) {
        return;
    }
    container.replaceChildren();
    if (!Array.isArray(phrases) || phrases.length === 0) {
        return;
    }
    phrases.forEach((phrase, index) => {
        const item = document.createElement('div');
        item.className = 'wordinfo-list-item';
        if (index < phrases.length - 1) {
            item.classList.add('has-divider');
        }
        const row = document.createElement('div');
        row.className = 'wordinfo-inline-row';

        const text = document.createElement('span');
        text.className = 'wordinfo-inline-text';
        text.textContent = phrase && phrase.text ? phrase.text : '';
        row.appendChild(text);

        if (phrase && phrase.speakText && typeof onSpeakText === 'function' && !hasChineseChars(phrase.speakText)) {
            row.appendChild(createSpeakButton(() => onSpeakText(phrase.speakText), '朗读短语'));
        }

        item.appendChild(row);
        container.appendChild(item);
    });
}

function renderExampleList(container, examples, onSpeakText) {
    if (!container) {
        return;
    }
    container.replaceChildren();
    if (!Array.isArray(examples) || examples.length === 0) {
        return;
    }
    examples.forEach((example) => {
        const item = document.createElement('div');
        item.className = 'wordinfo-example-item';

        if (example.en) {
            const enRow = document.createElement('div');
            enRow.className = 'wordinfo-inline-row';
            const enLine = document.createElement('div');
            enLine.className = 'wordinfo-example-en wordinfo-inline-text';
            enLine.textContent = example.en;
            enRow.appendChild(enLine);
            if (typeof onSpeakText === 'function' && !hasChineseChars(example.en)) {
                enRow.appendChild(createSpeakButton(() => onSpeakText(example.en), '朗读英文例句'));
            }
            item.appendChild(enRow);
        }

        if (example.zh) {
            const zhRow = document.createElement('div');
            zhRow.className = 'wordinfo-inline-row';
            const zhLine = document.createElement('div');
            zhLine.className = 'wordinfo-example-zh wordinfo-inline-text';
            zhLine.textContent = example.zh;
            zhRow.appendChild(zhLine);
            item.appendChild(zhRow);
        }

        container.appendChild(item);
    });
}

function setSectionVisibility(container, visible) {
    if (!container || typeof container.closest !== 'function') {
        return;
    }
    const section = container.closest('.wordinfo-section');
    if (!section) {
        return;
    }
    section.style.display = visible ? '' : 'none';
}

function formatPhonetics(phonetics) {
    if (!phonetics || typeof phonetics !== 'object') {
        return '-';
    }
    const parts = [];
    if (phonetics.uk) {
        parts.push(`UK ${phonetics.uk}`);
    }
    if (phonetics.us) {
        parts.push(`US ${phonetics.us}`);
    }
    return parts.length > 0 ? parts.join(' | ') : '-';
}

function formatMeanings(byType) {
    if (!byType || typeof byType !== 'object') {
        return [];
    }
    const groups = [];
    Object.values(byType).forEach((typeData) => {
        const label = String(typeData && typeData.type || '').trim() || '-';
        const meanings = Array.isArray(typeData && typeData.meanings) ? typeData.meanings : [];
        if (meanings.length === 0) {
            return;
        }
        groups.push({
            type: label,
            meanings
        });
    });
    return groups;
}

function formatPhrases(phrases) {
    if (!Array.isArray(phrases)) {
        return [];
    }
    return phrases
        .map((phrase) => {
            const text = String(phrase && phrase.phrase || '').trim();
            const translations = Array.isArray(phrase && phrase.translations) ? phrase.translations : [];
            if (!text) {
                return null;
            }
            if (translations.length === 0) {
                return { text, speakText: text };
            }
            return {
                text: `${text}: ${translations.join('、')}`,
                speakText: text
            };
        })
        .filter(Boolean);
}

function formatExamples(examples) {
    if (!Array.isArray(examples)) {
        return [];
    }
    return examples
        .map((example) => {
            const en = String(example && example.en || '').trim();
            const zh = String(example && example.zh || '').trim();
            return { en, zh };
        })
        .filter((example) => Boolean(example.en || example.zh));
}

export function renderWordInfo(elements, entry, handlers = {}) {
    const {
        wordInfoSearchBtn,
        wordInfoFavoriteBtn,
        wordInfoBlockBtn,
        wordInfoWord,
        wordInfoSpeakBtn,
        wordInfoPhonetics,
        wordInfoMeanings,
        wordInfoPhrases,
        wordInfoExamples,
        wordInfoSources,
        wordInfoEmpty
    } = elements;
    const onSpeakText = typeof handlers.onSpeakText === 'function' ? handlers.onSpeakText : null;
    const wordActions = handlers.wordActions || {};

    if (wordInfoEmpty) {
        wordInfoEmpty.textContent = '请选择一个词条';
        wordInfoEmpty.style.display = entry ? 'none' : 'block';
    }
    if (!entry) {
        if (wordInfoSearchBtn) wordInfoSearchBtn.style.display = 'none';
        if (wordInfoFavoriteBtn) wordInfoFavoriteBtn.style.display = 'none';
        if (wordInfoBlockBtn) wordInfoBlockBtn.style.display = 'none';
        if (wordInfoWord) wordInfoWord.textContent = '-';
        if (wordInfoSpeakBtn) wordInfoSpeakBtn.style.display = 'none';
        if (wordInfoPhonetics) wordInfoPhonetics.textContent = '-';
        renderMeaningList(wordInfoMeanings, []);
        renderPhraseList(wordInfoPhrases, [], onSpeakText);
        renderExampleList(wordInfoExamples, [], onSpeakText);
        renderList(wordInfoSources, []);
        setSectionVisibility(wordInfoMeanings, false);
        setSectionVisibility(wordInfoPhrases, false);
        setSectionVisibility(wordInfoExamples, false);
        setSectionVisibility(wordInfoSources, false);
        return;
    }

    if (wordInfoWord) {
        wordInfoWord.textContent = entry.word || '-';
    }
    if (wordInfoSearchBtn) {
        wordInfoSearchBtn.style.display = 'inline-flex';
    }
    if (wordInfoFavoriteBtn) {
        wordInfoFavoriteBtn.style.display = 'inline-flex';
        wordInfoFavoriteBtn.classList.toggle('is-active', wordActions.isFavorite === true);
        wordInfoFavoriteBtn.title = wordActions.isFavorite === true ? '取消收藏' : '收藏词条';
    }
    if (wordInfoBlockBtn) {
        wordInfoBlockBtn.style.display = 'inline-flex';
        const blocked = wordActions.isBlocked === true;
        wordInfoBlockBtn.classList.toggle('is-active', blocked);
        wordInfoBlockBtn.disabled = false;
        wordInfoBlockBtn.title = blocked ? '取消屏蔽词条' : '屏蔽词条';
    }
    if (wordInfoSpeakBtn) {
        wordInfoSpeakBtn.style.display = hasChineseChars(entry.word) ? 'none' : 'inline-flex';
    }
    if (wordInfoPhonetics) {
        wordInfoPhonetics.textContent = formatPhonetics(entry.phonetics);
    }
    const meanings = formatMeanings(entry.byType);
    const phrases = formatPhrases(entry.phrases);
    const examples = formatExamples(entry.sentenceExamples);
    const sources = Array.isArray(entry.sources) ? entry.sources : [];
    const hasPhonetics = Boolean(entry.phonetics && (entry.phonetics.uk || entry.phonetics.us));
    const hasDetails = meanings.length > 0 || phrases.length > 0 || examples.length > 0 || sources.length > 0 || hasPhonetics;

    if (wordInfoPhonetics && !hasPhonetics) {
        wordInfoPhonetics.textContent = hasDetails
            ? '-'
            : '很抱歉，当前已下载词库并没有关于这个词的信息';
    }

    renderMeaningList(wordInfoMeanings, meanings);
    renderPhraseList(wordInfoPhrases, phrases, onSpeakText);
    renderExampleList(wordInfoExamples, examples, onSpeakText);
    renderList(wordInfoSources, sources);
    if (wordInfoEmpty) {
        wordInfoEmpty.textContent = '';
        wordInfoEmpty.style.display = 'none';
    }
    setSectionVisibility(wordInfoMeanings, meanings.length > 0);
    setSectionVisibility(wordInfoPhrases, phrases.length > 0);
    setSectionVisibility(wordInfoExamples, examples.length > 0);
    setSectionVisibility(wordInfoSources, sources.length > 0);
}
