export interface SkmAnswerLike {
  idPertanyaan?: string | number | null;
  id_pertanyaan?: string | number | null;
  idPilihan?: string | number | null;
  id_pilihan?: string | number | null;
  tanggal?: string | Date | number | null;
  hasilNilai?: number | string | null;
  hasil_nilai?: number | string | null;
  nilai?: number | string | null;
  score?: number | string | null;
  pilihan?: {
    nilai?: number | string | null;
    score?: number | string | null;
  } | null;
  pilihanJawaban?: {
    nilai?: number | string | null;
    score?: number | string | null;
  } | null;
  pilihan_jawaban?: {
    nilai?: number | string | null;
    score?: number | string | null;
  } | null;
  maxScore?: number | string | null;
  max_score?: number | string | null;
}

export interface SkmOptions {
  no?: number;
  label?: string;
  variabel?: string;
  judul?: string;
  standar?: string;
}

export interface SkmDailyRow {
  no: number;
  variabel: string;
  byTanggal: Record<string, number>;
  jumlah_total: number;
  jumlah_sesuai: number;
  persen: number | null;
}

export interface SkmYearlyRow {
  judul: string;
  standar: string;
  data_bulan: Array<number | null>;
  data_tw: Array<number | null>;
  total_skor: number;
  total_maks: number;
  persen: number | null;
}

