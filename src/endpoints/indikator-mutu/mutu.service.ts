import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type {
  AdminDashboardResponse,
  AssignIndikatorBody,
  AssignIndikatorResult,
  AuthenticatedUserContext,
  ChartSeriesItem,
  DailyStatItem,
  DeactivateIndikatorBody,
  EditIndikatorRuanganResponse,
  IndikatorMutuBody,
  IndikatorMutuDetail,
  IndikatorMutuListQuery,
  InputMutuBody,
  InputMutuFormResponse,
  PaginatedIndikatorMutuResponse,
  RoomDetailQuery,
  SaveInputMutuResponse,
  SuperadminDashboardGroupItem,
  SuperadminDashboardIndicatorItem,
  SuperadminDashboardQuery,
  SuperadminDashboardResponse,
  SuperadminRoomDetailResponse,
  SwitchIndikatorBody,
  MutuDashboardQuery,
} from "./mutu.schemas.js";

type DailyAggregate = {
  pasienSesuai: number;
  totalPasien: number;
};

type SkmAggregateResult = {
  variabel: string;
  byTanggal: Record<string, DailyAggregate>;
  jumlahTotal: number;
  jumlahSesuai: number;
  persen: number;
};

type KategoriSummaryRow = {
  idKategori: number;
  kategori: string;
};

type IndikatorMutuRow = {
  idIndikator: number;
  idKategori: number;
  variabel: string;
  standar: string;
  kategori?: KategoriSummaryRow | null;
};

type IndikatorRuanganRow = {
  idIndikatorRuangan: number;
  idIndikator: number;
  idRuangan: string;
  active: boolean;
  indikatorMutu: IndikatorMutuRow | null;
};

type MutuRuanganRow = {
  idMutu: number;
  tanggal: Date;
  idIndikatorRuangan: number;
  totalPasien: number;
  pasienSesuai: number;
  indikatorRuangan?: {
    idRuangan: string;
    indikatorMutu: {
      idIndikator: number;
      variabel: string;
      standar: string;
      kategori?: {
        idKategori: number;
        kategori: string;
      } | null;
    } | null;
  } | null;
};

type SuperadminPrioritasUnitRow = {
  ruangan: {
    namaRuangan: string;
  } | null;
  indikatorMutu: {
    variabel: string;
    standar: string;
  } | null;
  mutuRuangan: Array<{
    tanggal: Date;
    pasienSesuai: number;
    totalPasien: number;
  }>;
};

const DEFAULT_SUPERADMIN_CATEGORY = "Indikator Nasional Mutu";
const PRIORITAS_UNIT_CATEGORY = "Indikator Mutu Prioritas Unit";
const SKM_LABEL = "Kepuasan Masyarakat";

function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function sanitizeMonth(month?: number): number {
  if (!month || month < 1 || month > 12) {
    return getCurrentMonth();
  }

  return month;
}

