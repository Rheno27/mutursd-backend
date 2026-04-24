import { Request, Response, NextFunction } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { KategoriEntity } from '../../entities/kategori.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';
import { calculateMonthlyStats } from '../../function/calculate-monthly-stats';
import { calculateTriwulanStats } from '../../function/calculate-triwulan';
import { calculateSkmYearlyStats } from '../../function/calculate-skm';

const CATEGORY_PRIORITY: Record<string, number> = {
  'Indikator Mutu Prioritas Unit': 1,
  'Indikator Nasional Mutu': 2,
  'Indikator Prioritas RS': 3
};

function getCategoryPriority(categoryName?: string | null): number {
  if (!categoryName) {
    return 99;
  }
  return CATEGORY_PRIORITY[categoryName] || 99;
}

function pickNumber(...values: Array<unknown>): number {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function getMonthNumber(value: unknown): number {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) {
    return 1;
  }
  return date.getMonth() + 1;
}

function startOfYear(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

function endOfYear(year: number): Date {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function buildMonthlyGroups(records: any[]): Record<number, any[] | undefined> {
  const grouped: Record<number, any[]> = {};
  records.forEach((record) => {
    const month = getMonthNumber(record.tanggal);
    if (!grouped[month]) {
      grouped[month] = [];
    }
    grouped[month].push({
      bulan: month,
      pasienSesuai: Number(record.pasienSesuai ?? record.pasien_sesuai ?? 0),
      totalPasien: Number(record.totalPasien ?? record.total_pasien ?? 0),
      pasien_sesuai: Number(record.pasienSesuai ?? record.pasien_sesuai ?? 0),
      total_pasien: Number(record.totalPasien ?? record.total_pasien ?? 0),
      jumlah_sesuai: Number(record.pasienSesuai ?? record.pasien_sesuai ?? 0),
      jumlah_total: Number(record.totalPasien ?? record.total_pasien ?? 0)
    });
  });
  return grouped;
}

function buildTriwulanGroups(records: any[]): Record<number, any[] | undefined> {
  return buildMonthlyGroups(records);
}

function sortIndicators(a: any, b: any): number {
  const priorityA = getCategoryPriority(a?.indikatorMutu?.kategori?.kategori);
  const priorityB = getCategoryPriority(b?.indikatorMutu?.kategori?.kategori);
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }
  return String(a?.indikatorMutu?.variabel || '').localeCompare(String(b?.indikatorMutu?.variabel || ''));
}

function serializeIndicatorRow(indicator: any, monthly: Array<number | null>, triwulan: Array<number | null>) {
  return {
    idIndikatorRuangan: indicator.idIndikatorRuangan,
    idRuangan: indicator.idRuangan,
    idIndikator: indicator.idIndikator,
    label: indicator.indikatorMutu?.variabel || '',
    name: indicator.indikatorMutu?.variabel || '',
    judul: indicator.indikatorMutu?.variabel || '',
    standar: indicator.indikatorMutu?.standar || '',
    kategori: indicator.indikatorMutu?.kategori?.kategori || '',
    data_bulan: monthly,
    data_tw: triwulan
  };
}

async function loadMonthlyDataForAssignment(idIndikatorRuangan: string, year: number): Promise<any[]> {
  const repo = AppDataSource.getRepository(MutuRuanganEntity);
  return repo.find({
    where: {
      idIndikatorRuangan,
      tanggal: Between(startOfYear(year), endOfYear(year))
    } as any,
    order: {
      tanggal: 'ASC'
    } as any
  });
}

async function buildSkmYearlyRow(year: number, idRuangan?: string): Promise<{ data_bulan: Array<number | null>; data_tw: Array<number | null> }> {
  const questionRepo = AppDataSource.getRepository(PertanyaanEntity);
  const answerRepo = AppDataSource.getRepository(JawabanEntity);

  const questions = await questionRepo.find({
    relations: {
      pilihanJawaban: true
    } as any
  });

  const answers = await answerRepo.find({
    where: {
      tanggal: Between(startOfYear(year), endOfYear(year))
    } as any,
    relations: {
      bioPasien: {
        ruangan: true
      },
      pertanyaan: true,
      pilihanJawaban: true
    } as any
  });

  const filteredAnswers = idRuangan
    ? answers.filter((answer: any) => String(answer?.bioPasien?.idRuangan || '') === idRuangan)
    : answers;

  const maxScores: Record<number, number> = {};
  questions.forEach((question: any) => {
    const maxScore = Array.isArray(question.pilihanJawaban) && question.pilihanJawaban.length > 0
      ? Math.max(...question.pilihanJawaban.map((choice: any) => Number(choice.nilai) || 0))
      : 0;
    maxScores[Number(question.idPertanyaan)] = maxScore;
  });

  const yearly = calculateSkmYearlyStats(filteredAnswers as any, maxScores, {
    year
  } as any);

  const yearlyResult = yearly as any;
  return {
    data_bulan: yearlyResult?.data_bulan ?? yearlyResult?.dataBulan ?? Array(12).fill(null),
    data_tw: yearlyResult?.data_tw ?? yearlyResult?.dataTw ?? Array(4).fill(null)
  };
}

export async function getDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tahun = pickNumber(req.query?.tahun, new Date().getFullYear()) || new Date().getFullYear();
    const kategoriName = String(req.query?.kategori || 'Indikator Nasional Mutu').trim() || 'Indikator Nasional Mutu';

    const kategoriRepo = AppDataSource.getRepository(KategoriEntity);
    const indikatorRuanganRepo = AppDataSource.getRepository(IndikatorRuanganEntity);

    const kategori = await kategoriRepo.findOne({
      where: { kategori: kategoriName } as any
    });

    const activeAssignments = await indikatorRuanganRepo.find({
      where: { active: true } as any,
      relations: {
        ruangan: true,
        indikatorMutu: {
          kategori: true
        }
      } as any
    });

    const filteredAssignments = activeAssignments.filter((assignment: any) => {
      const assignmentCategory = String(assignment?.indikatorMutu?.kategori?.kategori || '');
      return assignmentCategory === kategoriName;
    });

    if (kategoriName === 'Indikator Mutu Prioritas Unit') {
      const roomMap = new Map<string, { ruangan: any; indikator: any[]; indikatorData: any[] }>();

      for (const assignment of filteredAssignments.sort(sortIndicators)) {
        const roomId = String(assignment.idRuangan || assignment?.ruangan?.idRuangan || '');
        if (!roomMap.has(roomId)) {
          roomMap.set(roomId, {
            ruangan: assignment.ruangan || null,
            indikator: [],
            indikatorData: []
          });
        }

        const records = await loadMonthlyDataForAssignment(String(assignment.idIndikatorRuangan), tahun);
        const monthlyGroups = buildMonthlyGroups(records);
        const trwGroups = buildTriwulanGroups(records);
        const monthly = calculateMonthlyStats(monthlyGroups as any);
        const triwulan = calculateTriwulanStats(trwGroups as any);

        const roomEntry = roomMap.get(roomId);
        if (roomEntry) {
          const indicatorRow = serializeIndicatorRow(assignment, monthly, triwulan);
          roomEntry.indikator.push(indicatorRow);
          roomEntry.indikatorData.push(indicatorRow);
        }
      }

      res.json({
        success: true,
        message: 'Data dashboard berhasil diambil',
        data: {
          tahun,
          kategori: kategori?.kategori || kategoriName,
          data: Array.from(roomMap.values())
        }
      });
      return;
    }

    const indicatorRows: any[] = [];
    for (const assignment of filteredAssignments.sort(sortIndicators)) {
      const records = await loadMonthlyDataForAssignment(String(assignment.idIndikatorRuangan), tahun);
      const monthlyGroups = buildMonthlyGroups(records);
      const trwGroups = buildTriwulanGroups(records);
      const monthly = calculateMonthlyStats(monthlyGroups as any);
      const triwulan = calculateTriwulanStats(trwGroups as any);

      indicatorRows.push(serializeIndicatorRow(assignment, monthly, triwulan));
    }

    if (kategoriName === 'Indikator Nasional Mutu') {
      const yearlySkm = await buildSkmYearlyRow(tahun);
      indicatorRows.push({
        label: 'SKM',
        judul: 'SKM',
        standar: '-',
        kategori: 'SKM',
        data_bulan: yearlySkm.data_bulan,
        data_tw: yearlySkm.data_tw
      });
    }

    res.json({
      success: true,
      message: 'Data dashboard berhasil diambil',
      data: {
        tahun,
        kategori: kategori?.kategori || kategoriName,
        data: indicatorRows
      }
    });
  } catch (error) {
    next(error);
  }
}
