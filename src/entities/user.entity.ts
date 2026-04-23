import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RuanganEntity } from './ruangan.entity';

@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryGeneratedColumn({ name: 'id_user' })
  idUser!: number;

  @Column({ name: 'username' })
  username!: string;

  @Column({ name: 'password' })
  password!: string;

  @Column({ name: 'id_ruangan' })
  idRuangan!: number;

  @Column({ name: 'nama_ruangan' })
  namaRuangan!: string;

  @ManyToOne(() => RuanganEntity, (ruangan) => ruangan.users, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_ruangan' })
  ruangan!: RuanganEntity;
}