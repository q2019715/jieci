/**
 * 文件说明：Trie 共享工具。
 * 职责：提供中文/英文词条 Trie 索引构建能力。
 */

/**
 * Trie 节点。
 */
class TrieNode {
    /**
     * 初始化 Trie 节点结构。
     */
    constructor() {
        this.children = {};
        this.isEnd = false;
        this.word = null;
    }
}

/**
 * Trie 树结构。
 */
class Trie {
    /**
     * 初始化 Trie 根节点。
     */
    constructor() {
        this.root = new TrieNode();
    }

    /**
     * 向 Trie 插入一个完整词条。
     */
    insert(word) {
        let node = this.root;
        for (const char of word) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEnd = true;
        node.word = word;
    }

    /**
     * 将 Trie 导出为可存储对象。
     */
    serialize() {
        return this.root;
    }
}

/**
 * 从词库数组构建中文 Trie 索引。
 */
export function buildChineseTrieIndex(vocabularies) {
    const trie = new Trie();
    const vocabSet = new Set();
    vocabularies.forEach((vocab) => {
        vocab.data.forEach((item) => {
            if (item.translations && Array.isArray(item.translations)) {
                item.translations.forEach((trans) => {
                    const chinese = trans.translation;
                    if (!chinese) {
                        return;
                    }
                    const chineseWords = chinese.split(/[,、，]/);
                    chineseWords.forEach((cw) => {
                        const cleanChinese = cw.trim();
                        if (cleanChinese && !vocabSet.has(cleanChinese)) {
                            trie.insert(cleanChinese);
                            vocabSet.add(cleanChinese);
                        }
                    });
                });
            }
        });
    });
    return trie.serialize();
}

/**
 * 从英文词条数组构建 Trie 索引。
 */
export function buildEnglishTrieIndex(words) {
    const root = {};
    words.forEach((word) => {
        const cleanWord = String(word || '').trim().toLowerCase();
        if (!cleanWord) {
            return;
        }
        let node = root;
        for (const char of cleanWord) {
            if (!node[char]) {
                node[char] = {};
            }
            node = node[char];
        }
        node.$ = true;
    });
    return root;
}