interface ScoreBucket {
  actual: number;
  max: number;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveQuestionId(answer: SkmAnswerLike): string {
  const id =
    answer.idPertanyaan ??
    answer.id_pertanyaan ??
    null;

  return id === null || id === undefined ? '' : String(id);
}

function parseDateLike(value: string | Date | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value).trim();
  if (raw.length === 0) {
    return null;
  }

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slashDateMatch = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashDateMatch) {
    const year = Number(slashDateMatch[1]);
    const month = Number(slashDateMatch[2]);
    const day = Number(slashDateMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDate(answer: SkmAnswerLike): Date | null {
  if (answer.tanggal === null || answer.tanggal === undefined || answer.tanggal === '') {
    return null;
  }

  return parseDateLike(answer.tanggal);
}

function resolveMaxScore(answer: SkmAnswerLike, maxScores: Record<number, number>): number {
  const questionId = resolveQuestionId(answer);
  const numericQuestionId = Number(questionId);
  if (Number.isFinite(numericQuestionId) && numericQuestionId in maxScores) {
    return toNumber(maxScores[numericQuestionId]);
  }

  const fallback =
    answer.maxScore ??
    answer.max_score ??
    answer.pilihan?.score ??
    answer.pilihan?.nilai ??
    answer.pilihanJawaban?.score ??
    answer.pilihanJawaban?.nilai ??
    answer.pilihan_jawaban?.score ??
    answer.pilihan_jawaban?.nilai ??
    null;

  const parsedFallback = toNullableNumber(fallback);
  return parsedFallback === null ? 0 : parsedFallback;
}

function resolveActualScore(answer: SkmAnswerLike): number | null {
  const value =
    answer.hasilNilai ??
    answer.hasil_nilai ??
    answer.score ??
    answer.nilai ??
    answer.pilihan?.score ??
    answer.pilihan?.nilai ??
    answer.pilihanJawaban?.score ??
    answer.pilihanJawaban?.nilai ??
    answer.pilihan_jawaban?.score ??
    answer.pilihan_jawaban?.nilai ??
    null;

  return toNullableNumber(value);
}

function resolveLabel(options?: SkmOptions): string {
  const label = options?.label ?? options?.variabel ?? options?.judul ?? 'SKM';
  const trimmed = String(label).trim();
  return trimmed.length > 0 ? trimmed : 'SKM';
}

function resolveStandar(options?: SkmOptions): string {
  const standar = options?.standar ?? '100%';
  const trimmed = String(standar).trim();
  return trimmed.length > 0 ? trimmed : '100%';
}

function createBucket(): ScoreBucket {
  return {
    actual: 0,
    max: 0,
  };
}

function accumulateByDay(answerRows: SkmAnswerLike[], maxScores: Record<number, number>): Map<string, ScoreBucket> {
  const buckets = new Map<string, ScoreBucket>();

  for (const answer of answerRows) {
    const date = resolveDate(answer);
    const questionId = resolveQuestionId(answer);
    const actual = resolveActualScore(answer);
    const max = resolveMaxScore(answer, maxScores);

    if (!date || !questionId || actual === null || !Number.isFinite(actual) || !Number.isFinite(max) || max <= 0) {
      continue;
    }

    const dayKey = `${date.getDate()}`;
    const bucket = buckets.get(dayKey) ?? createBucket();
    bucket.actual += actual;
    bucket.max += max;
    buckets.set(dayKey, bucket);
  }

  return buckets;
}

function bucketPercent(bucket: ScoreBucket | undefined): number | null {
  if (!bucket || bucket.max <= 0) {
    return null;
  }

  return roundToTwo((bucket.actual / bucket.max) * 100);
}

function bucketMonthlyPercent(answerRows: SkmAnswerLike[], maxScores: Record<number, number>, month: number): ScoreBucket {
  const bucket = createBucket();

  for (const answer of answerRows) {
    const date = resolveDate(answer);
    if (!date || date.getMonth() + 1 !== month) {
      continue;
    }

    const questionId = resolveQuestionId(answer);
    const actual = resolveActualScore(answer);
    const max = resolveMaxScore(answer, maxScores);

    if (!questionId || actual === null || !Number.isFinite(actual) || !Number.isFinite(max) || max <= 0) {
      continue;
    }

    bucket.actual += actual;
    bucket.max += max;
  }

  return bucket;
}

function bucketQuarterPercent(answerRows: SkmAnswerLike[], maxScores: Record<number, number>, quarterIndex: number): ScoreBucket {
  const bucket = createBucket();
  const monthStart = quarterIndex * 3 + 1;
  const monthEnd = monthStart + 2;

  for (const answer of answerRows) {
    const date = resolveDate(answer);
    if (!date) {
      continue;
    }

    const month = date.getMonth() + 1;
    if (month < monthStart || month > monthEnd) {
      continue;
    }

    const questionId = resolveQuestionId(answer);
    const actual = resolveActualScore(answer);
    const max = resolveMaxScore(answer, maxScores);

    if (!questionId || actual === null || !Number.isFinite(actual) || !Number.isFinite(max) || max <= 0) {
      continue;
    }

    bucket.actual += actual;
    bucket.max += max;
  }

  return bucket;
}

export function calculateSkmDailyStats(
  answerRows: SkmAnswerLike[],
  maxScores: Record<number, number>,
  options?: SkmOptions,
): SkmDailyRow {
  const byTanggal: Record<string, number> = {};
  const dayBuckets = accumulateByDay(answerRows, maxScores);

  const sortedDays = Array.from(dayBuckets.keys()).sort((a, b) => Number(a) - Number(b));
  for (const day of sortedDays) {
    const bucket = dayBuckets.get(day);
    const percent = bucketPercent(bucket);
    if (percent !== null) {
      byTanggal[day] = percent;
    }
  }

  let totalActual = 0;
  let totalMax = 0;
  for (const bucket of dayBuckets.values()) {
    totalActual += bucket.actual;
    totalMax += bucket.max;
  }

  return {
    no: typeof options?.no === 'number' && Number.isFinite(options.no) ? options.no : 0,
    variabel: resolveLabel(options),
    byTanggal,
    jumlah_total: totalMax,
    jumlah_sesuai: totalActual,
    persen: totalMax > 0 ? roundToTwo((totalActual / totalMax) * 100) : null,
  };
}

export function calculateSkmYearlyStats(
  answerRows: SkmAnswerLike[],
  maxScores: Record<number, number>,
  options?: SkmOptions,
): SkmYearlyRow {
  const data_bulan: Array<number | null> = [];
  const data_tw: Array<number | null> = [];

  let totalActual = 0;
  let totalMax = 0;

  for (let month = 1; month <= 12; month += 1) {
    const bucket = bucketMonthlyPercent(answerRows, maxScores, month);
    data_bulan.push(bucketPercent(bucket));
    totalActual += bucket.actual;
    totalMax += bucket.max;
  }

  for (let quarterIndex = 0; quarterIndex < 4; quarterIndex += 1) {
    const bucket = bucketQuarterPercent(answerRows, maxScores, quarterIndex);
    data_tw.push(bucketPercent(bucket));
  }

  return {
    judul: resolveLabel(options),
    standar: resolveStandar(options),
    data_bulan,
    data_tw,
    total_skor: totalActual,
    total_maks: totalMax,
    persen: totalMax > 0 ? roundToTwo((totalActual / totalMax) * 100) : null,
  };
}