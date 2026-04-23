import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BioPasienEntity } from './bio-pasien.entity';
import { PilihanJawabanEntity } from './pilihan-jawaban.entity';
import { PertanyaanEntity } from './pertanyaan.entity';

@Entity({ name: 'jawaban' })
export class JawabanEntity {
  @PrimaryGeneratedColumn({ name: 'id_jawaban' })
  idJawaban!: number;

  @Column({ name: 'tanggal' })
  tanggal!: Date;

  @Column({ name: 'id_pasien' })
  idPasien!: number;

  @Column({ name: 'id_pertanyaan' })
  idPertanyaan!: number;

  @Column({ name: 'id_pilihan', nullable: true })
  idPilihan!: number | null;

  @Column({ name: 'hasil_nilai' })
  hasilNilai!: string;

  @ManyToOne(() => BioPasienEntity, (bioPasien) => bioPasien.jawaban, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_pasien' })
  bioPasien!: BioPasienEntity;

  @ManyToOne(() => PertanyaanEntity, (pertanyaan) => pertanyaan.jawaban, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_pertanyaan' })
  pertanyaan!: PertanyaanEntity;

  @ManyToOne(() => PilihanJawabanEntity, (pilihanJawaban) => pilihanJawaban.jawaban, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'id_pilihan' })
  pilihanJawaban!: PilihanJawabanEntity | null;
}