import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BioPasienEntity } from './bio-pasien.entity';
import { IndikatorRuanganEntity } from './indikator-ruangan.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'ruangan' })
export class RuanganEntity {
  @PrimaryColumn({ name: 'id_ruangan', type: 'varchar', length: 255 })
  idRuangan!: string;

  @Column({ name: 'nama_ruangan', type: 'varchar', length: 100 })
  namaRuangan!: string;

  @OneToMany(() => IndikatorRuanganEntity, (indikatorRuangan) => indikatorRuangan.ruangan)
  indikatorRuangan!: IndikatorRuanganEntity[];

  @OneToMany(() => BioPasienEntity, (bioPasien) => bioPasien.ruangan)
  bioPasien!: BioPasienEntity[];

  @OneToMany(() => UserEntity, (user) => user.ruangan)
  users!: UserEntity[];
}
