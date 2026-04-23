export interface MonthlyGroupedRowLike {
  pasienSesuai?: number | string | null;
  pasien_sesuai?: number | string | null;
  totalPasien?: number | string | null;
  total_pasien?: number | string | null;
}

export interface MonthlyBucketLike {
  jumlah_sesuai: number;
  jumlah_total: number;
  persen: number | null;
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

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateBucket(rows: MonthlyGroupedRowLike[] | undefined): MonthlyBucketLike {
  const bucket: MonthlyBucketLike = {
    jumlah_sesuai: 0,
    jumlah_total: 0,
    persen: null,
  };

  if (!rows || rows.length === 0) {
    return bucket;
  }

  for (const row of rows) {
    bucket.jumlah_sesuai += toNumber(row.pasienSesuai ?? row.pasien_sesuai);
    bucket.jumlah_total += toNumber(row.totalPasien ?? row.total_pasien);
  }

  if (bucket.jumlah_total > 0) {
    bucket.persen = roundToTwo((bucket.jumlah_sesuai / bucket.jumlah_total) * 100);
  }

  return bucket;
}

export function calculateMonthlyStats(groupedData: Record<number, MonthlyGroupedRowLike[] | undefined>): Array<number | null> {
  const result: Array<number | null> = [];

  for (let month = 1; month <= 12; month += 1) {
    const bucket = calculateBucket(groupedData[month]);
    result.push(bucket.persen);
  }

  return result;
}