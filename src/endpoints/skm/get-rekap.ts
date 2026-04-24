import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import * as Errors from "../../errors";
import { BioPasienEntity } from "../../entities/bio-pasien.entity";
import { JawabanEntity } from "../../entities/jawaban.entity";
import { PilihanJawabanEntity } from "../../entities/pilihan-jawaban.entity";
import { PertanyaanEntity } from "../../entities/pertanyaan.entity";
import { RuanganEntity } from "../../entities/ruangan.entity";

type RawRekapRow = {
  idPasien: string | number;
  noRm: string | null;
  idRuangan: string | number | null;
  namaRuangan: string | null;
  umur: number | null;
  jenisKelamin: string | null;
  pendidikan: string | null;
  pekerjaan: string | null;
  idPertanyaan: string | number;
  hasilNilai: string | number | null;
};

function createValidationError(message: string): Error {
  const Ctor =
    (Errors as any).ValidationError ?? (Errors as any).BadRequestError ?? Error;
  return new Ctor(message);
}
function createNotFoundError(message: string): Error {
  const Ctor = (Errors as any).NotFoundError ?? Error;
  return new Ctor(message);
}
function parseRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  const invalidMonth = fieldName === "bulan" && (parsed < 1 || parsed > 12);
  if (Number.isNaN(parsed) || parsed <= 0 || invalidMonth) {
    throw createValidationError(
      `${fieldName} wajib diisi dan harus berupa angka yang valid`,
    );
  }
  return parsed;
}
function parseOptionalRoomId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function getSkmRekapHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bulan = parseRequiredNumber(req.query.bulan, "bulan");
    const tahun = parseRequiredNumber(req.query.tahun, "tahun");
    const idRuangan = parseOptionalRoomId(req.query.idRuangan);

    let namaRuangan = "Semua Ruangan";
    if (idRuangan) {
      const ruangan = await AppDataSource.getRepository(RuanganEntity)
        .createQueryBuilder("r")
        .select("r.id_ruangan", "idRuangan")
        .addSelect("r.nama_ruangan", "namaRuangan")
        .where("r.id_ruangan = :idRuangan", { idRuangan })
        .getRawOne();
      if (!ruangan) throw createNotFoundError("Ruangan tidak ditemukan");
      namaRuangan = String(ruangan.namaRuangan ?? "Semua Ruangan");
    }

    const pertanyaanRows = await AppDataSource.getRepository(PertanyaanEntity)
      .createQueryBuilder("p")
      .innerJoin(
        PilihanJawabanEntity,
        "pj",
        "pj.id_pertanyaan = p.id_pertanyaan",
      )
      .select("p.id_pertanyaan", "idPertanyaan")
      .addSelect("p.pertanyaan", "pertanyaan")
      .addSelect("p.urutan", "urutan")
      .distinct(true)
      .orderBy("p.urutan", "ASC")
      .addOrderBy("p.id_pertanyaan", "ASC")
      .getRawMany();

    const listPertanyaan = pertanyaanRows.map((row: any) => ({
      idPertanyaan: row.idPertanyaan ?? row.id_pertanyaan,
      pertanyaan: row.pertanyaan,
      urutan: row.urutan,
    }));

    const jawabanQuery = AppDataSource.getRepository(JawabanEntity)
      .createQueryBuilder("j")
      .innerJoin(BioPasienEntity, "b", "b.id_pasien = j.id_pasien")
      .innerJoin(PilihanJawabanEntity, "pj", "pj.id_pilihan = j.id_pilihan")
      .leftJoin(RuanganEntity, "r", "r.id_ruangan = b.id_ruangan")
      .select("j.id_pasien", "idPasien")
      .addSelect("b.no_rm", "noRm")
      .addSelect("b.id_ruangan", "idRuangan")
      .addSelect("r.nama_ruangan", "namaRuangan")
      .addSelect("b.umur", "umur")
      .addSelect("b.jenis_kelamin", "jenisKelamin")
      .addSelect("b.pendidikan", "pendidikan")
      .addSelect("b.pekerjaan", "pekerjaan")
      .addSelect("j.id_pertanyaan", "idPertanyaan")
      // PostgreSQL: COALESCE still valid, but use EXTRACT for date
      .addSelect("COALESCE(j.hasil_nilai, pj.nilai::text)", "hasilNilai")
      // PostgreSQL: EXTRACT instead of MONTH()/YEAR()
      .where("EXTRACT(MONTH FROM j.tanggal) = :bulan", { bulan })
      .andWhere("EXTRACT(YEAR FROM j.tanggal) = :tahun", { tahun })
      .andWhere("j.id_pilihan IS NOT NULL");

    if (idRuangan) {
      jawabanQuery.andWhere("b.id_ruangan = :idRuangan", { idRuangan });
    }

    const rows = (await jawabanQuery.getRawMany()) as RawRekapRow[];

    const grouped = new Map<string, any>();
    for (const row of rows) {
      const idPasien = String(row.idPasien);
      const idPertanyaan = String(row.idPertanyaan);
      const nilai = toNumberOrNull(row.hasilNilai) ?? 0;

      if (!grouped.has(idPasien)) {
        grouped.set(idPasien, {
          idPasien,
          noRm: row.noRm,
          idRuangan:
            row.idRuangan !== null && row.idRuangan !== undefined
              ? String(row.idRuangan)
              : null,
          namaRuangan: row.namaRuangan,
          umur: row.umur,
          jenisKelamin: row.jenisKelamin,
          pendidikan: row.pendidikan,
          pekerjaan: row.pekerjaan,
          jawaban: {},
          totalNilaiIkm: 0,
        });
      }

      const current = grouped.get(idPasien);
      current.jawaban[idPertanyaan] = nilai;
      current.totalNilaiIkm += nilai;
    }

    const dataRekap = Array.from(grouped.values()).sort((a, b) =>
      String(a.idPasien).localeCompare(String(b.idPasien), "id", {
        numeric: true,
      }),
    );

    res.status(200).json({
      success: true,
      message: "Data rekap SKM berhasil diambil",
      data: { bulan, tahun, namaRuangan, listPertanyaan, dataRekap },
    });
  } catch (error) {
    next(error);
  }
}
