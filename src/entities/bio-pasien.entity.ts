import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { JawabanEntity } from "./jawaban.entity";
import { RuanganEntity } from "./ruangan.entity";

@Entity({ name: "bio_pasien" })
export class BioPasienEntity {
  @PrimaryGeneratedColumn({ name: "id_pasien" })
  idPasien!: number;

  @Column({ name: "id_ruangan", type: "varchar", length: 255 })
  idRuangan!: string;

  @Column({ name: "no_rm" })
  noRm!: string;

  @Column({ name: "umur" })
  umur!: number;

  @Column({ name: "jenis_kelamin" })
  jenisKelamin!: string;

  @Column({ name: "pendidikan" })
  pendidikan!: string;

  @Column({ name: "pekerjaan" })
  pekerjaan!: string;

  @ManyToOne(() => RuanganEntity, (ruangan) => ruangan.bioPasien, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
    eager: false,
  })
  @JoinColumn({ name: "id_ruangan" })
  ruangan!: RuanganEntity;

  @OneToMany(() => JawabanEntity, (jawaban) => jawaban.bioPasien)
  jawaban!: JawabanEntity[];
}
