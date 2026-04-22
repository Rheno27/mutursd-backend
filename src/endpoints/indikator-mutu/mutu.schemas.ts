import { z } from "zod";

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "tanggal harus berformat YYYY-MM-DD");

const numericRecordSchema = z.record(z.string(), nonNegativeInt);

export const mutuDashboardQuerySchema = z.object({
  bulan: z.coerce.number().int().min(1).max(12).optional(),
  tahun: z.coerce.number().int().min(2000).max(3000).optional(),
});

export const roomDetailQuerySchema = z.object({
  bulan: z.coerce.number().int().min(1).max(12).optional(),
  tahun: z.coerce.number().int().min(2000).max(3000).optional(),
  kategori: z.string().trim().min(1).optional(),
});

export const inputMutuBodySchema = z
  .object({
    tanggal: dateStringSchema,
    pasienSesuai: numericRecordSchema,
    totalPasien: numericRecordSchema,
  })
  .superRefine((data, ctx) => {
    for (const [indikatorId, pasienSesuai] of Object.entries(data.pasienSesuai)) {
      const totalPasien = data.totalPasien[indikatorId] ?? 0;

      if (pasienSesuai > totalPasien) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pasienSesuai", indikatorId],
          message: `Jumlah pasien sesuai (${pasienSesuai}) tidak boleh lebih besar dari total pasien (${totalPasien}).`,
        });
      }
    }
  });

export const assignIndikatorBodySchema = z.object({
  idRuangan: z.string().trim().min(1, "idRuangan wajib diisi"),
  idIndikatorBaru: positiveInt,
});

export const switchIndikatorBodySchema = z.object({
  idRuangan: z.string().trim().min(1, "idRuangan wajib diisi"),
  idIndikatorRuanganLama: positiveInt,
  idIndikatorBaru: positiveInt,
});

export const deactivateIndikatorBodySchema = z.object({
  idIndikatorRuangan: positiveInt,
});

export const indikatorMutuBodySchema = z.object({
  idKategori: positiveInt,
  variabel: z.string().trim().min(1, "variabel wajib diisi"),
  standar: z.string().trim().min(1, "standar wajib diisi"),
});

export const indikatorMutuListQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
});

export const indikatorMutuParamsSchema = z.object({
  id: positiveInt,
});

export const ruanganParamsSchema = z.object({
  idRuangan: z.string().trim().min(1, "idRuangan wajib diisi"),
});

export const authenticatedUserHeaderSchema = z.object({
  idUser: z.string().trim().min(1, "idUser wajib diisi"),
  username: z.string().trim().min(1, "username wajib diisi"),
  idRuangan: z.string().trim().min(1, "idRuangan wajib diisi"),
  namaRuangan: z.string().trim().min(1, "namaRuangan wajib diisi"),
});

export interface AuthenticatedUserContext {
  idUser: string;
  username: string;
  idRuangan: string;
  namaRuangan: string;
}

export interface DailyMutuEntry {
  pasienSesuai: number;
  totalPasien: number;
}

export interface DailyStatItem {
  no: number;
  variabel: string;
  byTanggal: Record<string, DailyMutuEntry>;
  jumlahTotal: number;
  jumlahSesuai: number;
  persen: number;
}

export interface SkmStatItem {
  variabel: string;
  byTanggal: Record<string, DailyMutuEntry>;
  jumlahTotal: number;
  jumlahSesuai: number;
  persen: number;
}

export interface ChartSeriesItem {
  label: string;
  monthly: Array<number | null>;
  kategori: string | null;
}

export interface AssignIndikatorResult {
  status: "success" | "error";
  message: string;
}

export interface IndikatorMutuCategorySummary {
  idKategori: number;
  kategori: string;
}

export interface IndikatorMutuListItem {
  idIndikator: number;
  idKategori: number;
  variabel: string;
  standar: string;
  kategori: IndikatorMutuCategorySummary;
  activeUsageCount: number;
}

