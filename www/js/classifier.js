import { TUNING } from './constants.js';
import { RuStemmer, Tokenizer } from './stemmer.js';
import { DamerauLevenshtein } from './distance.js';

export const SEEDS_DATA = {
  words: {
    rabota: [
      'отчёт', 'созвон', 'дедлайн', 'презентация', 'клиент', 'договор',
      'проект', 'совещание', 'коллега', 'начальник', 'офис', 'документ',
      'бюджет', 'конференция', 'собеседование', 'резюме', 'вакансия', 'письмо',
      'задача', 'митинг', 'образцы', 'код', 'ревью'
    ],
    byt: [
      'молоко', 'хлеб', 'магазин', 'продукты', 'посуда', 'пылесос', 'ремонт',
      'доставка', 'посылка', 'бензин', 'шины', 'машина', 'дача', 'огород',
      'обед', 'ужин', 'завтрак', 'квартира', 'уборка', 'стирка', 'покупка',
      'аптека', 'рецепт', 'оплатить', 'счёт'
    ],
    ljudi: [
      'мама', 'маме', 'папа', 'папе', 'друг', 'другу', 'подруга', 'подруге',
      'поздравление', 'бабушка', 'дедушка', 'брат', 'сестра', 'жена', 'муж',
      'сын', 'дочь', 'свидание', 'сосед', 'гости', 'приглашение', 'семья'
    ],
    zdorovie: [
      'врач', 'таблетки', 'витамины', 'спорт', 'зал', 'тренировка', 'анализы',
      'зуб', 'стоматолог', 'больница', 'поликлиника', 'давление', 'лекарство',
      'массаж', 'бассейн', 'бег', 'йога', 'фитнес', 'процедура'
    ],
    ucheba: [
      'конспект', 'экзамен', 'курс', 'лекция', 'семинар', 'зачёт', 'сессия',
      'учебник', 'реферат', 'курсовая', 'диплом', 'преподаватель', 'школа',
      'универ', 'тест', 'задание', 'домашка'
    ]
  },
  bigrams: {
    rabota: [
      'встреча клиент', 'заказ клиент', 'письмо клиент', 'сдать отчёт',
      'созвон клиент', 'проверить почта', 'согласовать бюджет',
      'подготовить презентация', 'написать письмо', 'отправить отчёт'
    ],
    byt: [
      'купить молоко', 'купить хлеб', 'забрать посылка', 'отвезти дача',
      'заправить машина', 'помыть машина', 'приготовить обед',
      'приготовить ужин', 'заказ еда', 'вызвать мастер',
      'сходить магазин', 'купить продукт', 'оплатить счёт',
      'помыть посуда', 'вынести мусор'
    ],
    ljudi: [
      'позвонить мама', 'позвонить папа', 'написать мама', 'забрать ребёнок',
      'отвезти мама', 'договориться сосед', 'встреча друг', 'встреча подруга',
      'поздравить бабушка', 'навестить родитель',
      'купить подарок', 'пригласить гости', 'навестить бабушка', 'поздравить друг'
    ],
    zdorovie: [
      'записаться врач', 'сдать анализы', 'выпить таблетка', 'пойти зал',
      'записаться стоматолог', 'сдать кровь', 'записаться массаж',
      'купить витамины', 'пройти осмотр'
    ],
    ucheba: [
      'прочитать статья', 'прочитать книга', 'дочитать отчёт', 'сдать экзамен',
      'написать реферат', 'сделать задание',
      'сдать сессия', 'подготовить доклад', 'написать курсовой', 'посетить лекция'
    ]
  }
};

export const SeedsClassifier = (() => {
  const wordSeeds = new Map();
  const bigramSeeds = new Map();
  for (const [branch, words] of Object.entries(SEEDS_DATA.words)) {
    for (const w of words) wordSeeds.set(RuStemmer.stem(w), branch);
  }
  for (const [branch, bigrams] of Object.entries(SEEDS_DATA.bigrams)) {
    for (const bg of bigrams) {
      const p = bg.split(' ').map(w => RuStemmer.stem(w));
      if (p.length === 2) bigramSeeds.set(`${p[0]} ${p[1]}`, branch);
    }
  }
  return {
    classify(text) {
      for (const bg of Tokenizer.bigrams(text)) {
        if (bigramSeeds.has(bg)) {
          return {
            branch: bigramSeeds.get(bg),
            confidence: TUNING.SEED_BIGRAM_CONFIDENCE,
            matched: bg,
            source: 'SEED'
          };
        }
      }
      const stems = Tokenizer.stems(text);
      if (stems.length === 0) return null;
      for (const s of stems) {
        if (wordSeeds.has(s)) {
          return {
            branch: wordSeeds.get(s),
            confidence: TUNING.SEED_EXACT_CONFIDENCE,
            matched: s,
            source: 'SEED'
          };
        }
      }
      for (const s of stems) {
        if (s.length < TUNING.FUZZY_MIN_LENGTH) continue;
        const maxD = s.length <= 6 ? TUNING.FUZZY_MAX_DISTANCE_SHORT : TUNING.FUZZY_MAX_DISTANCE_LONG;
        let bestSeed = null;
        let bestD = Infinity;
        for (const seed of wordSeeds.keys()) {
          if (Math.abs(seed.length - s.length) > maxD) continue;
          const d = DamerauLevenshtein.distance(s, seed, maxD);
          if (d <= maxD && d < bestD) {
            bestD = d;
            bestSeed = seed;
          }
        }
        if (bestSeed !== null) {
          const conf = 0.9 - bestD * 0.15;
          if (conf >= TUNING.FUZZY_MIN_CONFIDENCE) {
            return {
              branch: wordSeeds.get(bestSeed),
              confidence: conf,
              matched: bestSeed,
              source: 'SEED'
            };
          }
        }
      }
      return null;
    }
  };
})();
