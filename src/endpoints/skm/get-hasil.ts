import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import * as Errors from '../../errors';
import { BioPasienEntity } from '../../entities/bio-pasien.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';
import { RuanganEntity } from '../../entities/ruangan.entity';

type CountChart = {
  labels: string[];
  data: number[];
};

type RawDistinctRow = {
  idPasien: string | number;
};

type RawBioRow = {
  idPasien: string | number;
  noRm: string | null;
  idRuangan: string | number | null;
  namaRuangan: string | null;
  umur: number | null;
  jenisKelamin: string | null;
  pendidikan: string | null;
  pekerjaan: string | null;
};

type RawSurveyRow = {
  idPertanyaan: string | number;
  pertanyaanText: string;
  idPilihan: string | number;
  pilihan: string;
  total: string | number;
};

type RawKritikRow = {
  idPasien: string | number;
  noRm: string | null;
  namaRuangan: string | null;
  kritikSaran: string | null;
  tanggal: string | Date | null;
};

function createValidationError(message: string): Error {
  const Ctor = (Errors as any).ValidationError ?? (Errors as any).BadRequestError ?? Error;
  return new Ctor(message);
}

function createNotFoundError(message: string): Error {
  const Ctor = (Errors as any).NotFoundError ?? Error;
  return new Ctor(message);
}

function parseRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  const invalidMonth = fieldName === 'bulan' && (parsed < 1 || parsed > 12);
  if (Number.isNaN(parsed) || parsed <= 0 || invalidMonth) {
    throw createValidationError(`${fieldName} wajib diisi dan harus berupa angka yang valid`);
  }
  return parsed;
}

function parseOptionalRoomId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

function buildCountChart(values: Array<string | null | undefined>): CountChart {
  const map = new Map<string, number>();

  for (const value of values) {
    const label = value && String(value).trim() !== '' ? String(value) : 'Tidak diketahui';
    map.set(label, (map.get(label) ?? 0) + 1);
  }

  return {
    labels: Array.from(map.keys()),
    data: Array.from(map.values()),
  };
}

function buildCountChartFromRows(rows: Array<Record<string, any>>, key: string): CountChart {
  return buildCountChart(rows.map((row) => row[key] as string | null | undefined));
}

