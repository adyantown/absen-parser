# Implementation Plan: Absensi Parser & Working Hours Calculator

## 1. System Overview

Aplikasi web sederhana untuk mengekstrak data dari file PDF laporan absensi bulanan pegawai (berbasis teks/tabel) contoh file ada di :ADYANTO_WAHYUDHI_NUGROHOKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150538.pdf dan menghitung status kehadiran serta pemenuhan jam kerja harian secara otomatis.

### Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API, Drag & Drop API)
- **Backend:** Node.js, Express.js
- **FileUpload Middleware:** `multer`
- **PDF Extraction:** `pdf-parse` (atau `pdf2json`)
- **Date Handling:** `dayjs` (dengan plugin `customParseFormat`, `isSameOrAfter`, `isSameOrBefore`)

---

## 2. Business Logic & Rules

### Work Duration Target

- **Target Jam Kerja Utuh:** 7 jam 30 menit (450 menit) per hari kerja.

### Daily Work Schedule & Break Hours

1. **Senin – Kamis:**
    - Jam Masuk Standar: **07.30**
    - Istirahat Otomatis: **12.00 – 13.00** (60 menit)
    - Jam Pulang Standar: **16.00**
2. **Jumat:**
    - Jam Masuk Standar: **07.30**
    - Istirahat Otomatis: **11.30 – 13.00** (90 menit)
    - Jam Pulang Standar: **16.30**

### Late Arrival & Compensatory Time ("Hutang Waktu")

- **Toleransi Keterlambatan:** Jika `Jam Masuk > 07:30:00`, dihitung sebagai **Terlambat**.
- **Durasi Keterlambatan ($X$ menit):** `Jam Masuk` - `07:30:00`.
- **Jam Pulang Wajib Minimal:** `Jam Pulang Standar + X menit`.
- **Status Akhir Kehadiran:**
    - `Hadir Utuh`: Jam Pulang $\ge$ Jam Pulang Wajib Minimal.
    - `Jam Kerja Kurang`: Jam Pulang < Jam Pulang Wajib Minimal.

---

## 3. Project Structure

```text
absensi-parser/
├── package.json
├── server.js
├── uploads/               # Temporary folder upload
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
