import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { NotFoundError } from "../../errors";
import { SKM_LABEL } from "../../constant";
import { RuanganEntity } from "../../entities/ruangan.entity";
import { IndikatorRuanganEntity } from "../../entities/indikator-ruangan.entity";
import { MutuRuanganEntity } from "../../entities/mutu-ruangan.entity";
import { JawabanEntity } from "../../entities/jawaban.entity";
import { PilihanJawabanEntity } from "../../entities/pilihan-jawaban.entity";
import { calculateDailyStats } from "../../function/calculate-daily-stats";
import {
  calculateSkmDailyStats,
  calculateSkmYearlyStats,
} from "../../function/calculate-skm";

type RawRoom = {
  idRuangan?: string | number;
  namaRuangan?: string | null;
};

type RawIndicatorRoom = {
  idIndikatorRuangan?: string | number;
  idRuangan?: string | number;
  idIndikator?: string | number;
  idKategori?: string | number | null;
  variabel?: string | null;
  indikator?: string | null;
  kategori?: string | null;
  active?: string | number | boolean;
};

type RawMutuRuangan = {
  idMutu?: string | number;
  idRuangan?: string | number;
  idIndikatorRuangan?: string | number;
  tanggal?: string | Date | null;
  pasienSesuai?: string | number | null;
  totalPasien?: string | number | null;
};

type RawSkmAnswerRow = {
  idPertanyaan?: string | number;
  tanggal?: string | Date | number | null;
  hasilNilai?: string | number | null;
};

type RawSkmMaxScoreRow = {
  idPertanyaan?: string | number;
  maxScore?: string | number;
};

type DailyStatItem = {
  hari: number;
  pasienSesuai: number;
  totalPasien: number;
  persentase: number | null;
};

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMonth(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
    ? parsed
    : fallback;
}

function parseYear(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDateObject(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function calculatePercentage(
  pasienSesuai: number,
  totalPasien: number,
): number | null {
  if (totalPasien <= 0) return null;
  return Number(((pasienSesuai / totalPasien) * 100).toFixed(2));
}

function buildDailyFallback(
  rows: RawMutuRuangan[],
  jumlahHari: number,
): DailyStatItem[] {
  const dailyMap = new Map<
    number,
    { pasienSesuai: number; totalPasien: number }
  >();
  for (let hari = 1; hari <= jumlahHari; hari += 1) {
    dailyMap.set(hari, { pasienSesuai: 0, totalPasien: 0 });
  }
  for (const row of rows) {
    const tanggal = getDateObject(row.tanggal);
    if (!tanggal) continue;
    const hari = tanggal.getDate();
    const current = dailyMap.get(hari) ?? { pasienSesuai: 0, totalPasien: 0 };
    current.pasienSesuai += toNumber(row.pasienSesuai);
    current.totalPasien += toNumber(row.totalPasien);
    dailyMap.set(hari, current);
  }
  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hari, value]) => ({
      hari,
      pasienSesuai: value.pasienSesuai,
      totalPasien: value.totalPasien,
      persentase: calculatePercentage(value.pasienSesuai, value.totalPasien),
    }));
}

function buildMonthlySeries(
  rows: RawMutuRuangan[],
  tahun: number,
): Array<number | null> {
  const monthMap = new Map<
    number,
    { pasienSesuai: number; totalPasien: number }
  >();
  for (let bulan = 1; bulan <= 12; bulan += 1) {
    monthMap.set(bulan, { pasienSesuai: 0, totalPasien: 0 });
  }
  for (const row of rows) {
    const tanggal = getDateObject(row.tanggal);
    if (!tanggal || tanggal.getFullYear() !== tahun) continue;
    const bulan = tanggal.getMonth() + 1;
    const current = monthMap.get(bulan) ?? { pasienSesuai: 0, totalPasien: 0 };
    current.pasienSesuai += toNumber(row.pasienSesuai);
    current.totalPasien += toNumber(row.totalPasien);
    monthMap.set(bulan, current);
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => {
      if (value.totalPasien <= 0) return null;
      return Number(
        ((value.pasienSesuai / value.totalPasien) * 100).toFixed(2),
      );
    });
}

function sortRawIndicatorsByKategori(
  rows: RawIndicatorRoom[],
): RawIndicatorRoom[] {
  const getPriority = (kategori?: string | null): number => {
    const value = normalizeString(kategori).toLowerCase();
    if (value.includes("prioritas unit")) return 0;
    if (value.includes("nasional mutu")) return 1;
    if (value.includes("prioritas rs")) return 2;
    return 3;
  };
  return [...rows].sort((a, b) => {
    const priorityDiff = getPriority(a.kategori) - getPriority(b.kategori);
    if (priorityDiff !== 0) return priorityDiff;
    const variabelA = normalizeString(a.variabel).toLowerCase();
    const variabelB = normalizeString(b.variabel).toLowerCase();
    if (variabelA < variabelB) return -1;
    if (variabelA > variabelB) return 1;
    return normalizeString(a.idIndikatorRuangan).localeCompare(
      normalizeString(b.idIndikatorRuangan),
    );
  });
}