function sanitizeYear(year?: number): number {
  if (!year || year < 2000 || year > 3000) {
    return getCurrentYear();
  }

  return year;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDayOfMonth(date: Date): string {
  return String(date.getUTCDate());
}

function formatPercent(
  numerator: number,
  denominator: number,
  emptyValue = 100,
): number {
  if (denominator <= 0) {
    return emptyValue;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function formatPercentLabel(
  numerator: number,
  denominator: number,
): string | null {
  if (denominator <= 0) {
    return null;
  }

  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function getKategoriSortRank(kategori: string): number {
  const normalizedKategori = kategori.toLowerCase();

  if (normalizedKategori.includes("prioritas unit")) {
    return 1;
  }

  if (normalizedKategori.includes("nasional mutu")) {
    return 2;
  }

  if (normalizedKategori.includes("prioritas rs")) {
    return 3;
  }

  return 4;
}

function sortAssignmentsByKategori(
  items: IndikatorRuanganRow[],
): IndikatorRuanganRow[] {
  return [...items].sort((a, b) => {
    const kategoriA = a.indikatorMutu?.kategori?.kategori ?? "";
    const kategoriB = b.indikatorMutu?.kategori?.kategori ?? "";

    return getKategoriSortRank(kategoriA) - getKategoriSortRank(kategoriB);
  });
}

export class MutuService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getInputMutuForm(
    user: AuthenticatedUserContext,
    tanggal?: string,
  ): Promise<InputMutuFormResponse> {
    const selectedDate = tanggal ?? toDateOnlyString(new Date());

    const indikatorRuanganAktif = (await this.db.indikatorRuangan.findMany({
      where: {
        idRuangan: user.idRuangan,
        active: true,
      },
      include: {
        indikatorMutu: true,
      },
      orderBy: {
        idIndikator: "asc",
      },
    })) as IndikatorRuanganRow[];

    const indikatorRuanganIds = indikatorRuanganAktif.map(
      (item: IndikatorRuanganRow) => item.idIndikatorRuangan,
    );

    const mutuHariIni =
      indikatorRuanganIds.length > 0
        ? ((await this.db.mutuRuangan.findMany({
            where: {
              tanggal: new Date(selectedDate),
              idIndikatorRuangan: {
                in: indikatorRuanganIds,
              },
            },
          })) as MutuRuanganRow[])
        : [];

    const mutuByIndikatorId: InputMutuFormResponse["mutu"] = {};

    for (const indikatorRuangan of indikatorRuanganAktif) {
      const record = mutuHariIni.find(
        (item: MutuRuanganRow) =>
          item.idIndikatorRuangan === indikatorRuangan.idIndikatorRuangan,
      );

      if (record) {
        mutuByIndikatorId[String(indikatorRuangan.idIndikator)] = {
          idMutu: record.idMutu,
          tanggal: toDateOnlyString(record.tanggal),
          totalPasien: record.totalPasien,
          pasienSesuai: record.pasienSesuai,
          idIndikatorRuangan: record.idIndikatorRuangan,
        };
      }
    }

    return {
      user,
      tanggal: selectedDate,
      indikator: indikatorRuanganAktif
        .filter((item: IndikatorRuanganRow) => Boolean(item.indikatorMutu))
        .map((item: IndikatorRuanganRow) => ({
          idIndikator: item.idIndikator,
          variabel: item.indikatorMutu?.variabel ?? "Tanpa Judul",
          standar: item.indikatorMutu?.standar ?? "",
          idIndikatorRuangan: item.idIndikatorRuangan,
        })),
      mutu: mutuByIndikatorId,
    };
  }

  async saveInputMutu(
    user: AuthenticatedUserContext,
    payload: InputMutuBody,
  ): Promise<SaveInputMutuResponse> {
    const indikatorIds = Object.keys(payload.pasienSesuai).map((value) =>
      Number(value),
    );

    if (indikatorIds.length === 0) {
      return {
        updatedCount: 0,
        message: "Tidak ada data yang valid untuk disimpan.",
      };
    }

    const indikatorRuanganList = (await this.db.indikatorRuangan.findMany({
      where: {
        idRuangan: user.idRuangan,
        idIndikator: {
          in: indikatorIds,
        },
        active: true,
      },
    })) as Array<{
      idIndikatorRuangan: number;
      idIndikator: number;
      idRuangan: string;
      active: boolean;
    }>;

    const indikatorRuanganByIndikatorId = new Map<
      number,
      (typeof indikatorRuanganList)[number]
    >(indikatorRuanganList.map((item) => [item.idIndikator, item]));

    let updatedCount = 0;

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const [indikatorIdKey, nilaiSesuai] of Object.entries(
        payload.pasienSesuai,
      )) {
        const indikatorId = Number(indikatorIdKey);
        const indikatorRuangan = indikatorRuanganByIndikatorId.get(indikatorId);

        if (!indikatorRuangan) {
          continue;
        }

        const nilaiTotal = payload.totalPasien[indikatorIdKey] ?? 0;

        const existing = await tx.mutuRuangan.findFirst({
          where: {
            tanggal: new Date(payload.tanggal),
            idIndikatorRuangan: indikatorRuangan.idIndikatorRuangan,
          },
        });

        if (existing) {
          await tx.mutuRuangan.update({
            where: {
              idMutu: existing.idMutu,
            },
            data: {
              totalPasien: nilaiTotal,
              pasienSesuai: nilaiSesuai,
            },
          });
        } else {
          await tx.mutuRuangan.create({
            data: {
              tanggal: new Date(payload.tanggal),
              idIndikatorRuangan: indikatorRuangan.idIndikatorRuangan,
              totalPasien: nilaiTotal,
              pasienSesuai: nilaiSesuai,
            },
          });
        }

        updatedCount += 1;
      }
    });

    return {
      updatedCount,
      message:
        updatedCount > 0
          ? "Data berhasil disimpan."
          : "Tidak ada data yang valid untuk disimpan.",
    };
  }

  async getAdminDashboard(
    user: AuthenticatedUserContext,
    query: MutuDashboardQuery,
  ): Promise<AdminDashboardResponse> {
    const bulan = sanitizeMonth(query.bulan);
    const tahun = sanitizeYear(query.tahun);

    const indikators = (await this.db.indikatorRuangan.findMany({
      where: {
        idRuangan: user.idRuangan,
        active: true,
      },
      include: {
        indikatorMutu: true,
      },
      orderBy: {
        idIndikator: "asc",
      },
    })) as IndikatorRuanganRow[];

    const mutu = (await this.db.mutuRuangan.findMany({
      where: {
        indikatorRuangan: {
          idRuangan: user.idRuangan,
        },
        tanggal: {
          gte: new Date(Date.UTC(tahun, bulan - 1, 1)),
          lt: new Date(Date.UTC(tahun, bulan, 1)),
        },
      },
      include: {
        indikatorRuangan: {
          include: {
            indikatorMutu: true,
          },
        },
      },
    })) as MutuRuanganRow[];

    const indikatorData = this.calculateDailyStats(indikators, mutu);
    const skmData = await this.getSkmData(bulan, tahun);

    indikatorData.push({
      no: indikatorData.length + 1,
      variabel: skmData.variabel,
      byTanggal: skmData.byTanggal,
      jumlahTotal: skmData.jumlahTotal,
      jumlahSesuai: skmData.jumlahSesuai,
      persen: skmData.persen,
    });

    return {
      user,
      bulan,
      tahun,
      jumlahHari: getDaysInMonth(bulan, tahun),
      indikatorData,
    };
  }

  async getSuperadminRoomDetail(
    idRuangan: string,
    query: RoomDetailQuery,
  ): Promise<SuperadminRoomDetailResponse> {
    const bulan = sanitizeMonth(query.bulan);
    const tahun = sanitizeYear(query.tahun);

    const ruangan = await this.db.ruangan.findUnique({
      where: {
        idRuangan,
      },
    });

    if (!ruangan) {
      throw new NotFoundError("Ruangan tidak ditemukan");
    }

    const indikators = (await this.db.indikatorRuangan.findMany({
      where: {
        idRuangan,
        active: true,
      },
      include: {
        indikatorMutu: true,
      },
      orderBy: {
        idIndikator: "asc",
      },
    })) as IndikatorRuanganRow[];

    const mutuBulanan = (await this.db.mutuRuangan.findMany({
      where: {
        indikatorRuangan: {
          idRuangan,
        },
        tanggal: {
          gte: new Date(Date.UTC(tahun, bulan - 1, 1)),
          lt: new Date(Date.UTC(tahun, bulan, 1)),
        },
      },
      include: {
        indikatorRuangan: {
          include: {
            indikatorMutu: true,
          },
        },
      },
    })) as MutuRuanganRow[];

    const indikatorData = this.calculateDailyStats(indikators, mutuBulanan);
    const skmData = await this.getSkmData(bulan, tahun);

    indikatorData.push({
      no: indikatorData.length + 1,
      variabel: skmData.variabel,
      byTanggal: skmData.byTanggal,
      jumlahTotal: skmData.jumlahTotal,
      jumlahSesuai: skmData.jumlahSesuai,
      persen: skmData.persen,
    });

    return {
      ruangan: {
        idRuangan: ruangan.idRuangan,
        namaRuangan: ruangan.namaRuangan,
      },
      bulan,
      tahun,
      jumlahHari: getDaysInMonth(bulan, tahun),
      selectedKategori: query.kategori ?? null,
      indikatorData,
      chartSeries: await this.buildChartSeriesForRuangan(idRuangan, tahun),
    };
  }

  async getEditIndikatorRuangan(
    idRuangan: string,
  ): Promise<EditIndikatorRuanganResponse> {
    const ruangan = await this.db.ruangan.findUnique({
      where: {
        idRuangan,
      },
    });

    if (!ruangan) {
      throw new NotFoundError("Ruangan tidak ditemukan");
    }

    const rawIndikators = (await this.db.indikatorRuangan.findMany({
      where: {
        idRuangan,
        active: true,
      },
      include: {
        indikatorMutu: {
          include: {
            kategori: true,
          },
        },
      },
    })) as IndikatorRuanganRow[];

    const activeIndikators = sortAssignmentsByKategori(rawIndikators);

    const allMasterIndikators = (await this.db.indikatorMutu.findMany({
      orderBy: {
        variabel: "asc",
      },
    })) as IndikatorMutuRow[];

    const allKategoris = (await this.db.kategori.findMany({
      orderBy: {
        idKategori: "asc",
      },
    })) as KategoriSummaryRow[];

    return {
      ruangan: {
        idRuangan: ruangan.idRuangan,
        namaRuangan: ruangan.namaRuangan,
      },
      activeIndikators: activeIndikators.map((item: IndikatorRuanganRow) => ({
        idIndikatorRuangan: item.idIndikatorRuangan,
        idIndikator: item.idIndikator,
        active: item.active,
        indikatorMutu: item.indikatorMutu
          ? {
              idIndikator: item.indikatorMutu.idIndikator,
              variabel: item.indikatorMutu.variabel,
              standar: item.indikatorMutu.standar,
              kategori: item.indikatorMutu.kategori
                ? {
                    idKategori: item.indikatorMutu.kategori.idKategori,
                    kategori: item.indikatorMutu.kategori.kategori,
                  }
                : null,
            }
          : null,
      })),
      allMasterIndikators: allMasterIndikators.map(
        (item: IndikatorMutuRow) => ({
          idIndikator: item.idIndikator,
          idKategori: item.idKategori,
          variabel: item.variabel,
          standar: item.standar,
        }),
      ),
      allKategoris: allKategoris.map((item: KategoriSummaryRow) => ({
        idKategori: item.idKategori,
        kategori: item.kategori,
      })),
      usedIndicatorIds: activeIndikators.map(
        (item: IndikatorRuanganRow) => item.idIndikator,
      ),
    };
  }

  async assignIndikatorToRuangan(
    payload: AssignIndikatorBody,
  ): Promise<AssignIndikatorResult> {
    const [ruangan, indikatorMutu] = await Promise.all([
      this.db.ruangan.findUnique({
        where: {
          idRuangan: payload.idRuangan,
        },
      }),
      this.db.indikatorMutu.findUnique({
        where: {
          idIndikator: payload.idIndikatorBaru,
        },
      }),
    ]);

    if (!ruangan) {
      throw new NotFoundError("Ruangan tidak ditemukan");
    }

    if (!indikatorMutu) {
      throw new NotFoundError("Indikator mutu tidak ditemukan");
    }

    const existing = await this.db.indikatorRuangan.findFirst({
      where: {
        idRuangan: payload.idRuangan,
        idIndikator: payload.idIndikatorBaru,
      },
    });

    if (existing?.active) {
      return {
        status: "error",
        message: "Indikator ini sudah aktif di ruangan ini.",
      };
    }

    if (existing) {
      await this.db.indikatorRuangan.update({
        where: {
          idIndikatorRuangan: existing.idIndikatorRuangan,
        },
        data: {
          active: true,
        },
      });
    } else {
      await this.db.indikatorRuangan.create({
        data: {
          idRuangan: payload.idRuangan,
          idIndikator: payload.idIndikatorBaru,
          active: true,
        },
      });
    }

    return {
      status: "success",
      message: "Indikator baru berhasil ditambahkan ke ruangan.",
    };
  }

  async switchIndikatorRuangan(payload: SwitchIndikatorBody): Promise<void> {
    const [ruangan, indikatorLama, indikatorBaru] = await Promise.all([
      this.db.ruangan.findUnique({
        where: {
          idRuangan: payload.idRuangan,
        },
      }),
      this.db.indikatorRuangan.findUnique({
        where: {
          idIndikatorRuangan: payload.idIndikatorRuanganLama,
        },
      }),
      this.db.indikatorMutu.findUnique({
        where: {
          idIndikator: payload.idIndikatorBaru,
        },
      }),
    ]);

    if (!ruangan) {
      throw new NotFoundError("Ruangan tidak ditemukan");
    }

    if (!indikatorLama) {
      throw new NotFoundError("Indikator ruangan lama tidak ditemukan");
    }

    if (!indikatorBaru) {
      throw new NotFoundError("Indikator mutu tidak ditemukan");
    }

    if (indikatorLama.idRuangan !== payload.idRuangan) {
      throw new ConflictError(
        "Indikator ruangan lama tidak cocok dengan ruangan yang dipilih.",
      );
    }

    const duplicateActive = await this.db.indikatorRuangan.findFirst({
      where: {
        idRuangan: payload.idRuangan,
        idIndikator: payload.idIndikatorBaru,
        active: true,
        NOT: {
          idIndikatorRuangan: payload.idIndikatorRuanganLama,
        },
      },
    });

    if (duplicateActive) {
      throw new ConflictError(
        "Gagal update! Indikator yang dipilih sudah aktif di ruangan ini (duplikat).",
      );
    }

    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.indikatorRuangan.update({
        where: {
          idIndikatorRuangan: payload.idIndikatorRuanganLama,
        },
        data: {
          active: false,
        },
      });

      const existingInactive = await tx.indikatorRuangan.findFirst({
        where: {
          idRuangan: payload.idRuangan,
          idIndikator: payload.idIndikatorBaru,
          active: false,
        },
      });

      if (existingInactive) {
        await tx.indikatorRuangan.update({
          where: {
            idIndikatorRuangan: existingInactive.idIndikatorRuangan,
          },
          data: {
            active: true,
          },
        });
      } else {
        await tx.indikatorRuangan.create({
          data: {
            idRuangan: payload.idRuangan,
            idIndikator: payload.idIndikatorBaru,
            active: true,
          },
        });
      }
    });
  }

  async deactivateIndikator(payload: DeactivateIndikatorBody): Promise<void> {
    const indikatorRuangan = await this.db.indikatorRuangan.findUnique({
      where: {
        idIndikatorRuangan: payload.idIndikatorRuangan,
      },
    });

    if (!indikatorRuangan) {
      throw new NotFoundError("Indikator ruangan tidak ditemukan");
    }

    await this.db.indikatorRuangan.update({
      where: {
        idIndikatorRuangan: payload.idIndikatorRuangan,
      },
      data: {
        active: false,
      },
    });
  }

  async listMasterIndikator(
    query: IndikatorMutuListQuery,
  ): Promise<PaginatedIndikatorMutuResponse> {
    const searchTerm = query.search?.trim();

    const where: Prisma.IndikatorMutuWhereInput | undefined = searchTerm
      ? {
          OR: [
            {
              variabel: {
                contains: searchTerm,
              },
            },
            {
              kategori: {
                kategori: {
                  contains: searchTerm,
                },
              },
            },
          ],
        }
      : undefined;

    const [total, indikators] = await Promise.all([
      this.db.indikatorMutu.count({ where }),
      this.db.indikatorMutu.findMany({
        where,
        include: {
          kategori: true,
          indikatorRuangan: {
            where: {
              active: true,
            },
            select: {
              idIndikatorRuangan: true,
            },
          },
        },
        orderBy: [{ kategori: { idKategori: "asc" } }, { idIndikator: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: indikators.map((item) => ({
        idIndikator: item.idIndikator,
        idKategori: item.idKategori,
        variabel: item.variabel,
        standar: item.standar,
        kategori: {
          idKategori: item.kategori.idKategori,
          kategori: item.kategori.kategori,
        },
        activeUsageCount: item.indikatorRuangan.length,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getMasterIndikatorById(id: number): Promise<IndikatorMutuDetail> {
    const indikator = await this.db.indikatorMutu.findUnique({
      where: {
        idIndikator: id,
      },
      include: {
        kategori: true,
      },
    });

    if (!indikator) {
      throw new NotFoundError("Data indikator tidak ditemukan.");
    }

    return {
      idIndikator: indikator.idIndikator,
      idKategori: indikator.idKategori,
      variabel: indikator.variabel,
      standar: indikator.standar,
      kategori: {
        idKategori: indikator.kategori.idKategori,
        kategori: indikator.kategori.kategori,
      },
    };
  }

  async createMasterIndikator(
    payload: IndikatorMutuBody,
  ): Promise<IndikatorMutuDetail> {
    const kategori = await this.db.kategori.findUnique({
      where: {
        idKategori: payload.idKategori,
      },
    });

    if (!kategori) {
      throw new NotFoundError("Kategori tidak ditemukan");
    }

    const indikator = await this.db.indikatorMutu.create({
      data: {
        idKategori: payload.idKategori,
        variabel: payload.variabel,
        standar: payload.standar,
      },
      include: {
        kategori: true,
      },
    });

    return {
      idIndikator: indikator.idIndikator,
      idKategori: indikator.idKategori,
      variabel: indikator.variabel,
      standar: indikator.standar,
      kategori: {
        idKategori: indikator.kategori.idKategori,
        kategori: indikator.kategori.kategori,
      },
    };
  }

  async updateMasterIndikator(
    id: number,
    payload: IndikatorMutuBody,
  ): Promise<IndikatorMutuDetail> {
    const indikator = await this.db.indikatorMutu.findUnique({
      where: {
        idIndikator: id,
      },
    });

    if (!indikator) {
      throw new NotFoundError("Data indikator tidak ditemukan.");
    }

    const kategori = await this.db.kategori.findUnique({
      where: {
        idKategori: payload.idKategori,
      },
    });

    if (!kategori) {
      throw new NotFoundError("Kategori tidak ditemukan");
    }

    const updatedIndikator = await this.db.indikatorMutu.update({
      where: {
        idIndikator: id,
      },
      data: {
        idKategori: payload.idKategori,
        variabel: payload.variabel,
        standar: payload.standar,
      },
      include: {
        kategori: true,
      },
    });

    return {
      idIndikator: updatedIndikator.idIndikator,
      idKategori: updatedIndikator.idKategori,
      variabel: updatedIndikator.variabel,
      standar: updatedIndikator.standar,
      kategori: {
        idKategori: updatedIndikator.kategori.idKategori,
        kategori: updatedIndikator.kategori.kategori,
      },
    };
  }

  async deleteMasterIndikator(id: number): Promise<void> {
    const indikator = await this.db.indikatorMutu.findUnique({
      where: {
        idIndikator: id,
      },
    });

    if (!indikator) {
      throw new NotFoundError("Data indikator tidak ditemukan.");
    }

    const isInUse = await this.db.indikatorRuangan.findFirst({
      where: {
        idIndikator: id,
      },
      select: {
        idIndikatorRuangan: true,
      },
    });

    if (isInUse) {
      throw new ConflictError(
        "Indikator ini tidak dapat dihapus karena sedang digunakan oleh satu atau lebih ruangan.",
      );
    }

    await this.db.indikatorMutu.delete({
      where: {
        idIndikator: id,
      },
    });
  }

  async getSuperadminDashboard(
    query: SuperadminDashboardQuery,
  ): Promise<SuperadminDashboardResponse> {
    const tahun = sanitizeYear(query.tahun);
    const selectedKategori =
      query.kategori?.trim() || DEFAULT_SUPERADMIN_CATEGORY;

    if (selectedKategori === PRIORITAS_UNIT_CATEGORY) {
      const relevantIndicators = (await this.db.indikatorRuangan.findMany({
        where: {
          active: true,
          indikatorMutu: {
            kategori: {
              kategori: selectedKategori,
            },
          },
        },
        include: {
          ruangan: true,
          indikatorMutu: true,
          mutuRuangan: {
            where: {
              tanggal: {
                gte: new Date(Date.UTC(tahun, 0, 1)),
                lt: new Date(Date.UTC(tahun + 1, 0, 1)),
              },
            },
          },
        },
      })) as SuperadminPrioritasUnitRow[];

      const groupedByRuangan = new Map<string, SuperadminPrioritasUnitRow[]>();

      for (const item of relevantIndicators) {
        const key = item.ruangan?.namaRuangan ?? "N/A";
        const current = groupedByRuangan.get(key) ?? [];
        current.push(item);
        groupedByRuangan.set(key, current);
      }

      const indikatorData: SuperadminDashboardGroupItem[] = Array.from(
        groupedByRuangan.entries(),
      ).map(([namaRuangan, indicators]) => ({
        namaRuangan,
        indikators: indicators.map((indicator: SuperadminPrioritasUnitRow) => ({
          judul: indicator.indikatorMutu?.variabel ?? "N/A",
          standar: indicator.indikatorMutu?.standar ?? "N/A",
          dataBulan: this.calculateMonthlyStats(indicator.mutuRuangan),
        })),
      }));

      return {
        tahun,
        selectedKategori,
        indikatorData,
      };
    }

    const masterIndicators = await this.db.indikatorMutu.findMany({
      where: {
        kategori: {
          kategori: selectedKategori,
        },
        variabel: {
          not: {
            contains: SKM_LABEL,
          },
        },
      },
      include: {
        indikatorRuangan: {
          select: {
            idIndikatorRuangan: true,
          },
        },
      },
    });

    const results: SuperadminDashboardIndicatorItem[] = [];

    for (const masterIndicator of masterIndicators) {
      const relatedIds = masterIndicator.indikatorRuangan.map(
        (item) => item.idIndikatorRuangan,
      );

      const allMutuData =
        relatedIds.length > 0
          ? ((await this.db.mutuRuangan.findMany({
              where: {
                idIndikatorRuangan: {
                  in: relatedIds,
                },
                tanggal: {
                  gte: new Date(Date.UTC(tahun, 0, 1)),
                  lt: new Date(Date.UTC(tahun + 1, 0, 1)),
                },
              },
            })) as Array<{
              tanggal: Date;
              pasienSesuai: number;
              totalPasien: number;
            }>)
          : [];

      results.push({
        ruangan: "-",
        judul: masterIndicator.variabel,
        standar: masterIndicator.standar,
        dataBulan: this.calculateMonthlyStats(allMutuData),
      });
    }

    if (selectedKategori === DEFAULT_SUPERADMIN_CATEGORY) {
      results.push(await this.calculateGlobalSkmYearly(tahun));
    }

    return {
      tahun,
      selectedKategori,
      indikatorData: results,
    };
  }

  private calculateDailyStats(
    indikatorRuanganList: Array<{
      idIndikatorRuangan: number;
      indikatorMutu: {
        variabel: string;
      } | null;
    }>,
    mutuRecords: Array<{
      tanggal: Date;
      idIndikatorRuangan: number;
      totalPasien: number;
      pasienSesuai: number;
    }>,
  ): DailyStatItem[] {
    return indikatorRuanganList.map((item, index) => {
      const dataMutu = mutuRecords.filter(
        (record) => record.idIndikatorRuangan === item.idIndikatorRuangan,
      );

      const byTanggal: Record<string, DailyAggregate> = {};
      let jumlahTotal = 0;
      let jumlahSesuai = 0;

      for (const row of dataMutu) {
        const tanggalKey = getDayOfMonth(row.tanggal);
        const current = byTanggal[tanggalKey] ?? {
          pasienSesuai: 0,
          totalPasien: 0,
        };

        current.pasienSesuai += row.pasienSesuai;
        current.totalPasien += row.totalPasien;
        byTanggal[tanggalKey] = current;

        jumlahSesuai += row.pasienSesuai;
        jumlahTotal += row.totalPasien;
      }

      return {
        no: index + 1,
        variabel: item.indikatorMutu?.variabel ?? "Tanpa Judul",
        byTanggal,
        jumlahTotal,
        jumlahSesuai,
        persen: formatPercent(jumlahSesuai, jumlahTotal),
      };
    });
  }

  private async getSkmData(
    bulan: number,
    tahun: number,
  ): Promise<SkmAggregateResult> {
    const maxScoresRaw = await this.db.pilihanJawaban.groupBy({
      by: ["idPertanyaan"],
      _max: {
        nilai: true,
      },
    });

    const maxScores = new Map<number, number>(
      maxScoresRaw.map((item) => [item.idPertanyaan, item._max.nilai ?? 0]),
    );

    const skmAnswers = await this.db.jawaban.findMany({
      where: {
        tanggal: {
          gte: new Date(Date.UTC(tahun, bulan - 1, 1)),
          lt: new Date(Date.UTC(tahun, bulan, 1)),
        },
      },
      include: {
        pilihanJawaban: true,
      },
    });

    const skmByTanggal: Record<string, DailyAggregate> = {};
    let skmTotalActual = 0;
    let skmTotalMax = 0;

    for (const answer of skmAnswers) {
      const tanggalKey = getDayOfMonth(answer.tanggal);
      const current = skmByTanggal[tanggalKey] ?? {
        pasienSesuai: 0,
        totalPasien: 0,
      };
      const nilai = answer.pilihanJawaban?.nilai ?? 0;
      const maxNilai = maxScores.get(answer.idPertanyaan) ?? 0;

      current.pasienSesuai += nilai;
      current.totalPasien += maxNilai;
      skmByTanggal[tanggalKey] = current;

      skmTotalActual += nilai;
      skmTotalMax += maxNilai;
    }

    return {
      variabel: SKM_LABEL,
      byTanggal: skmByTanggal,
      jumlahTotal: skmTotalMax,
      jumlahSesuai: skmTotalActual,
      persen: formatPercent(skmTotalActual, skmTotalMax, 0),
    };
  }

  private async buildChartSeriesForRuangan(
    idRuangan: string,
    tahun: number,
  ): Promise<ChartSeriesItem[]> {
    const mutuYear = (await this.db.mutuRuangan.findMany({
      where: {
        indikatorRuangan: {
          idRuangan,
        },
        tanggal: {
          gte: new Date(Date.UTC(tahun, 0, 1)),
          lt: new Date(Date.UTC(tahun + 1, 0, 1)),
        },
      },
      include: {
        indikatorRuangan: {
          include: {
            indikatorMutu: {
              include: {
                kategori: true,
              },
            },
          },
        },
      },
    })) as MutuRuanganRow[];

    const groups = new Map<number, MutuRuanganRow[]>();

    for (const item of mutuYear) {
      const masterId = item.indikatorRuangan?.indikatorMutu?.idIndikator;

      if (!masterId) {
        continue;
      }

      const current = groups.get(masterId) ?? [];
      current.push(item);
      groups.set(masterId, current);
    }

    const chartSeries: ChartSeriesItem[] = [];

    for (const items of groups.values()) {
      const first = items[0];
      const label =
        first?.indikatorRuangan?.indikatorMutu?.variabel ?? "Tanpa Judul";
      const kategori =
        first?.indikatorRuangan?.indikatorMutu?.kategori?.kategori ?? null;
      const monthly: Array<number | null> = [];

      for (let month = 1; month <= 12; month += 1) {
        const byMonth = items.filter(
          (item: MutuRuanganRow) => item.tanggal.getUTCMonth() + 1 === month,
        );

        if (byMonth.length === 0) {
          monthly.push(null);
          continue;
        }

        const sumSesuai = byMonth.reduce(
          (acc: number, item: MutuRuanganRow) => acc + item.pasienSesuai,
          0,
        );
        const sumTotal = byMonth.reduce(
          (acc: number, item: MutuRuanganRow) => acc + item.totalPasien,
          0,
        );

        monthly.push(sumTotal > 0 ? formatPercent(sumSesuai, sumTotal) : 100);
      }

      chartSeries.push({
        label,
        monthly,
        kategori,
      });
    }

    return chartSeries;
  }

  private calculateMonthlyStats(
    rows: Array<{
      tanggal: Date;
      pasienSesuai: number;
      totalPasien: number;
    }>,
  ): Array<string | null> {
    const monthlyAverages: Array<string | null> = [];

    for (let month = 1; month <= 12; month += 1) {
      const dataBulanIni = rows.filter(
        (item) => item.tanggal.getUTCMonth() + 1 === month,
      );

      if (dataBulanIni.length === 0) {
        monthlyAverages.push(null);
        continue;
      }

      const totalSesuai = dataBulanIni.reduce(
        (acc: number, item) => acc + item.pasienSesuai,
        0,
      );
      const totalPasien = dataBulanIni.reduce(
        (acc: number, item) => acc + item.totalPasien,
        0,
      );

      monthlyAverages.push(formatPercentLabel(totalSesuai, totalPasien));
    }

    return monthlyAverages;
  }

  private async calculateGlobalSkmYearly(
    tahun: number,
  ): Promise<SuperadminDashboardIndicatorItem> {
    const skmIndicator = await this.db.indikatorMutu.findFirst({
      where: {
        variabel: {
          contains: SKM_LABEL,
        },
      },
    });

    const maxScoresRaw = await this.db.pilihanJawaban.groupBy({
      by: ["idPertanyaan"],
      _max: {
        nilai: true,
      },
    });

    const maxScores = new Map<number, number>(
      maxScoresRaw.map((item) => [item.idPertanyaan, item._max.nilai ?? 0]),
    );

    const skmAnswers = await this.db.jawaban.findMany({
      where: {
        tanggal: {
          gte: new Date(Date.UTC(tahun, 0, 1)),
          lt: new Date(Date.UTC(tahun + 1, 0, 1)),
        },
      },
      include: {
        pilihanJawaban: true,
      },
    });

    const dataBulan: Array<string | null> = [];

    for (let month = 1; month <= 12; month += 1) {
      const answersByMonth = skmAnswers.filter(
        (item) => item.tanggal.getUTCMonth() + 1 === month,
      );

      if (answersByMonth.length === 0) {
        dataBulan.push(null);
        continue;
      }

      let totalActual = 0;
      let totalMax = 0;

      for (const answer of answersByMonth) {
        totalActual += answer.pilihanJawaban?.nilai ?? 0;
        totalMax += maxScores.get(answer.idPertanyaan) ?? 0;
      }

      dataBulan.push(formatPercentLabel(totalActual, totalMax));
    }

    return {
      ruangan: "-",
      judul: skmIndicator?.variabel ?? SKM_LABEL,
      standar: skmIndicator?.standar ?? "> 76.61",
      dataBulan,
    };
  }
}

export const mutuService = new MutuService();