export async function getSkmHasilHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const bulan = parseRequiredNumber(req.query.bulan, 'bulan');
    const tahun = parseRequiredNumber(req.query.tahun, 'tahun');
    const idRuangan = parseOptionalRoomId(req.query.idRuangan);

    let namaRuangan = 'Semua Ruangan';
    if (idRuangan) {
      const ruangan = await AppDataSource.getRepository(RuanganEntity)
        .createQueryBuilder('r')
        .select('r.id_ruangan', 'idRuangan')
        .addSelect('r.nama_ruangan', 'namaRuangan')
        .where('r.id_ruangan = :idRuangan', { idRuangan })
        .getRawOne();

      if (!ruangan) {
        throw createNotFoundError('Ruangan tidak ditemukan');
      }

      namaRuangan = String(ruangan.namaRuangan ?? 'Semua Ruangan');
    }

    const distinctRespondentRows = (await AppDataSource.getRepository(JawabanEntity)
      .createQueryBuilder('j')
      .innerJoin(BioPasienEntity, 'b', 'b.id_pasien = j.id_pasien')
      .distinct(true)
      .select('j.id_pasien', 'idPasien')
      .where('MONTH(j.tanggal) = :bulan', { bulan })
      .andWhere('YEAR(j.tanggal) = :tahun', { tahun })
      .andWhere(idRuangan ? 'b.id_ruangan = :idRuangan' : '1=1', { idRuangan })
      .getRawMany()) as RawDistinctRow[];

    const respondentIds = distinctRespondentRows.map((row) => String(row.idPasien));
    const totalResponden = respondentIds.length;

    const biodataRows = totalResponden
      ? ((await AppDataSource.getRepository(BioPasienEntity)
          .createQueryBuilder('b')
          .leftJoin(RuanganEntity, 'r', 'r.id_ruangan = b.id_ruangan')
          .select('b.id_pasien', 'idPasien')
          .addSelect('b.no_rm', 'noRm')
          .addSelect('b.id_ruangan', 'idRuangan')
          .addSelect('r.nama_ruangan', 'namaRuangan')
          .addSelect('b.umur', 'umur')
          .addSelect('b.jenis_kelamin', 'jenisKelamin')
          .addSelect('b.pendidikan', 'pendidikan')
          .addSelect('b.pekerjaan', 'pekerjaan')
          .where('b.id_pasien IN (:...ids)', { ids: respondentIds })
          .getRawMany()) as RawBioRow[])
      : [];

    const chartJenisKelamin = buildCountChartFromRows(biodataRows as any[], 'jenisKelamin');
    const chartPendidikan = buildCountChartFromRows(biodataRows as any[], 'pendidikan');
    const chartPekerjaan = buildCountChartFromRows(biodataRows as any[], 'pekerjaan');
    const chartRuangan = buildCountChartFromRows(biodataRows as any[], 'namaRuangan');

    const allQuestionRows = await AppDataSource.getRepository(PertanyaanEntity)
      .createQueryBuilder('p')
      .innerJoin(PilihanJawabanEntity, 'pj', 'pj.id_pertanyaan = p.id_pertanyaan')
      .select('p.id_pertanyaan', 'idPertanyaan')
      .addSelect('p.pertanyaan', 'pertanyaanText')
      .addSelect('p.urutan', 'urutan')
      .addSelect('pj.id_pilihan', 'idPilihan')
      .addSelect('pj.pilihan', 'pilihan')
      .orderBy('p.urutan', 'ASC')
      .addOrderBy('pj.id_pilihan', 'ASC')
      .getRawMany();

    const questionMap = new Map<
      string,
      {
        idPertanyaan: string | number;
        pertanyaanText: string;
        pilihan: Array<{ idPilihan: string | number; pilihan: string }>;
      }
    >();

    for (const row of allQuestionRows as any[]) {
      const key = String(row.idPertanyaan);
      if (!questionMap.has(key)) {
        questionMap.set(key, {
          idPertanyaan: row.idPertanyaan,
          pertanyaanText: row.pertanyaanText,
          pilihan: [],
        });
      }

      questionMap.get(key)!.pilihan.push({
        idPilihan: row.idPilihan,
        pilihan: row.pilihan,
      });
    }

    const surveyRows = (await AppDataSource.getRepository(JawabanEntity)
      .createQueryBuilder('j')
      .innerJoin(BioPasienEntity, 'b', 'b.id_pasien = j.id_pasien')
      .innerJoin(PilihanJawabanEntity, 'pj', 'pj.id_pilihan = j.id_pilihan')
      .innerJoin(PertanyaanEntity, 'p', 'p.id_pertanyaan = j.id_pertanyaan')
      .select('j.id_pertanyaan', 'idPertanyaan')
      .addSelect('p.pertanyaan', 'pertanyaanText')
      .addSelect('pj.id_pilihan', 'idPilihan')
      .addSelect('pj.pilihan', 'pilihan')
      .addSelect('COUNT(*)', 'total')
      .where('MONTH(j.tanggal) = :bulan', { bulan })
      .andWhere('YEAR(j.tanggal) = :tahun', { tahun })
      .andWhere('j.id_pilihan IS NOT NULL')
      .andWhere(idRuangan ? 'b.id_ruangan = :idRuangan' : '1=1', { idRuangan })
      .groupBy('j.id_pertanyaan')
      .addGroupBy('p.pertanyaan')
      .addGroupBy('pj.id_pilihan')
      .addGroupBy('pj.pilihan')
      .orderBy('j.id_pertanyaan', 'ASC')
      .addOrderBy('pj.id_pilihan', 'ASC')
      .getRawMany()) as RawSurveyRow[];

    const surveyCountMap = new Map<
      string,
      {
        labels: string[];
        data: number[];
      }
    >();

    for (const row of allQuestionRows as any[]) {
      const key = String(row.idPertanyaan);
      if (!surveyCountMap.has(key)) {
        surveyCountMap.set(key, {
          labels: [],
          data: [],
        });
      }
    }

    for (const row of surveyRows) {
      const key = String(row.idPertanyaan);
      if (!surveyCountMap.has(key)) {
        surveyCountMap.set(key, {
          labels: [],
          data: [],
        });
      }

      const chart = surveyCountMap.get(key)!;
      const pilihanLabel = String(row.pilihan);
      const index = chart.labels.indexOf(pilihanLabel);

      if (index === -1) {
        chart.labels.push(pilihanLabel);
        chart.data.push(Number(row.total) || 0);
      } else {
        chart.data[index] = Number(row.total) || 0;
      }
    }

    const allSurveyCharts = Array.from(questionMap.values()).map((question) => {
      const chart = surveyCountMap.get(String(question.idPertanyaan)) ?? { labels: [], data: [] };
      const labels = question.pilihan.map((item) => item.pilihan);
      const data = labels.map((label) => {
        const foundIndex = chart.labels.indexOf(label);
        return foundIndex >= 0 ? chart.data[foundIndex] : 0;
      });

      return {
        idPertanyaan: question.idPertanyaan,
        pertanyaanText: question.pertanyaanText,
        chart: {
          labels,
          data,
        },
      };
    });

    const kritikRows = (await AppDataSource.getRepository(JawabanEntity)
      .createQueryBuilder('j')
      .innerJoin(BioPasienEntity, 'b', 'b.id_pasien = j.id_pasien')
      .leftJoin(RuanganEntity, 'r', 'r.id_ruangan = b.id_ruangan')
      .select('j.id_pasien', 'idPasien')
      .addSelect('b.no_rm', 'noRm')
      .addSelect('r.nama_ruangan', 'namaRuangan')
      .addSelect('j.hasil_nilai', 'kritikSaran')
      .addSelect('j.tanggal', 'tanggal')
      .where('MONTH(j.tanggal) = :bulan', { bulan })
      .andWhere('YEAR(j.tanggal) = :tahun', { tahun })
      .andWhere('j.id_pertanyaan = :idPertanyaan', { idPertanyaan: 16 })
      .andWhere('j.id_pilihan IS NULL')
      .andWhere(idRuangan ? 'b.id_ruangan = :idRuangan' : '1=1', { idRuangan })
      .orderBy('j.tanggal', 'DESC')
      .getRawMany()) as RawKritikRow[];

    const listKritikSaran = kritikRows.map((row) => ({
      idPasien: row.idPasien,
      noRm: row.noRm,
      namaRuangan: row.namaRuangan ?? namaRuangan,
      kritikSaran: row.kritikSaran,
      tanggal: row.tanggal,
    }));

    res.status(200).json({
      success: true,
      message: 'Data hasil SKM berhasil diambil',
      data: {
        bulan,
        tahun,
        namaRuangan,
        totalResponden,
        chartJenisKelamin,
        chartPendidikan,
        chartPekerjaan,
        chartRuangan,
        allSurveyCharts,
        listKritikSaran,
      },
    });
  } catch (error) {
    next(error);
  }
}