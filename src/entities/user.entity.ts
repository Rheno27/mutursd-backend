import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RuanganEntity } from './ruangan.entity';

@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryColumn({ name: 'id_user', type: 'varchar', length: 255 })
  idUser!: string;

  @Column({ name: 'username', type: 'varchar', length: 50 })
  username!: string;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  password!: string;

  @Column({ name: 'id_ruangan', type: 'varchar', length: 255 })
  idRuangan!: string;

  @Column({ name: 'nama_ruangan', type: 'text' })
  namaRuangan!: string;

  @ManyToOne(() => RuanganEntity, (ruangan) => ruangan.users, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_ruangan' })
  ruangan!: RuanganEntity;
}
