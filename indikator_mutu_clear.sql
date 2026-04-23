-- 1. Ruangan (induk dari user, bio_pasien, mutu_ruangan)
CREATE TABLE ruangan (
    id_ruangan VARCHAR(255) PRIMARY KEY,
    nama_ruangan VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Kategori 
CREATE TABLE kategori(
    id_kategori INT AUTO_INCREMENT PRIMARY KEY,
    kategori VARCHAR (100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Indikator Mutu (induk dari mutu_ruangan)
CREATE TABLE indikator_mutu(
    id_indikator INT AUTO_INCREMENT PRIMARY KEY,
	id_kategori INT NOT NULL,
    variabel TEXT NOT NULL,
    standar TEXT NOT NULL,
    CONSTRAINT fk_indikator_kategori FOREIGN KEY (id_kategori) REFERENCES kategori(id_kategori)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Indikator Ruangan (Inputan Superadmin)
CREATE TABLE indikator_ruangan(
    id_indikator_ruangan INT AUTO_INCREMENT PRIMARY KEY,
	id_ruangan VARCHAR(255) NOT NULL,
    id_indikator INT NOT NULL,
	active BOOL NOT NULL,
    CONSTRAINT fk_indikator_ruangan FOREIGN KEY (id_ruangan) REFERENCES ruangan(id_ruangan),
    CONSTRAINT fk_indikator_indikator FOREIGN KEY (id_indikator) REFERENCES indikator_mutu(id_indikator)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pertanyaan (
    id_pertanyaan INT AUTO_INCREMENT PRIMARY KEY,
    pertanyaan VARCHAR(255) NOT NULL,
    urutan INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. User (punya FK ke ruangan)
CREATE TABLE `user` (
    id_user VARCHAR(255) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    id_ruangan VARCHAR(255) NOT NULL,
	nama_ruangan TEXT NOT NULL,
    CONSTRAINT fk_user_ruangan FOREIGN KEY (id_ruangan) REFERENCES ruangan(id_ruangan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Bio Pasien (punya FK ke ruangan)
CREATE TABLE bio_pasien (
    id_pasien INT AUTO_INCREMENT PRIMARY KEY,
    id_ruangan VARCHAR(255) NOT NULL,
    no_rm VARCHAR(100) NOT NULL,
    umur INT NOT NULL,
    jenis_kelamin VARCHAR(50) NOT NULL,
    pendidikan VARCHAR(50) NOT NULL,
    pekerjaan VARCHAR(100) NOT NULL,
    CONSTRAINT fk_pasien_ruangan FOREIGN KEY (id_ruangan) REFERENCES ruangan(id_ruangan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Pilihan Jawaban (punya FK ke pertanyaan)
CREATE TABLE pilihan_jawaban (
    id_pilihan INT AUTO_INCREMENT PRIMARY KEY,
    id_pertanyaan INT NOT NULL,
    pilihan VARCHAR(255) NOT NULL,
    nilai INT NOT NULL,
    CONSTRAINT fk_pilihan_pertanyaan FOREIGN KEY (id_pertanyaan) REFERENCES pertanyaan(id_pertanyaan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Jawaban (punya FK ke pertanyaan & pilihan_jawaban)
CREATE TABLE jawaban (
    id_jawaban INT AUTO_INCREMENT PRIMARY KEY,
    tanggal DATE NOT NULL,
	id_pasien INT NOT NULL,
    id_pertanyaan INT NOT NULL,
    id_pilihan INT,
    hasil_nilai TEXT NOT NULL,
    CONSTRAINT fk_jawaban_pertanyaan FOREIGN KEY (id_pertanyaan) REFERENCES pertanyaan(id_pertanyaan),
    CONSTRAINT fk_jawaban_pilihan FOREIGN KEY (id_pilihan) REFERENCES pilihan_jawaban(id_pilihan),
	CONSTRAINT fk_id_pasien FOREIGN KEY (id_pasien) REFERENCES bio_pasien(id_pasien)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. Mutu Ruangan (punya FK ke ruangan & indikator_mutu)
CREATE TABLE mutu_ruangan (
    id_mutu INT AUTO_INCREMENT PRIMARY KEY,
    tanggal DATE NOT NULL, 
    id_indikator_ruangan INT NOT NULL, 
    total_pasien INT NOT NULL, 
    pasien_sesuai INT NOT NULL,
    CONSTRAINT fk_mutu_indikator FOREIGN KEY (id_indikator_ruangan) REFERENCES indikator_ruangan(id_indikator_ruangan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Sessions (Wajib untuk Laravel)
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- DATA SEEDING (YANG DISISAKAN)
-- ==========================================

-- 1. Ruangan (TETAP ADA)
INSERT INTO ruangan (id_ruangan, nama_ruangan) VALUES
('SP00', 'Super Admin'),
('R01', 'Nifas'),
('R02', 'Perinatologi'),
('R03', 'VK'),
('R04', 'Farmasi'),
('R05', 'Laboratorium'),
('R06', 'Anak'),
('R07', 'CSSD'),
('R08', 'Interna'),
('R09', 'IBS'),
('R10', 'ICU'),
('R11', 'IGD'),
('R12', 'IPSRS'),
('R13', 'Laundry'),
('R14', 'Bedah'),
('R15', 'Gizi'),
('R16', 'Rajal'),
('R17', 'VIP'),
('R18', 'RM'),
('R19', 'Radiologi'),
('R20', 'Keuangan'),
('R21', 'Nicu');

-- 2. Pertanyaan (TETAP ADA)
INSERT INTO pertanyaan (pertanyaan) VALUES
('Bagaimana pemahaman Saudara tentang kemudahan prosedur pelayanan di Rumah Sakit Daerah Kalisat?'),
('Bagaimana pemahaman Saudara tentang kejelasan prosedur pelayanan di Rumah Sakit Daerah Kalisat?'),
('Bagaimana pendapat Saudara tentang kecepatan dan ketepatan pelayanan di Rumah Sakit Daerah Kalisat?'),
('Bagaimana pendapat Saudara tentang kesopanan dan keramahan petugas dalam memberikan pelayanan?'),
('Bagaimana pendapat Saudara tentang kewajaran biaya untuk mendapatkan pelayanan?'),
('Bagaimana pendapat Saudara tentang kenyamanan dan kebersihan di lingkungan Rumah Sakit Daerah Kalisat?'),
('Bagaimana pendapat Saudara tentang keamanan pelayanan di ruangan ini'),
('Apakah pertimbangan Anda memilih dirawat di RumahSakit Daerah Kalisat?'),
('Menurut pendapat Anda, hal-hal apa yang seharusnya menjadi perhatian rumah sakit dan sedapat mungkin dikembangkan?'),
('Apakah yang anda inginkan untuk peningkatan kualitas pelayanan di rumah sakit ini?'),
('Apakah petugas kesehatan menjelaskan tentang penggunaan gelang identifikasi'),
('Apakah petugas kesehatan memperkenalkan diri saat mengunjungi pasien'),
('Apakah petugas menjelaskan tentang tindakan yang akan dilakukan terhadap pasien'),
('Apakah petugas kesehatan memberikan penjelasan tentang cara cuci tangan menggunakan 6 langkah'),
('Apakah petugas kesehatan menjelaskan tentang penanganan resiko jatuh'),
('Silahkan berikan kritik dan saran ');

-- 3. User (TETAP ADA)
INSERT INTO `user` (id_user, username, password, id_ruangan, nama_ruangan) VALUES
('U00', 'superadmin', 'superadmin123', 'SP00', 'Super Admin'),
('U01', 'ruang_nifas', 'nifas123', 'R01', 'Nifas'),
('U02', 'ruang_perinatologi', 'perinatologi123', 'R02', 'Perinatologi'),
('U03', 'ruang_vk', 'vk123', 'R03', 'VK'),
('U04', 'ruang_farmasi', 'farmasi123', 'R04', 'Farmasi'),
('U05', 'ruang_laboratorium', 'laboratorium123', 'R05', 'Laboratorium'),
('U06', 'ruang_anak', 'anak123', 'R06', 'Anak'),
('U07', 'ruang_cssd', 'cssd123', 'R07', 'CSSD'),
('U08', 'ruang_interna', 'interna123', 'R08', 'Interna'),
('U09', 'ruang_ibs', 'ibs123', 'R09', 'IBS'),
('U10', 'ruang_icu', 'icu123', 'R10', 'ICU'),
('U11', 'ruang_igd', 'igd123', 'R11', 'IGD'),
('U12', 'ruang_ipsrs', 'ipsrs123', 'R12', 'IPSRS'),
('U13', 'ruang_laundry', 'laundry123', 'R13', 'Laundry'),
('U14', 'ruang_bedah', 'bedah123', 'R14', 'Bedah'),
('U15', 'ruang_gizi', 'gizi123', 'R15', 'Gizi'),
('U16', 'ruang_rajal', 'rajal123', 'R16', 'Rajal'),
('U17', 'ruang_vip', 'vip123', 'R17', 'VIP'),
('U18', 'ruang_rm', 'rm123', 'R18', 'RM'),
('U19', 'ruang_radiologi', 'radiologi123', 'R19', 'Radiologi'),
('U20', 'ruang_keuangan', 'keuangan123', 'R20', 'Keuangan'),
('U21', 'ruang_nicu', 'nicu123', 'R21', 'Nicu');

-- 4. Pilihan Jawaban (TETAP ADA)
INSERT INTO pilihan_jawaban (id_pertanyaan, pilihan, nilai) VALUES
(1, 'Tidak Mudah', 2),
(1, 'Kurang Mudah', 3),
(1, 'Mudah', 4),
(1, 'Sangat Mudah', 5),
(2, 'Tidak Jelas', 2),
(2, 'Kurang Jelas', 3),
(2, 'Jelas', 4),
(2, 'Sangat Jelas', 5),
(3, 'Tidak Cepat', 2),
(3, 'Kurang Cepat', 3),
(3, 'Cepat', 4),
(3, 'Sangat Cepat', 5),
(4, 'Tidak Sopan dan Tidak Ramah', 2),
(4, 'Kurang SOpan dan Kurang Ramah', 3),
(4, 'Sopan dan Ramah', 4),
(4, 'Sangat Sopan dan Ramah', 5),
(5, 'Tidak Wajar', 2),
(5, 'Kurang Wajar', 3),
(5, 'Wajar', 4),
(5, 'Sangat Wajar', 5),
(6, 'Tidak Nyaman', 2),
(6, 'Kurang Nyaman', 3),
(6, 'Nyaman', 4),
(6, 'Sangat Nyaman', 5),
(7, 'Tidak Aman', 2),
(7, 'Kurang Aman', 3),
(7, 'Aman', 4),
(7, 'Sangat Aman', 5),
(8, 'Pelayanan yang baik', 2),
(8, 'Bangunan rumah sakit, peralatan yang lengkap dan canggih', 3),
(8, 'Harga pelayanan yang terjangkau', 4),
(8, 'Dekat dengan lokasi tempat tinggal', 5),
(9, 'Penataan kamar', 1),
(9, 'Penataan parkir', 2),
(9, 'Penambahan kamar', 3),
(9, 'Kebersihan bangunan', 4),
(9, 'Pengadaan pelayanan umum seperti wartel, mini market, dll', 5),
(10, 'Pelayanan yang cepat dengan harga terjangkau', 1),
(10, 'Kebersihan bangunan', 2),
(10, 'Keramahan, ketrampilan dan kemampuan petugas', 3),
(10, 'Adanya sarana pelayanan umum', 4),
(10, 'Peralatan kedokteran yang canggih', 5),
(11, 'Ya', 10),
(11, 'Tidak', 0),
(12, 'Ya', 10),
(12, 'Tidak', 0),
(13, 'Ya', 10),
(13, 'Tidak', 0),
(14, 'Ya', 10),
(14, 'Tidak', 0),
(15, 'Ya', 10),
(15, 'Tidak', 0);

-- Mengatur ulang urutan pertanyaan jika diperlukan
SET @r=0;
UPDATE pertanyaan SET urutan = (@r:=@r+1) ORDER BY id_pertanyaan ASC;