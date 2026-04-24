import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { UnauthorizedError } from '../../errors';
import { calculateDailyStats } from '../../function/calculate-daily-stats';
import { calculateSkmDailyStats } from '../../function/calculate-skm';
import { SKM_LABEL } from '../../constant';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';

type RawIndicatorRoomRow = {
  idIndikatorRuangan?: string | number | null;
  idRuangan?: string | number | null;
  idIndikator?: string | number | null;
  variabel?: string | null;
  standar?: string | null;
};

type RawMutuRoomRow = {
  idIndikatorRuangan?: string | number | null;
  tanggal?: string | Date | number | null;
  pasienSesuai?: string | number | null;
  totalPasien?: string | number | null;
};

type RawSkmAnswerRow = {
  idPertanyaan?: string | number | null;
  tanggal?: string | Date | number | null;
  hasilNilai?: string | number | null;
};

type RawSkmMaxScoreRow = {
  idPertanyaan?: string | number | null;
  maxScore?: string | number | null;
};

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveMonth(queryValue: unknown, fallback: number): number {
  const raw = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : fallback;
}

function resolveYear(queryValue: unknown, fallback: number): number {
  const raw = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function getMutuDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new UnauthorizedError('Authentication is required');
    }

    const now = new Date();
    const bulan = resolveMonth(req.query.bulan, now.getMonth() + 1);
    const tahun = resolveYear(req.query.tahun, now.getFullYear());
    const jumlahHari = getDaysInMonth(tahun, bulan);
    const idRuangan = toStringValue(authUser.idRuangan);

    const indikatorRuanganRepository = AppDataSource.getRepository(IndikatorRuanganEntity);
    const mutuRuanganRepository = AppDataSource.getRepository(MutuRuanganEntity);
    const jawabanRepository = AppDataSource.getRepository(JawabanEntity);
    const pilihanJawabanRepository = AppDataSource.getRepository(PilihanJawabanEntity);

    const indikatorRows = (await indikatorRuanganRepository
      .createQueryBuilder('ir')
      .innerJoin('indikator_mutu', 'im', 'im.id_indikator = ir.id_indikator')
      .select([
        'ir.id_indikator_ruangan AS idIndikatorRuangan',
        'ir.id_ruangan AS idRuangan',
        'ir.id_indikator AS idIndikator',
        'im.variabel AS variabel',
        'im.standar AS standar',
      ])
      .where('ir.id_ruangan = :idRuangan', { idRuangan })
      .andWhere('ir.active = 1')
      .orderBy('im.id_kategori', 'ASC')
      .addOrderBy('im.variabel', 'ASC')
      .getRawMany()) as RawIndicatorRoomRow[];

    const indicatorRoomIds = indikatorRows
      .map((row) => toStringValue(row.idIndikatorRuangan))
      .filter((value) => value.length > 0);

    const mutuRows = indicatorRoomIds.length === 0
      ? []
      : ((await mutuRuanganRepository
          .createQueryBuilder('mr')
          .select([
            'mr.id_indikator_ruangan AS idIndikatorRuangan',
            'mr.tanggal AS tanggal',
            'mr.pasien_sesuai AS pasienSesuai',
            'mr.total_pasien AS totalPasien',
          ])
          .where('mr.id_indikator_ruangan IN (:...indicatorRoomIds)', { indicatorRoomIds })
          .andWhere('MONTH(mr.tanggal) = :bulan', { bulan })
          .andWhere('YEAR(mr.tanggal) = :tahun', { tahun })
          .orderBy('mr.tanggal', 'ASC')
          .addOrderBy('mr.id_indikator_ruangan', 'ASC')
          .getRawMany()) as RawMutuRoomRow[]);

    const indikatorData = calculateDailyStats(
      indikatorRows as unknown as Parameters<typeof calculateDailyStats>[0],
      mutuRows as unknown as Parameters<typeof calculateDailyStats>[1],
    );

    const jawabanRows = ((await jawabanRepository
      .createQueryBuilder('j')
      .innerJoin('bio_pasien', 'bp', 'bp.id_pasien = j.id_pasien')
      .select([
        'j.id_pertanyaan AS idPertanyaan',
        'j.tanggal AS tanggal',
        'j.hasil_nilai AS hasilNilai',
      ])
      .where('bp.id_ruangan = :idRuangan', { idRuangan })
      .andWhere('MONTH(j.tanggal) = :bulan', { bulan })
      .andWhere('YEAR(j.tanggal) = :tahun', { tahun })
      .andWhere('j.id_pilihan IS NOT NULL')
      .orderBy('j.tanggal', 'ASC')
      .getRawMany()) as RawSkmAnswerRow[]);

    const maxScoreRows = ((await pilihanJawabanRepository
      .createQueryBuilder('pj')
      .select([
        'pj.id_pertanyaan AS idPertanyaan',
        'MAX(pj.nilai) AS maxScore',
      ])
      .groupBy('pj.id_pertanyaan')
      .getRawMany()) as RawSkmMaxScoreRow[]);

    const maxScores: Record<number, number> = {};
    for (const row of maxScoreRows) {
      const idPertanyaan = toNumber(row.idPertanyaan, NaN);
      if (!Number.isFinite(idPertanyaan)) {
        continue;
      }

      maxScores[idPertanyaan] = toNumber(row.maxScore, 0);
    }

    const skmRow = calculateSkmDailyStats(
      jawabanRows as unknown as Parameters<typeof calculateSkmDailyStats>[0],
      maxScores,
      {
        no: indikatorData.length + 1,
        label: SKM_LABEL,
      },
    );

    const indikatorDataWithSkm = [...indikatorData, skmRow];

    res.status(200).json({
      success: true,
      message: 'Data dashboard berhasil diambil',
      data: {
        user: {
          idUser: authUser.idUser,
          username: authUser.username,
          idRuangan: authUser.idRuangan,
          namaRuangan: authUser.namaRuangan,
          role: authUser.role,
        },
        bulan,
        tahun,
        jumlahHari,
        indikatorData: indikatorDataWithSkm,
      },
    });
    return;
  } catch (error) {
    return next(error);
  }
}
