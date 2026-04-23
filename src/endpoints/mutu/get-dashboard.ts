import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import { AppDataSource } from '../../data-source';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';
import { AuthUserContext } from '../../jwt.util';
import { calculateDailyStats } from '../../function/calculate-daily-stats';
import { calculateSkmDailyStats } from '../../function/calculate-skm';
import { UnauthorizedError } from '../../errors';

type MutuDashboardRow = {
  no: number;
  variabel: string;
  byTanggal: Record<string, { pasien_sesuai: number; total_pasien: number }>;
  jumlah_total: number;
  jumlah_sesuai: number;
  persen: number | null;
};

function parseMonth(input: unknown, fallback: number): number {
  const value = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(value) || value < 1 || value > 12) {
    return fallback;
  }
  return value;
}

function parseYear(input: unknown, fallback: number): number {
  const value = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(value) || value < 1900) {
    return fallback;
  }
  return value;
}

function toDailyRowArray(rows: MutuDashboardRow[]): MutuDashboardRow[] {
  return rows.map((row, index) => ({
    ...row,
    no: index + 1,
  }));
}

export async function getMutuDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.authUser as AuthUserContext | undefined;
    if (!authUser?.idRuangan) {
      throw new UnauthorizedError('Unauthorized');
    }

    const now = moment();
    const bulan = parseMonth(req.query.bulan, now.month() + 1);
    const tahun = parseYear(req.query.tahun, now.year());
    const jumlahHari = moment({ year: tahun, month: bulan - 1, day: 1 }).daysInMonth();

    const indikatorRuanganRepo = AppDataSource.getRepository(IndikatorRuanganEntity);
    const mutuRuanganRepo = AppDataSource.getRepository(MutuRuanganEntity);
    const jawabanRepo = AppDataSource.getRepository(JawabanEntity);
    const pilihanJawabanRepo = AppDataSource.getRepository(PilihanJawabanEntity);

    const activeIndicators = await indikatorRuanganRepo
      .createQueryBuilder('ir')
      .innerJoinAndSelect('ir.indikatorMutu', 'im')
      .leftJoinAndSelect('im.kategori', 'k')
      .where('ir.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('ir.active = :active', { active: true })
      .orderBy('im.variabel', 'ASC')
      .addOrderBy('ir.idIndikatorRuangan', 'ASC')
      .getMany();

    const startDate = moment({ year: tahun, month: bulan - 1, day: 1 }).format('YYYY-MM-DD');
    const endDate = moment({ year: tahun, month: bulan - 1, day: jumlahHari }).format('YYYY-MM-DD');

    const mutuRecords = await mutuRuanganRepo
      .createQueryBuilder('mr')
      .innerJoinAndSelect('mr.indikatorRuangan', 'ir')
      .where('ir.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('mr.tanggal BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const indikatorData = toDailyRowArray(calculateDailyStats(activeIndicators as any, mutuRecords as any) as MutuDashboardRow[]);

    const maxScoreRows = await pilihanJawabanRepo
      .createQueryBuilder('pj')
      .select('pj.idPertanyaan', 'idPertanyaan')
      .addSelect('MAX(pj.nilai)', 'maxNilai')
      .groupBy('pj.idPertanyaan')
      .getRawMany<{ idPertanyaan: string | number; maxNilai: string | number }>();

    const maxScores: Record<number, number> = {};
    for (const row of maxScoreRows) {
      const idPertanyaan = Number(row.idPertanyaan);
      const maxNilai = Number(row.maxNilai);
      if (Number.isFinite(idPertanyaan)) {
        maxScores[idPertanyaan] = Number.isFinite(maxNilai) ? maxNilai : 0;
      }
    }

    const answerRows = await jawabanRepo
      .createQueryBuilder('j')
      .innerJoin('j.bioPasien', 'bp')
      .where('bp.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('j.tanggal BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('j.idPilihan IS NOT NULL')
      .andWhere('j.hasilNilai IS NOT NULL')
      .getMany();

    const skmRow = calculateSkmDailyStats(answerRows as any, maxScores, {
      bulan,
      tahun,
      jumlahHari,
    } as any) as Partial<MutuDashboardRow> & Record<string, unknown>;

    const normalizedSkmRow: MutuDashboardRow = {
      no: indikatorData.length + 1,
      variabel: String((skmRow as any).variabel ?? (skmRow as any).judul ?? 'SKM'),
      byTanggal: ((skmRow as any).byTanggal ?? {}) as Record<string, { pasien_sesuai: number; total_pasien: number }>,
      jumlah_total: Number((skmRow as any).jumlah_total ?? 0),
      jumlah_sesuai: Number((skmRow as any).jumlah_sesuai ?? 0),
      persen: typeof (skmRow as any).persen === 'number' ? (skmRow as any).persen : null,
    };

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil data dashboard mutu.',
      data: {
        bulan,
        tahun,
        jumlahHari,
        indikatorData: [...indikatorData, normalizedSkmRow],
      },
    });
  } catch (error) {
    next(error);
  }
}