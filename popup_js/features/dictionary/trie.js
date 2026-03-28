/**
 * 文件说明：词库 Trie 能力兼容导出层。
 * 职责：向下兼容旧路径，实际实现位于 shared/tools/trie.js。
 */
export {
    buildChineseTrieIndex,
    buildEnglishTrieIndex
} from '../../shared/tools/trie.js';
