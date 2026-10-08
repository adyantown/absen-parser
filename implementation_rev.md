# Implementation Plan: Comprehensive Absensi Parser & Working Hours Calculator

## 1. System Overview

Aplikasi web berbasis Node.js dan Vanilla JavaScript untuk mengekstrak data laporan absensi bulanan pegawai (format PDF) secara _batch_ (34+ file sekaligus) dan menghitung status kehadiran, keterlambatan, serta pemenuhan durasi jam kerja secara rinci.

### Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API, Drag & Drop API, Modal/Detail View)
- **Backend:** Node.js, Express.js
- **File Processing:** `multer` (Upload handling)
- **PDF Parsing:** `pdf-parse` (Ekstraksi teks dari PDF berbasis vektor/tabel)
- **Date/Time Handling:** `dayjs` (Plugin: `customParseFormat`, `isSameOrAfter`, `isSameOrBefore`, `duration`)

---

## 2. Comprehensive Business Logic & Rules

### A. Target Jam Kerja & Jadwal Harian

- **Target Jam Kerja Utuh:** 7 jam 30 menit (450 menit) per hari kerja.
- **Senin – Kamis:**
    - Jam Masuk Standar: **07:30:00**
    - Istirahat Otomatis: **12:00 – 13:00** (60 menit)
    - Jam Pulang Standar: **16:00:00**
- **Jumat:**
    - Jam Masuk Standar: **07:30:00**
    - Istirahat Otomatis: **11:30 – 13:00** (90 menit)
    - Jam Pulang Standar: **16:30:00**
- **Sabtu & Minggu / Hari Libur:** Diidentifikasi sebagai hari non-kerja.

### B. Aturan Keterlambatan & Hutang Waktu (Compensatory Time)

1. **Status Waktu Masuk:**
    - `Tepat Waktu`: `Jam Masuk` $\le$ **07:30:00**.
    - `Terlambat`: `Jam Masuk` > **07:30:00**.
2. **Hitungan Keterlambatan ($X$ menit):** `Jam Masuk` - **07:30:00**.
3. **Jam Pulang Wajib Minimal:** `Jam Pulang Standar` + $X$ menit.
4. **Status Pemenuhan Jam Kerja (Fulfillment):**
    - `Hadir Utuh`: `Jam Pulang` $\ge$ `Jam Pulang Wajib Minimal`.
    - `Jam Kerja Kurang`: `Jam Pulang` < `Jam Pulang Wajib Minimal` (dengan menghitung sisa hutang waktu dalam menit).

### C. Pemetaan Status Kehadiran (Attendance Status Categories)

Aplikasi mengelompokkan baris data absensi ke dalam kategori berikut:

1. **Kehadiran Fisik/Kerja:** `WFO` (Work From Office), `WFH` (Work From Home).
2. **Ketidakhadiran Sah/Izin:** `IZIN`, `CUTI`, `DL` (Dinas Luar).
3. **Ketidakhadiran Tanpa Keterangan:** `TIDAK MELAKUKAN ABSENSI` / `ALPA` (Jika pada hari kerja tidak ada jam masuk & pulang, serta tidak ada kode Izin/Cuti/DL).

Rekap dan filter `Izin/Cuti/DL` menghitung hari berkode absensi `DL` pada jam masuk maupun jam pulang, termasuk ketika hari tersebut juga memiliki dua jam absensi. Deteksi teks `DL`/`Dinas Luar` digunakan sebagai fallback hanya bila tidak ada jam absensi yang terbaca.

---

## 3. Project Structure

```text
absensi-parser/
├── package.json
├── server.js
├── uploads/               # Temporary file storage
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
