import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { BadRequestError, NotFoundError, ValidationError } from '../../errors';
import { BioPasienEntity } from '../../entities/bio-pasien.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';
import { RuanganEntity } from '../../entities/ruangan.entity';

type SurveyAnswerPayload = {
  idPertanyaan: number | string;
  idPilihan?: number | string | null;
  teks?: string | null;
};

function formatToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function submitSurveyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      idRuangan,
      noRm,
      umur,
      jenisKelamin,
      pendidikan,
      pekerjaan,
      jawaban,
    } = req.body as {
      idRuangan?: string | number;
      noRm?: string;
      umur?: number | string;
      jenisKelamin?: string;
      pendidikan?: string;
      pekerjaan?: string;
      jawaban?: SurveyAnswerPayload[];
    };

    const normalizedIdRuangan = normalizeText(idRuangan);
    if (!normalizedIdRuangan) {
      throw new BadRequestError('idRuangan wajib diisi');
    }

    const normalizedNoRm = normalizeText(noRm);
    if (!normalizedNoRm) {
      throw new ValidationError('noRm wajib diisi');
    }

    if (!/^\d+$/.test(normalizedNoRm)) {
      throw new ValidationError('noRm harus berupa digit');
    }

    const parsedUmur = parsePositiveInteger(umur);
    if (parsedUmur === null) {
      throw new ValidationError('umur harus berupa integer positif');
    }

    const normalizedJenisKelamin = normalizeText(jenisKelamin);
    if (!normalizedJenisKelamin) {
      throw new ValidationError('jenisKelamin wajib diisi');
    }

    const normalizedPendidikan = normalizeText(pendidikan);
    if (!normalizedPendidikan) {
      throw new ValidationError('pendidikan wajib diisi');
    }

    const normalizedPekerjaan = normalizeText(pekerjaan);
    if (!normalizedPekerjaan) {
      throw new ValidationError('pekerjaan wajib diisi');
    }

    if (!Array.isArray(jawaban) || jawaban.length === 0) {
      throw new BadRequestError('jawaban tidak boleh kosong');
    }

    const ruanganRepository = AppDataSource.getRepository(RuanganEntity);
    const ruangan = await ruanganRepository.findOneBy({ idRuangan: normalizedIdRuangan });
    if (!ruangan) {
      throw new NotFoundError('Ruangan tidak ditemukan');
    }

    const tanggal = formatToday();

    const result = await AppDataSource.transaction(async (manager) => {
      const bioPasienRepository = manager.getRepository(BioPasienEntity);
      const jawabanRepository = manager.getRepository(JawabanEntity);
      const pilihanJawabanRepository = manager.getRepository(PilihanJawabanEntity);

      const bioPasien = bioPasienRepository.create({
        idRuangan: normalizedIdRuangan,
        noRm: normalizedNoRm,
        umur: parsedUmur,
        jenisKelamin: normalizedJenisKelamin,
        pendidikan: normalizedPendidikan,
        pekerjaan: normalizedPekerjaan,
      });

      const savedBioPasien = await bioPasienRepository.save(bioPasien);
      const idPasien = Number(savedBioPasien.idPasien);

      if (!Number.isFinite(idPasien) || idPasien <= 0) {
        throw new BadRequestError('Gagal menyimpan data pasien');
      }

      const jawabanTersimpan: JawabanEntity[] = [];

      for (const item of jawaban) {
        const idPertanyaan = Number(item?.idPertanyaan);
        if (!Number.isFinite(idPertanyaan) || idPertanyaan <= 0) {
          throw new BadRequestError('idPertanyaan wajib diisi');
        }

        const hasPilihan = item?.idPilihan !== undefined && item?.idPilihan !== null && String(item?.idPilihan).trim() !== '';

        let idPilihan: number | null = null;
        let hasilNilai: string = '';

        if (hasPilihan) {
          const pilihanJawaban = await pilihanJawabanRepository
            .createQueryBuilder('pilihan')
            .where('pilihan.id_pilihan = :idPilihan', {
              idPilihan: Number(item.idPilihan),
            })
            .getOne();

          if (!pilihanJawaban) {
            throw new NotFoundError('Pilihan jawaban tidak ditemukan');
          }

          idPilihan = pilihanJawaban.idPilihan;
          hasilNilai = String(pilihanJawaban.nilai);
        } else {
          const teks = normalizeText(item?.teks);
          if (!teks) {
            throw new BadRequestError('Teks kritik/saran wajib diisi');
          }

          hasilNilai = teks;
        }

        const jawabanEntity = jawabanRepository.create({
          idPasien,
          idPertanyaan,
          idPilihan,
          tanggal,
          hasilNilai,
        });

        const savedJawaban = await jawabanRepository.save(jawabanEntity);
        jawabanTersimpan.push(savedJawaban);
      }

      return {
        bioPasien: savedBioPasien,
        jawaban: jawabanTersimpan,
      };
    });

    res.json({
      success: true,
      message: 'Survei berhasil disimpan',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
