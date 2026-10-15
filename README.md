# Absensi Parser & Jam Kerja

## What is this application about?

Aplikasi ini membantu operator KPU Kabupaten Tulang Bawang Barat mengolah laporan absensi pegawai bulanan dalam format PDF. Aplikasi mengekstrak catatan kehadiran, menghitung pemenuhan jam kerja, dan menyajikan hasilnya dalam tampilan per pegawai maupun rekap batch. Operator juga dapat mengekspor data ke CSV atau membuat rekap kehadiran bulanan dalam PDF.

Tujuannya adalah mempermudah peninjauan kehadiran sekaligus membedakan ketidakhadiran tanpa keterangan dari status yang sah, seperti sakit, cuti, izin, dinas luar, dan hari libur.

## Fitur

- Memproses satu atau beberapa PDF absensi bulanan sekaligus.
- Menampilkan rincian harian, termasuk waktu dan kode check-in/check-out, uraian tugas, serta foto PIC jika tersedia pada PDF sumber.
- Menghitung keterlambatan dan durasi kerja net setelah potongan istirahat:
  - Target kerja net: 7 jam 30 menit per hari kerja.
  - Jam masuk standar: 07.30.
  - Jam pulang standar: 16.00 pada Senin-Kamis dan 16.30 pada Jumat.
  - Potongan istirahat: 12.00-13.00 pada Senin-Kamis dan 11.30-13.00 pada Jumat.
- Membedakan status Hadir Penuh, Jam Kerja Kurang, Alpa, Cuti, Sakit, Izin, Dinas Luar, Tidak Check-in, dan Tidak Check-out.
- Menyediakan rekap batch yang responsif serta filter status kehadiran.
- Mengekspor rincian atau rekap batch ke CSV.
- Membuat PDF rekap bulanan berorientasi landscape, dengan kop KPU, status check-in/check-out per tanggal, dan blok tanda tangan Plt. Sekretaris.
- Mengenali hari libur yang didaftarkan secara eksplisit, menampilkan keterangannya, dan mengecualikannya dari perhitungan hari kerja dan Alpa.

## Kalender hari libur

Hari libur dikelola secara eksplisit di [`holiday-calendar.js`](./holiday-calendar.js). Setiap entri menggunakan tanggal `DD-MM-YYYY` dan nama/keterangan hari libur. Kalender saat ini mencakup:

| Tanggal | Keterangan |
| --- | --- |
| 24-12-2026 | Cuti Bersama Hari Raya Natal |
| 25-12-2026 | Hari Raya Natal |

Tanggal cuti bersama hanya diperlakukan sebagai hari libur jika tercantum di kalender ini. Untuk menambah atau mengubah tanggal libur yang telah dipastikan, sunting daftar tersebut. Tanggal yang tidak terdaftar tidak otomatis dianggap sebagai hari libur.

## Menjalankan aplikasi

Persyaratan: Node.js dan npm.

```bash
npm install
node server.js
```

Secara default aplikasi berjalan di `http://localhost:3000`. Port dapat diubah dengan mengatur variabel lingkungan `PORT`.

## Menjalankan tes

```bash
npm test
```

## Teknologi

- Node.js dan Express
- HTML, CSS, dan JavaScript
- `pdf-parse` untuk membaca data PDF
- `pdfkit` untuk membuat laporan PDF
- `multer` untuk menerima unggahan PDF
- `dayjs` untuk pengolahan tanggal
