import { addDays, atTime, endOfDay, nextWeekday, startOfDay } from './time.js';

// JS `\b` не работает с кириллицей: используем Unicode-границы.
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';

const DAY_WORDS = new Map([
  ['послезавтра', 2],
  ['завтра', 1],
  ['сегодня', 0],
  ['сёдня', 0]
]);

const WEEKDAYS = new Map([
  ['понедельник', 1], ['пн', 1], ['пон', 1],
  ['вторник', 2], ['вт', 2],
  ['среда', 3], ['среду', 3], ['ср', 3],
  ['четверг', 4], ['чт', 4], ['четв', 4],
  ['пятница', 5], ['пятницу', 5], ['пт', 5],
  ['суббота', 6], ['субботу', 6], ['сб', 6],
  ['воскресенье', 0], ['вс', 0]
]);

const dayRe = new RegExp(`${B}(послезавтра|завтра|сегодня|сёдня)${E}`, 'u');
const weekdayRe = new RegExp(`${B}(?:во|в)\\s+([\\p{L}]+)${E}`, 'gu');
const timeRe = new RegExp(`${B}(до|к|во|в)\\s+(\\d{1,2})(?::(\\d{2}))?${E}`, 'u');
const bareTimeRe = new RegExp(`${B}(\\d{1,2}):(\\d{2})${E}`, 'u');
const throughRe = new RegExp(
  `${B}через\\s+(\\d+)\\s*(час(?:а|ов)?|минут(?:а|ы)?|день|дня|дней|недел(?:я|и|ь|ю))${E}`,
  'u'
);
const halfHourRe = new RegExp(`${B}через\\s+полчаса${E}`, 'u');
const dayPartRe = /^\s*(утра|утром|дня|днём|вечера|вечером|ночи|ночью)/u;

function build(dueAt, matchedText, confidence) {
  return { dueAt, source: 'PARSED', matchedText, confidence };
}

export const DueParser = {
  parse(text, now = Date.now()) {
    const lower = text.toLowerCase();
    let baseDay = null;
    let dayMatched = null;

    // 1. Относительные часы/минуты — точный момент, не конец дня.
    const half = halfHourRe.exec(lower);
    if (half) return build(now + 30 * 60000, half[0], 0.9);

    const rel = throughRe.exec(lower);
    if (rel) {
      const n = parseInt(rel[1], 10);
      const unit = rel[2];
      if (unit.startsWith('час')) return build(now + n * 3600000, rel[0], 0.9);
      if (unit.startsWith('минут')) return build(now + n * 60000, rel[0], 0.9);
      const days = unit.startsWith('недел') ? n * 7 : n;
      baseDay = startOfDay(addDays(now, days));
      dayMatched = rel[0];
    }

    // 2. Сегодня / завтра / послезавтра.
    if (baseDay === null) {
      const dm = dayRe.exec(lower);
      if (dm) {
        baseDay = startOfDay(addDays(now, DAY_WORDS.get(dm[1])));
        dayMatched = dm[0];
      }
    }

    // 3. День недели только с предлогом «в/во» — чтобы «среда обитания» не стала сроком.
    if (baseDay === null) {
      weekdayRe.lastIndex = 0;
      let wm;
      while ((wm = weekdayRe.exec(lower))) {
        const dow = WEEKDAYS.get(wm[1]);
        if (dow !== undefined) {
          baseDay = startOfDay(nextWeekday(now, dow));
          dayMatched = wm[0];
          break;
        }
      }
    }

    // 4. Время: «до 20», «к 20:30», «в 9», «в 9 вечера», «20:30».
    let hour = null;
    let minute = 0;
    let timeMatched = null;

    const tm = timeRe.exec(lower);
    if (tm) {
      const h = parseInt(tm[2], 10);
      const m = tm[3] ? parseInt(tm[3], 10) : 0;
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      hour = h;
      minute = m;
      timeMatched = tm[0];

      const after = lower.slice(tm.index + tm[0].length);
      const part = dayPartRe.exec(after);
      if (part) {
        const p = part[1];
        if ((p.startsWith('вечер') || p.startsWith('дня') || p.startsWith('днём')) && hour < 12) {
          hour += 12;
        } else if (p.startsWith('ноч') && hour === 12) {
          hour = 0;
        }
        timeMatched += ` ${p}`;
      }
    } else {
      const bm = bareTimeRe.exec(lower);
      if (bm) {
        const h = parseInt(bm[1], 10);
        const m = parseInt(bm[2], 10);
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        hour = h;
        minute = m;
        timeMatched = bm[0];
      }
    }

    if (baseDay === null && hour === null) return null;
    if (baseDay === null) return build(atTime(now, hour, minute), timeMatched, 0.8);
    if (hour === null) return build(endOfDay(baseDay), dayMatched, 0.85);
    return build(
      atTime(baseDay, hour, minute),
      `${dayMatched || ''} ${timeMatched || ''}`.trim(),
      0.9
    );
  }
};
