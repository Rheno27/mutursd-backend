import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { BadRequestError, NotFoundError } from '../../errors';
import { BioPasienEntity } from '../../entities/bio-pasien.entity';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';

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

    if (!Array.isArray(jawaban)) {
      throw new BadRequestError('Format jawaban tidak valid');
    }

    const tanggal = formatToday();

    const result = await AppDataSource.transaction(async (manager) => {
      const bioPasienRepository = manager.getRepository(BioPasienEntity);
      const jawabanRepository = manager.getRepository(JawabanEntity);
      const pilihanJawabanRepository = manager.getRepository(PilihanJawabanEntity);

      const bioPasien = bioPasienRepository.create(
        {
          id_ruangan: String(idRuangan ?? ''),
          no_rm: noRm ?? null,
          umur: umur ?? null,
          jenis_kelamin: jenisKelamin ?? null,
          pendidikan: pendidikan ?? null,
          pekerjaan: pekerjaan ?? null,
        } as any,
      );

      const savedBioPasien = await bioPasienRepository.save(bioPasien);
      const idPasien = String((savedBioPasien as any).id_pasien ?? (savedBioPasien as any).idPasien ?? '');

      if (!idPasien) {
        throw new BadRequestError('Gagal menyimpan data pasien');
      }

      const jawabanTersimpan: any[] = [];

      for (const item of jawaban) {
        const idPertanyaan = item?.idPertanyaan;
        if (idPertanyaan === undefined || idPertanyaan === null || String(idPertanyaan).trim() === '') {
          throw new BadRequestError('idPertanyaan wajib diisi');
        }

        const hasPilihan = item?.idPilihan !== undefined && item?.idPilihan !== null && String(item?.idPilihan).trim() !== '';

        let idPilihan: string | number | null = null;
        let hasilNilai: string | number | null = null;

        if (hasPilihan) {
          const pilihanJawaban = await pilihanJawabanRepository
            .createQueryBuilder('pilihan')
            .where('CAST(pilihan.id_pilihan AS CHAR) = :idPilihan', {
              idPilihan: String(item.idPilihan),
            })
            .getOne();

          if (!pilihanJawaban) {
            throw new NotFoundError('Pilihan jawaban tidak ditemukan');
          }

          idPilihan = String((pilihanJawaban as any).id_pilihan ?? item.idPilihan);
          hasilNilai = (pilihanJawaban as any).nilai;
        } else {
          const teks = item?.teks === undefined || item?.teks === null ? '' : String(item.teks).trim();
          if (!teks) {
            throw new BadRequestError('Teks kritik/saran wajib diisi');
          }

          hasilNilai = teks;
        }

        const jawabanEntity = jawabanRepository.create(
          {
            id_pasien: idPasien,
            id_pertanyaan: String(idPertanyaan),
            id_pilihan: idPilihan,
            tanggal,
            hasil_nilai: hasilNilai,
          } as any,
        );

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