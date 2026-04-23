export interface QuarterGroupedRowLike {
  pasienSesuai?: number | string | null;
  pasien_sesuai?: number | string | null;
  totalPasien?: number | string | null;
  total_pasien?: number | string | null;
}

export interface TriwulanBucketLike {
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

function calculateBucket(rows: QuarterGroupedRowLike[] | undefined): TriwulanBucketLike {
  const bucket: TriwulanBucketLike = {
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

export function calculateTriwulanStats(groupedData: Record<number, QuarterGroupedRowLike[] | undefined>): Array<number | null> {
  const quarterMonths: number[][] = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];

  return quarterMonths.map((months) => {
    const mergedRows: QuarterGroupedRowLike[] = [];

    for (const month of months) {
      const rows = groupedData[month];
      if (rows && rows.length > 0) {
        mergedRows.push(...rows);
      }
    }

    const bucket = calculateBucket(mergedRows);
    return bucket.persen;
  });
}