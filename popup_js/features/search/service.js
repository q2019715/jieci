/**
 * 文件说明：search 模块服务层。
 */
import {
    SEARCH_MAX_SETTINGS_RESULTS,
    SEARCH_MAX_WORD_RESULTS
} from './constants.js';

function normalizeText(input) {
    return String(input || '').trim().toLowerCase();
}

function hasChineseChars(input) {
    return /[\u4e00-\u9fff]/.test(String(input || ''));
}

function splitMeaningsText(text) {
    return String(text || '')
        .split(/[,，、；;]/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function getFirstMeaning(entry) {
    const byType = entry && entry.byType ? entry.byType : {};
    const keys = Object.keys(byType);
    for (const key of keys) {
        const meanings = Array.isArray(byType[key].meanings) ? byType[key].meanings : [];
        if (meanings.length > 0) {
            return meanings[0];
        }
    }
    return '';
}

function collectUniqueMeanings(entry) {
    const byType = entry && entry.byType ? entry.byType : {};
    const all = [];
    Object.values(byType).forEach((typeData) => {
        const meanings = Array.isArray(typeData && typeData.meanings) ? typeData.meanings : [];
        meanings.forEach((meaning) => {
            const text = String(meaning || '').trim();
            if (!text || all.includes(text)) {
                return;
            }
            all.push(text);
        });
    });
    return all;
}

function buildMeaningPreview(entry, normalizedQuery, limit = 3) {
    const allMeanings = collectUniqueMeanings(entry);
    if (allMeanings.length === 0) {
        const fallback = getFirstMeaning(entry);
        if (!fallback) {
            return [];
        }
        return [{ text: fallback, matched: false }];
    }
    const matched = [];
    const others = [];
    allMeanings.forEach((meaning) => {
        if (normalizeText(meaning).includes(normalizedQuery)) {
            matched.push({ text: meaning, matched: true });
        } else {
            others.push({ text: meaning, matched: false });
        }
    });
    return [...matched, ...others].slice(0, limit);
}

function toSourceName(name) {
    return String(name || '').replace(/\.json$/i, '').trim();
}

function ensureWordEntry(map, word) {
    const normalizedWord = normalizeText(word);
    if (!normalizedWord) {
        return null;
    }
    if (!map.has(normalizedWord)) {
        map.set(normalizedWord, {
            word: normalizedWord,
            byType: {},
            phonetics: { uk: '', us: '' },
            phrases: [],
            sentenceExamples: [],
            sources: []
        });
    }
    return map.get(normalizedWord);
}

function mergeTranslations(entry, translations, sourceName) {
    if (!Array.isArray(translations)) {
        return;
    }
    translations.forEach((item) => {
        const typeKey = normalizeText(item && item.type) || '_default';
        const rawType = String(item && item.type || '').trim();
        const meanings = splitMeaningsText(item && item.translation);
        if (!entry.byType[typeKey]) {
            entry.byType[typeKey] = {
                type: rawType,
                meanings: [],
                sources: []
            };
        }
        meanings.forEach((meaning) => {
            if (!entry.byType[typeKey].meanings.includes(meaning)) {
                entry.byType[typeKey].meanings.push(meaning);
            }
        });
        if (sourceName && !entry.byType[typeKey].sources.includes(sourceName)) {
            entry.byType[typeKey].sources.push(sourceName);
        }
    });
}

function mergePhrases(entry, phrases, sourceName) {
    if (!Array.isArray(phrases)) {
        return;
    }
    phrases.forEach((phrase) => {
        const phraseText = String(phrase && phrase.phrase || '').trim();
        if (!phraseText) {
            return;
        }
        let existing = entry.phrases.find((item) => item.phrase === phraseText);
        if (!existing) {
            existing = { phrase: phraseText, translations: [], sources: [] };
            entry.phrases.push(existing);
        }
        let candidates = [];
        if (Array.isArray(phrase.translations)) {
            candidates = phrase.translations;
        } else if (Array.isArray(phrase.trans)) {
            candidates = phrase.trans;
        } else if (Array.isArray(phrase.meanings)) {
            candidates = phrase.meanings;
        } else if (typeof phrase.translation === 'string') {
            candidates = [phrase.translation];
        } else if (typeof phrase.trans === 'string') {
            candidates = [phrase.trans];
        }
        candidates
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .forEach((translation) => {
                if (!existing.translations.includes(translation)) {
                    existing.translations.push(translation);
                }
            });
        if (sourceName && !existing.sources.includes(sourceName)) {
            existing.sources.push(sourceName);
        }
    });
}

function mergeExamples(entry, examples) {
    if (!Array.isArray(examples)) {
        return;
    }
    examples.forEach((example) => {
        const en = String(example && example.en || '').trim();
        const zh = String(example && example.zh || '').trim();
        if (!en && !zh) {
            return;
        }
        const exists = entry.sentenceExamples.some((item) => item.en === en && item.zh === zh);
        if (!exists) {
            entry.sentenceExamples.push({ en, zh });
        }
    });
}

function mergePhonetics(entry, phonetics) {
    if (!phonetics || typeof phonetics !== 'object') {
        return;
    }
    if (!entry.phonetics.uk && typeof phonetics.uk === 'string') {
        entry.phonetics.uk = phonetics.uk;
    }
    if (!entry.phonetics.us && typeof phonetics.us === 'string') {
        entry.phonetics.us = phonetics.us;
    }
}

export function buildWordIndex(vocabularies) {
    const map = new Map();
    const list = Array.isArray(vocabularies) ? vocabularies : [];
    list.forEach((vocab) => {
        const sourceName = toSourceName(vocab && vocab.name);
        const data = Array.isArray(vocab && vocab.data) ? vocab.data : [];
        data.forEach((item) => {
            const word = String(item && item.word || '').trim();
            const entry = ensureWordEntry(map, word);
            if (!entry) {
                return;
            }
            mergeTranslations(entry, item.translations, sourceName);
            mergePhrases(entry, item.phrases, sourceName);
            mergeExamples(entry, item.sentence_examples || item.sentenceExamples);
            mergePhonetics(entry, item.phonetics);
            if (sourceName && !entry.sources.includes(sourceName)) {
                entry.sources.push(sourceName);
            }
        });
    });
    return map;
}

export function searchSettings(settingsItems, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return [];
    }
    return (Array.isArray(settingsItems) ? settingsItems : [])
        .map((item) => {
            const title = normalizeText(item.title);
            const description = normalizeText(item.description);
            const keywordText = (Array.isArray(item.keywords) ? item.keywords : []).map(normalizeText).join(' ');
            let score = 0;
            if (title === normalizedQuery) score += 160;
            if (title.includes(normalizedQuery)) score += 120;
            if (description.includes(normalizedQuery)) score += 70;
            if (keywordText.includes(normalizedQuery)) score += 80;
            return { ...item, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, SEARCH_MAX_SETTINGS_RESULTS);
}

export function searchWords(wordIndex, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery || !(wordIndex instanceof Map)) {
        return [];
    }
    const chineseQuery = hasChineseChars(normalizedQuery);
    const results = [];
    wordIndex.forEach((entry) => {
        let score = 0;
        if (entry.word === normalizedQuery) {
            score += 220;
        } else if (entry.word.startsWith(normalizedQuery)) {
            score += 140;
        } else if (entry.word.includes(normalizedQuery)) {
            score += 90;
        }
        Object.values(entry.byType || {}).forEach((typeData) => {
            (Array.isArray(typeData.meanings) ? typeData.meanings : []).forEach((meaning) => {
                const normalizedMeaning = normalizeText(meaning);
                if (normalizedMeaning.includes(normalizedQuery)) {
                    score += chineseQuery ? 120 : 60;
                }
            });
        });
        (Array.isArray(entry.phrases) ? entry.phrases : []).forEach((phrase) => {
            const phraseText = normalizeText(phrase.phrase);
            if (phraseText.includes(normalizedQuery)) {
                score += 40;
            }
            (Array.isArray(phrase.translations) ? phrase.translations : []).forEach((translation) => {
                if (normalizeText(translation).includes(normalizedQuery)) {
                    score += 30;
                }
            });
        });
        if (score <= 0) {
            return;
        }
        results.push({
            score,
            summary: getFirstMeaning(entry),
            previewMeanings: buildMeaningPreview(entry, normalizedQuery, 5),
            entry
        });
    });

    return results
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.entry.word.localeCompare(b.entry.word);
        })
        .slice(0, SEARCH_MAX_WORD_RESULTS);
}

export function analyzeQuery(query) {
    const normalized = normalizeText(query);
    return {
        normalized,
        hasChinese: hasChineseChars(normalized)
    };
}
