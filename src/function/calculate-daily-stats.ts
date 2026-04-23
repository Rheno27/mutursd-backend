export interface DailyStatsCell {
  pasien_sesuai: number;
  total_pasien: number;
}

export interface DailyStatsIndicatorLike {
  idIndikatorRuangan?: string | number | null;
  id_indikator_ruangan?: string | number | null;
  idIndikator?: string | number | null;
  id_indikator?: string | number | null;
  variabel?: string | null;
  nama?: string | null;
  indikator?: string | null;
  judul?: string | null;
  label?: string | null;
  no?: number | null;
  urutan?: number | null;
}

export interface DailyStatsRecordLike {
  idIndikatorRuangan?: string | number | null;
  id_indikator_ruangan?: string | number | null;
  tanggal?: string | Date | number | null;
  pasienSesuai?: number | string | null;
  pasien_sesuai?: number | string | null;
  totalPasien?: number | string | null;
  total_pasien?: number | string | null;
}

export interface DailyStatsRow {
  no: number;
  variabel: string;
  byTanggal: Record<string, DailyStatsCell>;
  jumlah_total: number;
  jumlah_sesuai: number;
  persen: number;
  idIndikatorRuangan?: string;
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

function resolveIndicatorId(value: DailyStatsIndicatorLike | DailyStatsRecordLike): string {
  const id =
    (value as DailyStatsIndicatorLike).idIndikatorRuangan ??
    (value as DailyStatsIndicatorLike).id_indikator_ruangan ??
    (value as DailyStatsIndicatorLike).idIndikator ??
    (value as DailyStatsIndicatorLike).id_indikator ??
    (value as DailyStatsRecordLike).idIndikatorRuangan ??
    (value as DailyStatsRecordLike).id_indikator_ruangan ??
    null;

  return id === null || id === undefined ? '' : String(id);
}

function resolveLabel(indicator: DailyStatsIndicatorLike): string {
  const label =
    indicator.variabel ??
    indicator.nama ??
    indicator.indikator ??
    indicator.judul ??
    indicator.label ??
    '';
  const trimmed = String(label).trim();
  return trimmed.length > 0 ? trimmed : '-';
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

function resolveDay(value: string | Date | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = parseDateLike(value);
  if (!date) {
    return null;
  }

  const day = date.getDate();
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return null;
  }

  return String(day);
}

export function calculateDailyStats(
  indicators: DailyStatsIndicatorLike[],
  records: DailyStatsRecordLike[],
): DailyStatsRow[] {
  const groupedRecords = new Map<string, Map<string, DailyStatsCell>>();

  for (const record of records) {
    const indicatorId = resolveIndicatorId(record);
    const day = resolveDay(record.tanggal);

    if (!indicatorId || !day) {
      continue;
    }

    const dayBucket = groupedRecords.get(indicatorId) ?? new Map<string, DailyStatsCell>();
    const existingCell = dayBucket.get(day) ?? { pasien_sesuai: 0, total_pasien: 0 };

    existingCell.pasien_sesuai += toNumber(record.pasienSesuai ?? record.pasien_sesuai);
    existingCell.total_pasien += toNumber(record.totalPasien ?? record.total_pasien);

    dayBucket.set(day, existingCell);
    groupedRecords.set(indicatorId, dayBucket);
  }

  return indicators.map((indicator, index) => {
    const indicatorId = resolveIndicatorId(indicator);
    const dayBucket = indicatorId ? groupedRecords.get(indicatorId) : undefined;
    const byTanggal: Record<string, DailyStatsCell> = {};
    let jumlahSesuai = 0;
    let jumlahTotal = 0;

    if (dayBucket) {
      const sortedDays = Array.from(dayBucket.keys()).sort((a, b) => Number(a) - Number(b));
      for (const day of sortedDays) {
        const cell = dayBucket.get(day);
        if (!cell) {
          continue;
        }

        byTanggal[day] = {
          pasien_sesuai: cell.pasien_sesuai,
          total_pasien: cell.total_pasien,
        };
        jumlahSesuai += cell.pasien_sesuai;
        jumlahTotal += cell.total_pasien;
      }
    }

    const persen = jumlahTotal > 0 ? roundToTwo((jumlahSesuai / jumlahTotal) * 100) : 100;

    return {
      no: typeof indicator.no === 'number' && Number.isFinite(indicator.no) ? indicator.no : index + 1,
      variabel: resolveLabel(indicator),
      byTanggal,
      jumlah_total: jumlahTotal,
      jumlah_sesuai: jumlahSesuai,
      persen,
      ...(indicatorId ? { idIndikatorRuangan: indicatorId } : {}),
    };
  });
}