import { NextFunction, Request, Response } from "express";
import { Between } from "typeorm";
import { AppDataSource } from "../../data-source";
import { IndikatorRuanganEntity } from "../../entities/indikator-ruangan.entity";
import { MutuRuanganEntity } from "../../entities/mutu-ruangan.entity";
import { JawabanEntity } from "../../entities/jawaban.entity";
import { PertanyaanEntity } from "../../entities/pertanyaan.entity";
import { calculateMonthlyStats } from "../../function/calculate-monthly-stats";
import { calculateTriwulanStats } from "../../function/calculate-triwulan";
import { calculateSkmYearlyStats } from "../../function/calculate-skm";
import { buildRekapPerIndikatorWorkbook } from "../../excel-export/rekap-per-indikator";

type RekapPerIndikatorRow = {
  judul: string;
  standar: string;
  data_bulan: Array<number | null>;
  data_tw: Array<number | null>;
};

function parseYear(input: unknown, fallback: number): number {
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfYear(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

function endOfYear(year: number): Date {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function monthNumber(value: unknown): number {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return 1;
  }
  return date.getMonth() + 1;
}

function buildMonthlyGroups(records: any[]): Record<number, any[] | undefined> {
  const grouped: Record<number, any[]> = {};
  for (const record of records) {
    const month = monthNumber(record.tanggal);
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
      jumlah_total: Number(record.totalPasien ?? record.total_pasien ?? 0),
    });
  }
  return grouped;
}

function sortIndicators(a: any, b: any): number {
  const kategoriA = String(a?.indikatorMutu?.kategori?.kategori || "");
  const kategoriB = String(b?.indikatorMutu?.kategori?.kategori || "");

  const priorityMap: Record<string, number> = {
    "Indikator Mutu Prioritas Unit": 1,
    "Indikator Nasional Mutu": 2,
    "Indikator Prioritas RS": 3,
  };

  const priorityA = priorityMap[kategoriA] ?? 99;
  const priorityB = priorityMap[kategoriB] ?? 99;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return String(a?.indikatorMutu?.variabel || "").localeCompare(
    String(b?.indikatorMutu?.variabel || ""),
  );
}

async function loadMonthlyDataForAssignment(
  idIndikatorRuangan: string,
  year: number,
): Promise<any[]> {
  const repo = AppDataSource.getRepository(MutuRuanganEntity);
  return repo.find({
    where: {
      idIndikatorRuangan,
      tanggal: Between(startOfYear(year), endOfYear(year)),
    } as any,
    order: {
      tanggal: "ASC",
    } as any,
  });
}

async function buildSkmYearlyRow(year: number): Promise<RekapPerIndikatorRow> {
  const questionRepo = AppDataSource.getRepository(PertanyaanEntity);
  const answerRepo = AppDataSource.getRepository(JawabanEntity);

  const questions = await questionRepo.find({
    relations: {
      pilihanJawaban: true,
    } as any,
  });

  const answers = await answerRepo.find({
    where: {
      tanggal: Between(startOfYear(year), endOfYear(year)),
    } as any,
    relations: {
      bioPasien: {
        ruangan: true,
      },
      pertanyaan: true,
      pilihanJawaban: true,
    } as any,
  });

  const maxScores: Record<number, number> = {};
  questions.forEach((question: any) => {
    const maxScore =
      Array.isArray(question.pilihanJawaban) &&
      question.pilihanJawaban.length > 0
        ? Math.max(
            ...question.pilihanJawaban.map(
              (choice: any) => Number(choice.nilai) || 0,
            ),
          )
        : 0;
    maxScores[Number(question.idPertanyaan)] = maxScore;
  });

  const yearly = calculateSkmYearlyStats(answers as any, maxScores, {
    year,
  } as any) as any;

  return {
    judul: "SKM",
    standar: "-",
    data_bulan: yearly?.data_bulan ?? yearly?.dataBulan ?? Array(12).fill(null),
    data_tw: yearly?.data_tw ?? yearly?.dataTw ?? Array(4).fill(null),
  };
}

async function sendWorkbook(
  workbook: unknown,
  filename: string,
  res: Response,
): Promise<void> {
  const anyWorkbook = workbook as any;
  const contentType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (typeof anyWorkbook?.writeToBuffer === "function") {
    const buffer = await anyWorkbook.writeToBuffer();
    res.send(buffer);
    return;
  }

  if (typeof anyWorkbook?.write === "function") {
    await anyWorkbook.write(filename, res);
    return;
  }

  throw new Error("Workbook output method is not available.");
}

export async function downloadRekapIndikatorHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tahun = parseYear(req.query.tahun, new Date().getFullYear());
    const kategoriName =
      String(req.query.kategori || "Indikator Nasional Mutu").trim() ||
      "Indikator Nasional Mutu";

    const indikatorRuanganRepo = AppDataSource.getRepository(
      IndikatorRuanganEntity,
    );

    const activeAssignments = await indikatorRuanganRepo.find({
      where: { active: true } as any,
      relations: {
        ruangan: true,
        indikatorMutu: {
          kategori: true,
        },
      } as any,
    });

    const filteredAssignments = activeAssignments.filter((assignment: any) => {
      const assignmentCategory = String(
        assignment?.indikatorMutu?.kategori?.kategori || "",
      );
      return assignmentCategory === kategoriName;
    });

    const data: RekapPerIndikatorRow[] = [];

    for (const assignment of filteredAssignments.sort(sortIndicators)) {
      const records = await loadMonthlyDataForAssignment(
        String(assignment.idIndikatorRuangan),
        tahun,
      );
      const monthlyGroups = buildMonthlyGroups(records);
      const monthly = calculateMonthlyStats(monthlyGroups as any);
      const triwulan = calculateTriwulanStats(monthlyGroups as any);

      data.push({
        judul: String(assignment?.indikatorMutu?.variabel || ""),
        standar: String(assignment?.indikatorMutu?.standar || ""),
        data_bulan: monthly,
        data_tw: triwulan,
      });
    }

    if (kategoriName === "Indikator Nasional Mutu") {
      data.push(await buildSkmYearlyRow(tahun));
    }

    const workbook = buildRekapPerIndikatorWorkbook({
      kategori: kategoriName,
      tahun,
      data,
    });

    const filename = `Rekap_${kategoriName.replace(/\s+/g, "_")}_${tahun}.xlsx`;
    await sendWorkbook(workbook, filename, res);
  } catch (error) {
    next(error);
  }
}
