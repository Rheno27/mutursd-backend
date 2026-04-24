import "reflect-metadata";
import bcrypt from "bcrypt";
import { AppDataSource } from "../data-source";
import { UserEntity } from "../entities/user.entity";

const SALT_ROUNDS = 10;

function isBcryptHash(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function hashPasswords(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepository = AppDataSource.getRepository(UserEntity);
  const users = await userRepository.find();

  let scannedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    scannedCount += 1;

    const currentPassword = String(user.password ?? "");
    if (!currentPassword) {
      skippedCount += 1;
      // eslint-disable-next-line no-console
      console.warn(`[SKIP] ${user.idUser}: password kosong`);
      continue;
    }

    if (isBcryptHash(currentPassword)) {
      skippedCount += 1;
      // eslint-disable-next-line no-console
      console.log(`[SKIP] ${user.idUser}: sudah bcrypt`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(currentPassword, SALT_ROUNDS);
    user.password = hashedPassword;
    await userRepository.save(user);

    updatedCount += 1;
    // eslint-disable-next-line no-console
    console.log(`[OK] ${user.idUser}: password berhasil di-hash`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `Selesai. Scanned: ${scannedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
  );
}

if (require.main === module) {
  void hashPasswords()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Gagal menjalankan hash password", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    });
}

export { hashPasswords };
export default hashPasswords;
