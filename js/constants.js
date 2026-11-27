export const TUNING = Object.freeze({
  CONFLICT_RATIO_THRESHOLD: 0.55,
  HIGH_CONFIDENCE_GUARD: 0.7,
  PROVISIONAL_MIN_DISTINCT_NOTES: 2,
  CONFIRMED_MIN_EVIDENCE: 4,
  CONFIRMED_MIN_DISTINCT_NOTES: 3,
  CONFIRMED_MIN_RATIO: 0.7,
  DECAY_DAYS: 30,
  DECAY_AMOUNT: 1,
  RETIRE_AFTER_DAYS: 90,
  FUZZY_MIN_LENGTH: 5,
  FUZZY_MAX_DISTANCE_SHORT: 1,
  FUZZY_MAX_DISTANCE_LONG: 2,
  FUZZY_MIN_CONFIDENCE: 0.7,
  SEED_EXACT_CONFIDENCE: 1.0,
  SEED_BIGRAM_CONFIDENCE: 0.95,
  SEED_HIGH_CONFIDENCE: 0.6,
  LEARNED_MIN_CONFIDENCE: 0.5,
  LEARNED_CONFIRMED_CONFIDENCE: 0.7,
  CORRECTION_DEBOUNCE_MS: 5000,
  CORRECTION_SESSION_GAP_MS: 30000,
  LONG_PRESS_MS: 300,
  DUPLICATE_ADD_WINDOW_MS: 2000,
  SLEEPING_BRANCH_DAYS: 14,
  STALE_AFTER_DAYS: 7,
  MIN_BOOT_MS_FOR_FALLBACK: 300000,
  DIAGNOSTIC_TAPS_REQUIRED: 7,
  BACKUP_INTERVAL_DAYS: 3,
  BACKUP_FOLDER: 'LiveNotepad',
  DIGEST_MAX_CLUSTER_HINT: 3,
  GRAPH_EDGE_THRESHOLD: 0.3,
  GRAPH_SAME_BRANCH_WEIGHT: 0.2,
  GRAPH_TEMPORAL_WEIGHT: 0.1,
  GRAPH_TEMPORAL_SCALE_MS: 6 * 60 * 60 * 1000,
  SHEET_OVERFLOW_THRESHOLD: 5
});

export const BRANCHES = {
  rabota: { name: 'работа', color: 'var(--branch-rabota)', form: 'solid' },
  byt: { name: 'быт', color: 'var(--branch-byt)', form: 'dotted' },
  ljudi: { name: 'люди', color: 'var(--branch-ljudi)', form: 'dashed' },
  zdorovie: { name: 'здоровье', color: 'var(--branch-zdorovie)', form: 'wavy' },
  ucheba: { name: 'учёба', color: 'var(--branch-ucheba)', form: 'double' }
};

export const BRANCH_KEYS = Object.keys(BRANCHES);

export const BRANCH_SOURCES = Object.freeze([
  'SEED',
  'NONE',
  'LEARNED_CONFIRMED',
  'LEARNED_PROVISIONAL',
  'TIME_FALLBACK',
  'USER_CORRECTED'
]);