export interface IndikatorMutuDetail {
  idIndikator: number;
  idKategori: number;
  variabel: string;
  standar: string;
  kategori: IndikatorMutuCategorySummary;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedIndikatorMutuResponse {
  data: IndikatorMutuListItem[];
  meta: PaginationMeta;
}

export interface AdminDashboardResponse {
  user: AuthenticatedUserContext;
  bulan: number;
  tahun: number;
  jumlahHari: number;
  indikatorData: DailyStatItem[];
}

export interface SuperadminRoomDetailResponse {
  ruangan: {
    idRuangan: string;
    namaRuangan: string;
  };
  bulan: number;
  tahun: number;
  jumlahHari: number;
  selectedKategori: string | null;
  indikatorData: DailyStatItem[];
  chartSeries: ChartSeriesItem[];
}

export interface ActiveIndikatorAssignmentItem {
  idIndikatorRuangan: number;
  idIndikator: number;
  active: boolean;
  indikatorMutu: {
    idIndikator: number;
    variabel: string;
    standar: string;
    kategori: {
      idKategori: number;
      kategori: string;
    } | null;
  } | null;
}

export interface EditIndikatorRuanganResponse {
  ruangan: {
    idRuangan: string;
    namaRuangan: string;
  };
  activeIndikators: ActiveIndikatorAssignmentItem[];
  allMasterIndikators: Array<{
    idIndikator: number;
    idKategori: number;
    variabel: string;
    standar: string;
  }>;
  allKategoris: Array<{
    idKategori: number;
    kategori: string;
  }>;
  usedIndicatorIds: number[];
}

export interface InputMutuFormIndicatorItem {
  idIndikator: number;
  variabel: string;
  standar: string;
  idIndikatorRuangan: number;
}

export interface InputMutuFormMutuItem {
  idMutu: number;
  tanggal: string;
  totalPasien: number;
  pasienSesuai: number;
  idIndikatorRuangan: number;
}

export interface InputMutuFormResponse {
  user: AuthenticatedUserContext;
  tanggal: string;
  indikator: InputMutuFormIndicatorItem[];
  mutu: Record<string, InputMutuFormMutuItem>;
}

export interface SaveInputMutuResponse {
  updatedCount: number;
  message: string;
}

export interface SuperadminDashboardQuery {
  tahun?: number;
  kategori?: string;
}

export interface SuperadminDashboardIndicatorItem {
  ruangan: string;
  judul: string;
  standar: string;
  dataBulan: Array<string | null>;
}

export interface SuperadminDashboardGroupItem {
  namaRuangan: string;
  indikators: Array<{
    judul: string;
    standar: string;
    dataBulan: Array<string | null>;
  }>;
}

export interface SuperadminDashboardResponse {
  tahun: number;
  selectedKategori: string;
  indikatorData: Array<SuperadminDashboardIndicatorItem | SuperadminDashboardGroupItem>;
}

export type MutuDashboardQuery = z.infer<typeof mutuDashboardQuerySchema>;
export type RoomDetailQuery = z.infer<typeof roomDetailQuerySchema>;
export type InputMutuBody = z.infer<typeof inputMutuBodySchema>;
export type AssignIndikatorBody = z.infer<typeof assignIndikatorBodySchema>;
export type SwitchIndikatorBody = z.infer<typeof switchIndikatorBodySchema>;
export type DeactivateIndikatorBody = z.infer<typeof deactivateIndikatorBodySchema>;
export type IndikatorMutuBody = z.infer<typeof indikatorMutuBodySchema>;
export type IndikatorMutuListQuery = z.infer<typeof indikatorMutuListQuerySchema>;
export type IndikatorMutuParams = z.infer<typeof indikatorMutuParamsSchema>;
export type RuanganParams = z.infer<typeof ruanganParamsSchema>;
export type AuthenticatedUserHeaders = z.infer<typeof authenticatedUserHeaderSchema>;
