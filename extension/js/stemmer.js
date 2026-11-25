import { STOP_WORDS } from './stopwords.js';

export const RuStemmer = {
  endings: [
    'ами', 'ями', 'ому', 'ему', 'ыми', 'ими', 'ой', 'ей', 'ов', 'ев', 'ам',
    'ям', 'ах', 'ях', 'ом', 'ем', 'ую', 'юю', 'ый', 'ий', 'ая', 'яя', 'ое',
    'ее', 'ы', 'и', 'а', 'я', 'у', 'ю', 'о', 'е', 'ь'
  ],
  stem(word) {
    const w = word.toLowerCase().trim();
    if (w.length <= 3) return w;
    for (const e of this.endings) {
      if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
    }
    return w;
  }
};

export const Tokenizer = {
  raw(text) {
    return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 2);
  },
  stems(text) {
    return [...new Set(
      this.raw(text)
        .filter(w => !STOP_WORDS.homo.has(w) && !STOP_WORDS.func.has(w) && !STOP_WORDS.verbs.has(w))
        .map(w => RuStemmer.stem(w))
        .filter(w => w.length >= 3)
    )];
  },
  bigramStems(text) {
    return this.raw(text)
      .filter(w => !STOP_WORDS.homo.has(w) && !STOP_WORDS.func.has(w))
      .map(w => RuStemmer.stem(w))
      .filter(w => w.length >= 2);
  },
  bigrams(text) {
    const s = this.bigramStems(text);
    if (s.length < 2) return [];
    const res = [];
    for (let i = 0; i < s.length - 1; i++) res.push(`${s[i]} ${s[i + 1]}`);
    return res;
  }
};
