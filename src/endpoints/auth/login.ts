import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../../data-source';
import { BCRYPT_SALT_ROUNDS, ROLE, SUPERADMIN_ROOM_ID } from '../../constant';
import { NotFoundError, UnauthorizedError } from '../../errors';
import { signAccessToken } from '../../jwt.util';
import { UserEntity } from '../../entities/user.entity';

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    const userRepository = AppDataSource.getRepository(UserEntity);
    const user = await userRepository.findOne({
      where: {
        username: String(username ?? '')
      }
    });

    if (!user) {
      throw new NotFoundError('Username tidak ditemukan');
    }

    const passwordInput = String(password ?? '');
    const storedPassword = String(user.password ?? '');
    const normalizedStoredPassword = storedPassword.startsWith('$2y$')
      ? `$2b$${storedPassword.slice(4)}`
      : storedPassword;

    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(passwordInput, normalizedStoredPassword);
    } catch (_error) {
      passwordMatch = false;
    }

    if (!passwordMatch) {
      const isPlaintextMatch = passwordInput === storedPassword;
      if (isPlaintextMatch) {
        const hashedPassword = await bcrypt.hash(passwordInput, BCRYPT_SALT_ROUNDS);
        await userRepository.update({ idUser: user.idUser }, { password: hashedPassword });
        passwordMatch = true;
      }
    }

    if (!passwordMatch) {
      throw new UnauthorizedError('Password salah');
    }

    const idUser = String(user.idUser);
    const idRuangan = String(user.idRuangan);
    const namaRuangan = String(user.namaRuangan ?? '');
    const role = idRuangan === SUPERADMIN_ROOM_ID ? ROLE.SUPERADMIN : ROLE.ADMIN;

    const token = signAccessToken({
      idUser,
      username: String(user.username ?? ''),
      idRuangan,
      namaRuangan,
      role
    });

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        user: {
          idUser,
          username: String(user.username ?? ''),
          idRuangan,
          namaRuangan,
          role
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
