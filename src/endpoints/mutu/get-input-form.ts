import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { UnauthorizedError, BadRequestError } from "../../errors";
import { IndikatorRuanganEntity } from "../../entities/indikator-ruangan.entity";
import { MutuRuanganEntity } from "../../entities/mutu-ruangan.entity";

type RawIndicatorRow = {
  idIndikatorRuangan?: string | number | null;
  idIndikator?: string | number | null;
  variabel?: string | null;
  standar?: string | null;
};

type RawMutuRow = {
  idMutu?: string | number | null;
  tanggal?: string | Date | null;
  totalPasien?: string | number | null;
  pasienSesuai?: string | number | null;
  idIndikatorRuangan?: string | number | null;
};

type InputIndicatorItem = {
  idIndikator: number;
  variabel: string;
  standar: string;
  idIndikatorRuangan: number;
};

type InputMutuItem = {
  idMutu: number;
  tanggal: string;
  totalPasien: number;
  pasienSesuai: number;
  idIndikatorRuangan: number;
};

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function resolveTanggal(queryValue: unknown): string {
  const raw = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return formatDateOnly(new Date());
  }

  const tanggal = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new BadRequestError("Format tanggal harus YYYY-MM-DD");
  }

  const parsed = new Date(`${tanggal}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("Format tanggal tidak valid");
  }

  return tanggal;
}

function formatDbDate(value: unknown): string {
  if (value instanceof Date) {
    return formatDateOnly(value);
  }

  const raw = toStringValue(value);
  if (raw.length === 0) {
    return "";
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed);
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return raw;
}

export async function getMutuInputFormHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new UnauthorizedError("Authentication is required");
    }

    const tanggal = resolveTanggal(req.query.tanggal);
    const idRuangan = toStringValue(authUser.idRuangan);

    const indikatorRuanganRepository = AppDataSource.getRepository(
      IndikatorRuanganEntity,
    );
    const mutuRuanganRepository =
      AppDataSource.getRepository(MutuRuanganEntity);

    const indikatorRows = (await indikatorRuanganRepository
      .createQueryBuilder("ir")
      .innerJoin("ir.indikatorMutu", "im")
      .select([
        'ir.id_indikator_ruangan AS "idIndikatorRuangan"',
        'ir.id_indikator AS "idIndikator"',
        "im.variabel AS variabel",
        "im.standar AS standar",
      ])
      .where("ir.id_ruangan = :idRuangan", { idRuangan })
      .andWhere("ir.active = true")
      .orderBy("im.id_kategori", "ASC")
      .addOrderBy("im.variabel", "ASC")
      .getRawMany()) as RawIndicatorRow[];

    const indikator: InputIndicatorItem[] = indikatorRows.map((row) => ({
      idIndikator: toNumber(row.idIndikator),
      variabel: toStringValue(row.variabel),
      standar: toStringValue(row.standar),
      idIndikatorRuangan: toNumber(row.idIndikatorRuangan),
    }));

    const indicatorRoomIds = indikator
      .map((item) => item.idIndikatorRuangan)
      .filter((value) => Number.isFinite(value));

    const mutuRows =
      indicatorRoomIds.length === 0
        ? []
        : ((await mutuRuanganRepository
            .createQueryBuilder("mr")
            .select([
              'mr.id_mutu AS "idMutu"',
              "mr.tanggal AS tanggal",
              'mr.total_pasien AS "totalPasien"',
              'mr.pasien_sesuai AS "pasienSesuai"',
              'mr.id_indikator_ruangan AS "idIndikatorRuangan"',
            ])
            // PostgreSQL: cast date to compare with text param
            .where("mr.tanggal::date = :tanggal", { tanggal })
            .andWhere("mr.id_indikator_ruangan IN (:...indicatorRoomIds)", {
              indicatorRoomIds,
            })
            .getRawMany()) as RawMutuRow[]);

    const mutu: Record<string, InputMutuItem> = {};
    for (const row of mutuRows) {
      const idIndikatorRuangan = toNumber(row.idIndikatorRuangan);
      const indikatorItem = indikator.find(
        (item) => item.idIndikatorRuangan === idIndikatorRuangan,
      );
      if (!indikatorItem) {
        continue;
      }

      const key = String(indikatorItem.idIndikator);
      mutu[key] = {
        idMutu: toNumber(row.idMutu),
        tanggal: formatDbDate(row.tanggal),
        totalPasien: toNumber(row.totalPasien),
        pasienSesuai: toNumber(row.pasienSesuai),
        idIndikatorRuangan,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          idUser: authUser.idUser,
          username: authUser.username,
          idRuangan: authUser.idRuangan,
          namaRuangan: authUser.namaRuangan,
        },
        tanggal,
        indikator,
        mutu,
      },
    });
    return;
  } catch (error) {
    return next(error);
  }
}
