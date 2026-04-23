import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BioPasienEntity } from './bio-pasien.entity';
import { IndikatorRuanganEntity } from './indikator-ruangan.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'ruangan' })
export class RuanganEntity {
  @PrimaryGeneratedColumn({ name: 'id_ruangan' })
  idRuangan!: number;

  @Column({ name: 'nama_ruangan' })
  namaRuangan!: string;

  @OneToMany(() => IndikatorRuanganEntity, (indikatorRuangan) => indikatorRuangan.ruangan)
  indikatorRuangan!: IndikatorRuanganEntity[];

  @OneToMany(() => BioPasienEntity, (bioPasien) => bioPasien.ruangan)
  bioPasien!: BioPasienEntity[];

  @OneToMany(() => UserEntity, (user) => user.ruangan)
  users!: UserEntity[];
}