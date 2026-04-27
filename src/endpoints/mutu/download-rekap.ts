import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { IndikatorRuanganEntity } from "../../entities/indikator-ruangan.entity";
import { MutuRuanganEntity } from "../../entities/mutu-ruangan.entity";
import { JawabanEntity } from "../../entities/jawaban.entity";
import { PilihanJawabanEntity } from "../../entities/pilihan-jawaban.entity";
import { AuthUserContext } from "../../jwt.util";
import { calculateDailyStats } from "../../function/calculate-daily-stats";
import { calculateSkmDailyStats } from "../../function/calculate-skm";
import { buildRekapMutuRuanganWorkbook } from "../../excel-export/rekap-mutu-ruangan";
import { UnauthorizedError } from "../../errors";

type MutuDashboardRow = {
  no: number;
  variabel: string;
  byTanggal: Record<string, { pasien_sesuai: number; total_pasien: number }>;
  jumlah_total: number;
  jumlah_sesuai: number;
  persen: number | null;
};

function parseMonth(input: unknown, fallback: number): number {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value < 1 || value > 12) {
    return fallback;
  }
  return value;
}

function parseYear(input: unknown, fallback: number): number {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value < 1900) {
    return fallback;
  }
  return value;
}

function formatDateYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export async function downloadMutuRekapHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = req.authUser as AuthUserContext | undefined;
    if (!authUser || !authUser.idRuangan) {
      throw new UnauthorizedError("Unauthorized");
    }

    const idRuangan = String(authUser.idRuangan);

    const now = new Date();
    const bulan = parseMonth(req.query.bulan, now.getMonth() + 1);
    const tahun = parseYear(req.query.tahun, now.getFullYear());
    const jumlahHari = new Date(tahun, bulan, 0).getDate();

    const indikatorRuanganRepo = AppDataSource.getRepository(
      IndikatorRuanganEntity,
    );
    const mutuRuanganRepo = AppDataSource.getRepository(MutuRuanganEntity);
    const jawabanRepo = AppDataSource.getRepository(JawabanEntity);
    const pilihanJawabanRepo =
      AppDataSource.getRepository(PilihanJawabanEntity);

    const activeIndicators = await indikatorRuanganRepo
      .createQueryBuilder("ir")
      .innerJoinAndSelect("ir.indikatorMutu", "im")
      .leftJoinAndSelect("im.kategori", "k")
      .where("ir.idRuangan = :idRuangan", { idRuangan })
      .andWhere("ir.active = :active", { active: 1 })
      .orderBy("im.variabel", "ASC")
      .addOrderBy("ir.idIndikatorRuangan", "ASC")
      .getMany();

    const startDate = formatDateYmd(new Date(tahun, bulan - 1, 1));
    const endDate = formatDateYmd(new Date(tahun, bulan - 1, jumlahHari));

    const mutuRecords = await mutuRuanganRepo
      .createQueryBuilder("mr")
      .innerJoinAndSelect("mr.indikatorRuangan", "ir")
      .where("ir.idRuangan = :idRuangan", { idRuangan })
      .andWhere("mr.tanggal BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
      .getMany();

    const indikatorData = calculateDailyStats(
      activeIndicators as any,
      mutuRecords as any,
    ) as MutuDashboardRow[];

    const maxScoreRows = await pilihanJawabanRepo
      .createQueryBuilder("pj")
      .select("pj.idPertanyaan", "idPertanyaan")
      .addSelect("MAX(pj.nilai)", "maxNilai")
      .groupBy("pj.idPertanyaan")
      .getRawMany<{
        idPertanyaan: string | number;
        maxNilai: string | number;
      }>();

    const maxScores: Record<number, number> = {};
    for (const row of maxScoreRows) {
      const idPertanyaan = Number(row.idPertanyaan);
      const maxNilai = Number(row.maxNilai);
      if (Number.isFinite(idPertanyaan)) {
        maxScores[idPertanyaan] = Number.isFinite(maxNilai) ? maxNilai : 0;
      }
    }

    const answerRows = await jawabanRepo
      .createQueryBuilder("j")
      .innerJoin("j.bioPasien", "bp")
      .where("bp.idRuangan = :idRuangan", { idRuangan })
      .andWhere("j.tanggal BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
      .andWhere("j.idPilihan IS NOT NULL")
      .andWhere("j.hasilNilai IS NOT NULL")
      .getMany();

    const skmRow: any = calculateSkmDailyStats(answerRows as any, maxScores, {
      bulan,
      tahun,
      jumlahHari,
    } as any);

    const normalizedSkmRow: MutuDashboardRow = {
      no: indikatorData.length + 1,
      variabel: String(
        (skmRow as any).variabel ?? (skmRow as any).judul ?? "SKM",
      ),
      byTanggal: ((skmRow as any).byTanggal ?? {}) as Record<
        string,
        { pasien_sesuai: number; total_pasien: number }
      >,
      jumlah_total: Number((skmRow as any).jumlah_total ?? 0),
      jumlah_sesuai: Number((skmRow as any).jumlah_sesuai ?? 0),
      persen:
        typeof (skmRow as any).persen === "number"
          ? (skmRow as any).persen
          : null,
    };

    const namaRuangan = String(authUser.namaRuangan ?? idRuangan);

    const workbook = buildRekapMutuRuanganWorkbook({
      ruanganId: idRuangan,
      namaRuangan,
      bulan,
      tahun,
      data: [...indikatorData, normalizedSkmRow],
    });

    const filename = `rekap-mutu-${String(namaRuangan).replace(/\s+/g, "_")}-${tahun}-${String(bulan).padStart(2, "0")}.xlsx`;
    await sendWorkbook(workbook, filename, res);
  } catch (error) {
    next(error);
  }
}