export async function getRuanganDashboardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const idRuangan = normalizeString(req.params.id);
    const currentDate = new Date();
    const bulan = parseMonth(req.query.bulan, currentDate.getMonth() + 1);
    const tahun = parseYear(req.query.tahun, currentDate.getFullYear());
    const jumlahHari = getDaysInMonth(tahun, bulan);

    const ruanganRepo = AppDataSource.getRepository(RuanganEntity);
    const indikatorRuanganRepo = AppDataSource.getRepository(
      IndikatorRuanganEntity,
    );
    const mutuRuanganRepo = AppDataSource.getRepository(MutuRuanganEntity);
    const jawabanRepo = AppDataSource.getRepository(JawabanEntity);
    const pilihanJawabanRepo =
      AppDataSource.getRepository(PilihanJawabanEntity);

    const ruangan = (await ruanganRepo
      .createQueryBuilder("r")
      .select([
        'r.id_ruangan AS "idRuangan"',
        'r.nama_ruangan AS "namaRuangan"',
      ])
      .where("r.id_ruangan = :idRuangan", { idRuangan })
      .getRawOne()) as RawRoom | undefined;

    if (!ruangan) {
      throw new NotFoundError("Ruangan tidak ditemukan");
    }

    const activeIndicatorsRaw = (await indikatorRuanganRepo
      .createQueryBuilder("ir")
      .innerJoin("indikator_mutu", "im", "im.id_indikator = ir.id_indikator")
      .leftJoin("kategori", "k", "k.id_kategori = im.id_kategori")
      .select([
        'ir.id_indikator_ruangan AS "idIndikatorRuangan"',
        'ir.id_ruangan AS "idRuangan"',
        'ir.id_indikator AS "idIndikator"',
        "ir.active AS active",
        'im.id_kategori AS "idKategori"',
        "im.variabel AS variabel",
        "im.variabel AS indikator",
        "k.kategori AS kategori",
      ])
      .where("ir.id_ruangan = :idRuangan", { idRuangan })
      // PostgreSQL smallint flag: use 1 for active rows
      .andWhere("ir.active = 1")
      .getRawMany()) as RawIndicatorRoom[];

    const monthlyRows = (await mutuRuanganRepo
      .createQueryBuilder("mr")
      .innerJoin(
        "indikator_ruangan",
        "ir",
        "ir.id_indikator_ruangan = mr.id_indikator_ruangan",
      )
      .select([
        'mr.id_mutu AS "idMutu"',
        'ir.id_ruangan AS "idRuangan"',
        'mr.id_indikator_ruangan AS "idIndikatorRuangan"',
        "mr.tanggal AS tanggal",
        'mr.pasien_sesuai AS "pasienSesuai"',
        'mr.total_pasien AS "totalPasien"',
      ])
      .where("ir.id_ruangan = :idRuangan", { idRuangan })
      // PostgreSQL: EXTRACT instead of MONTH()/YEAR()
      .andWhere("EXTRACT(MONTH FROM mr.tanggal) = :bulan", { bulan })
      .andWhere("EXTRACT(YEAR FROM mr.tanggal) = :tahun", { tahun })
      .orderBy("mr.tanggal", "ASC")
      .getRawMany()) as RawMutuRuangan[];

    const annualRows = (await mutuRuanganRepo
      .createQueryBuilder("mr")
      .innerJoin(
        "indikator_ruangan",
        "ir",
        "ir.id_indikator_ruangan = mr.id_indikator_ruangan",
      )
      .select([
        'mr.id_mutu AS "idMutu"',
        'ir.id_ruangan AS "idRuangan"',
        'mr.id_indikator_ruangan AS "idIndikatorRuangan"',
        "mr.tanggal AS tanggal",
        'mr.pasien_sesuai AS "pasienSesuai"',
        'mr.total_pasien AS "totalPasien"',
      ])
      .where("ir.id_ruangan = :idRuangan", { idRuangan })
      .andWhere("EXTRACT(YEAR FROM mr.tanggal) = :tahun", { tahun })
      .orderBy("mr.tanggal", "ASC")
      .getRawMany()) as RawMutuRuangan[];

    const sortedActiveIndicators =
      sortRawIndicatorsByKategori(activeIndicatorsRaw);

    const indikatorData = sortedActiveIndicators.map((indikator) => {
      const idIndikatorRuangan = normalizeString(indikator.idIndikatorRuangan);
      const indicatorMonthlyRows = monthlyRows.filter(
        (row) => normalizeString(row.idIndikatorRuangan) === idIndikatorRuangan,
      );
      const indicatorAnnualRows = annualRows.filter(
        (row) => normalizeString(row.idIndikatorRuangan) === idIndikatorRuangan,
      );

      const dailyStats: unknown = buildDailyFallback(
        indicatorMonthlyRows,
        jumlahHari,
      );
      const pasienSesuai = indicatorMonthlyRows.reduce<number>(
        (acc, row) => acc + toNumber(row.pasienSesuai),
        0,
      );
      const totalPasien = indicatorMonthlyRows.reduce<number>(
        (acc, row) => acc + toNumber(row.totalPasien),
        0,
      );
      const persentase = calculatePercentage(
        Number(pasienSesuai),
        Number(totalPasien),
      );

      return {
        idIndikatorRuangan,
        idIndikator: normalizeString(indikator.idIndikator),
        idRuangan: normalizeString(indikator.idRuangan),
        idKategori:
          indikator.idKategori === null || indikator.idKategori === undefined
            ? null
            : normalizeString(indikator.idKategori),
        kategori: normalizeString(indikator.kategori),
        variabel: normalizeString(indikator.variabel),
        indikator: normalizeString(indikator.indikator),
        pasienSesuai,
        totalPasien,
        persentase,
        dailyStats,
        monthlySeries: buildMonthlySeries(indicatorAnnualRows, tahun),
      };
    });

    const skmMonthlyRows = (await jawabanRepo
      .createQueryBuilder("j")
      .innerJoin("bio_pasien", "bp", "bp.id_pasien = j.id_pasien")
      .select([
        'j.id_pertanyaan AS "idPertanyaan"',
        "j.tanggal AS tanggal",
        'j.hasil_nilai AS "hasilNilai"',
      ])
      .where("bp.id_ruangan = :idRuangan", { idRuangan })
      // PostgreSQL: EXTRACT instead of MONTH()/YEAR()
      .andWhere("EXTRACT(MONTH FROM j.tanggal) = :bulan", { bulan })
      .andWhere("EXTRACT(YEAR FROM j.tanggal) = :tahun", { tahun })
      .andWhere("j.id_pilihan IS NOT NULL")
      .orderBy("j.tanggal", "ASC")
      .getRawMany()) as RawSkmAnswerRow[];

    const skmAnnualRows = (await jawabanRepo
      .createQueryBuilder("j")
      .innerJoin("bio_pasien", "bp", "bp.id_pasien = j.id_pasien")
      .select([
        'j.id_pertanyaan AS "idPertanyaan"',
        "j.tanggal AS tanggal",
        'j.hasil_nilai AS "hasilNilai"',
      ])
      .where("bp.id_ruangan = :idRuangan", { idRuangan })
      .andWhere("EXTRACT(YEAR FROM j.tanggal) = :tahun", { tahun })
      .andWhere("j.id_pilihan IS NOT NULL")
      .orderBy("j.tanggal", "ASC")
      .getRawMany()) as RawSkmAnswerRow[];

    const maxScoreRows = (await pilihanJawabanRepo
      .createQueryBuilder("pj")
      .select([
        'pj.id_pertanyaan AS "idPertanyaan"',
        'MAX(pj.nilai) AS "maxScore"',
      ])
      .groupBy("pj.id_pertanyaan")
      .getRawMany()) as RawSkmMaxScoreRow[];

    const maxScores: Record<number, number> = {};
    for (const row of maxScoreRows) {
      const idPertanyaan = Number(row.idPertanyaan);
      const maxScore = Number(row.maxScore);
      if (Number.isFinite(idPertanyaan)) {
        maxScores[idPertanyaan] = Number.isFinite(maxScore) ? maxScore : 0;
      }
    }

    const skmDailyStats = calculateSkmDailyStats(skmMonthlyRows, maxScores, {
      no: sortedActiveIndicators.length + 1,
      label: SKM_LABEL,
    });

    const skmYearlyStats = calculateSkmYearlyStats(skmAnnualRows, maxScores, {
      label: SKM_LABEL,
    });

    const skmRow = {
      no: skmDailyStats.no,
      variabel: SKM_LABEL,
      idIndikatorRuangan: "SKM",
      idIndikator: "SKM",
      idRuangan: normalizeString(ruangan.idRuangan),
      idKategori: null,
      kategori: SKM_LABEL,
      indikator: SKM_LABEL,
      pasienSesuai: skmDailyStats.jumlah_sesuai,
      totalPasien: skmDailyStats.jumlah_total,
      persentase: skmDailyStats.persen,
      dailyStats: skmDailyStats,
      monthlySeries: skmYearlyStats.data_bulan,
      quarterlySeries: skmYearlyStats.data_tw,
    };

    const indikatorDataWithSkm = [...indikatorData, skmRow];

    const chartSeries = indikatorDataWithSkm.map((item) => ({
      idIndikatorRuangan: normalizeString(item.idIndikatorRuangan),
      idIndikator: normalizeString(item.idIndikator),
      label: normalizeString(
        item.variabel ||
          item.indikator ||
          item.kategori ||
          item.idIndikatorRuangan,
      ),
      name: normalizeString(
        item.variabel ||
          item.indikator ||
          item.kategori ||
          item.idIndikatorRuangan,
      ),
      data: Array.isArray(item.monthlySeries) ? item.monthlySeries : [],
    }));

    res.json({
      success: true,
      message: "Data dashboard ruangan berhasil diambil",
      data: {
        ruangan: {
          idRuangan: normalizeString(ruangan.idRuangan),
          namaRuangan: normalizeString(ruangan.namaRuangan),
        },
        bulan,
        tahun,
        jumlahHari,
        indikatorData: indikatorDataWithSkm,
        chartSeries,
      },
    });
  } catch (error) {
    next(error);
  }
}
