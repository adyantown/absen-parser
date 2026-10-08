const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const path = require('path');
const fs = require('fs');

dayjs.extend(customParseFormat);

// Suppress non-critical pdf-parse / pdfjs font warnings in console
const origWarn = console.warn;
console.warn = function (...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('standardFontDataUrl')) {
        return;
    }
    origWarn.apply(console, args);
};

const app = express();
const PORT = process.env.PORT || 3005;

// Setup Multer (Memory Storage) - Max 100 files per batch
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper Functions
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
}

function secondsToTime(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function formatDuration(seconds) {
    const isNegative = seconds < 0;
    const absSec = Math.abs(seconds);
    const h = Math.floor(absSec / 3600);
    const m = Math.floor((absSec % 3600) / 60);
    const s = absSec % 60;

    let res = '';
    if (h > 0) res += `${h}j `;
    if (m > 0 || h > 0) res += `${m}m `;
    res += `${s}s`;

    return isNegative ? `-${res.trim()}` : `+${res.trim()}`;
}

function formatDurationSimple(seconds) {
    const absSec = Math.abs(seconds);
    const h = Math.floor(absSec / 3600);
    const m = Math.floor((absSec % 3600) / 60);
    const s = absSec % 60;

    if (h > 0) return `${h} jam ${m} menit ${s} detik`;
    if (m > 0) return `${m} menit ${s} detik`;
    return `${s} detik`;
}

function getBreakOverlap(inSec, outSec, breakStartSec, breakEndSec) {
    const start = Math.max(inSec, breakStartSec);
    const end = Math.min(outSec, breakEndSec);
    return Math.max(0, end - start);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTaskDescription(block, header) {
    return block
        .replace(/^\s*\d+\s*/, '')
        .replace(new RegExp(escapeRegExp(header.nama), 'i'), '')
        .replace(new RegExp(escapeRegExp(header.nip), 'g'), '')
        .replace(/\d{2}:\d{2}:\d{2}\s+[A-Z]{2,4}/g, ' ')
        .replace(/\b(?:SABTU|MINGGU|TIDAK\s+CEK\s+(?:OUT|MASUK)|TIDAK\s+MELAKUKAN\s+ABSENSI|ALPA)\b/gi, ' ')
        .replace(/\s+\d{1,2}\s*$/, '')
        .replace(/[.\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Comprehensive PDF Parser & Business Rules Engine
async function parseAbsensiPdf(buffer, filename = '') {
    const parser = new PDFParse(new Uint8Array(buffer));
    const result = await parser.getText();
    const text = result.text;

    // Header extraction
    const namaMatch = text.match(/NAMA\s*:\s*(.+)/i);
    const nipMatch = text.match(/NIP\s*:\s*(.+)/i);
    const bulanMatch = text.match(/BULAN\s*:\s*(.+)/i);
    const tahunMatch = text.match(/TAHUN\s*(20\d\d)/i);
    const instansiMatch = text.match(/DAFTAR ABSENSI BULANAN\s*([\s\S]*?)\s*TAHUN/i);

    const header = {
        filename,
        nama: namaMatch ? namaMatch[1].trim() : 'Pegawai',
        nip: nipMatch ? nipMatch[1].trim() : '-',
        bulan: bulanMatch ? bulanMatch[1].trim() : '-',
        tahun: tahunMatch ? tahunMatch[1].trim() : '-',
        instansi: instansiMatch ? instansiMatch[1].trim().replace(/\n/g, ' ') : 'Instansi'
    };

    // Clean up text by removing repetitive page headers/footers
    let cleanText = text.replace(/Page \d+\/\d+[\s\S]*?-- \d+ of \d+ --/g, '');
    cleanText = cleanText.replace(/No TANGGAL NAMA NIP URAIAN TUGAS[\s\S]*?JAM KODE PIC JAM KODE PIC/g, '');

    // Extract dates (format DD-MM-YYYY)
    const dateRegex = /(\d{2}-\d{2}-\d{4})/g;
    let matches = [];
    let match;
    while ((match = dateRegex.exec(cleanText)) !== null) {
        matches.push({ date: match[1], index: match.index });
    }

    const records = [];
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let i = 0; i < matches.length; i++) {
        const dateStr = matches[i].date;
        const startIndex = matches[i].index + dateStr.length;
        const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : cleanText.length;
        const block = cleanText.substring(startIndex, endIndex).trim();

        const dateObj = dayjs(dateStr, 'DD-MM-YYYY');
        const dayOfWeek = dateObj.day(); // 0 = Sunday, 5 = Friday, 6 = Saturday
        const dayName = dayNames[dayOfWeek];
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        // Strict weekend / holiday detection (Fix: Avoid matching 'mingguan' in activity descriptions)
        const isStandaloneWeekendText = /^\s*(SABTU|MINGGU)\b/i.test(block);
        const isNationalHoliday = /\bLIBUR\s+NASIONAL\b/i.test(block);
        const isLibur = isWeekend || isStandaloneWeekendText || isNationalHoliday;

        // Anomaly & Status keywords
        const isCuti = /CUTI/i.test(block);
        const isIzin = /IZIN/i.test(block);
        const isTidakAbsenKeyword = /TIDAK\s+MELAKUKAN\s+ABSENSI|ALPA/i.test(block);
        const isTidakCekOut = /TIDAK\s+CEK\s+OUT/i.test(block);
        const isTidakCekMasuk = /TIDAK\s+CEK\s+MASUK/i.test(block);

        // Parse check-in and check-out times
        const timeMatches = [...block.matchAll(/(\d{2}:\d{2}:\d{2})\s+([A-Z]{2,4})/g)];
        const hasDlAttendanceCode = timeMatches.some(([, , code]) => code === 'DL');
        const isDL = hasDlAttendanceCode || (timeMatches.length === 0 && /DINAS\s+LUAR|\bDL\b/i.test(block));

        let jamMasuk = null;
        let kodeMasuk = null;
        let jamPulang = null;
        let kodePulang = null;

        if (timeMatches.length >= 2) {
            jamMasuk = timeMatches[0][1];
            kodeMasuk = timeMatches[0][2];
            jamPulang = timeMatches[1][1];
            kodePulang = timeMatches[1][2];
        } else if (timeMatches.length === 1) {
            // Determine if single time is check-in or check-out
            if (isTidakCekMasuk) {
                jamPulang = timeMatches[0][1];
                kodePulang = timeMatches[0][2];
            } else {
                jamMasuk = timeMatches[0][1];
                kodeMasuk = timeMatches[0][2];
            }
        }

        // Calculation Defaults
        let status = 'Libur';
        let statusBadge = 'secondary';
        let lateSec = 0;
        let lateFormatted = '0m 0s';
        let minOutStr = '-';
        let minOutSec = 0;
        let grossSec = 0;
        let breakSec = 0;
        let netSec = 0;
        let targetSec = 27000; // 7 jam 30 menit (450 menit)
        let diffTargetSec = 0;
        let isLate = false;
        let isExcused = false;
        let isAnomaly = false;
        let isShortDuration = false;

        const stdInSec = 27000; // 07:30:00
        let stdOutSec = 57600;  // 16:00:00 (Senin - Kamis)
        let breakStartSec = 43200; // 12:00:00
        let breakEndSec = 46800;   // 13:00:00 (60 menit)

        if (dayOfWeek === 5) { // Jumat
            stdOutSec = 59400;     // 16:30:00
            breakStartSec = 41400; // 11:30:00
            breakEndSec = 46800;   // 13:00:00 (90 menit)
        }

        if (isLibur) {
            status = 'Libur (Akhir Pekan)';
            statusBadge = 'secondary';
        } else if (isCuti) {
            status = 'Cuti';
            statusBadge = 'info';
            isExcused = true;
        } else if (isIzin) {
            status = 'Izin';
            statusBadge = 'info';
            isExcused = true;
        } else if (isDL && !jamMasuk && !jamPulang) {
            status = 'Dinas Luar (DL)';
            statusBadge = 'info';
            isExcused = true;
        } else if (isTidakCekOut || (jamMasuk && !jamPulang && !isDL)) {
            status = 'Tidak Cek Out';
            statusBadge = 'amber';
            isAnomaly = true;
            if (kodeMasuk === 'DL') {
                isExcused = true;
            }
        } else if (isTidakCekMasuk || (!jamMasuk && jamPulang && !isDL)) {
            status = 'Tidak Cek Masuk';
            statusBadge = 'amber';
            isAnomaly = true;
        } else if (!jamMasuk && !jamPulang) {
            status = 'Tidak Melakukan Absensi';
            statusBadge = 'dark-red';
            isAnomaly = true;
        } else { // Valid Check-in & Check-out present
            const inSec = timeToSeconds(jamMasuk);
            const outSec = timeToSeconds(jamPulang);

            // Check if Check-In was DL (Dinas Luar)
            const isInDL = (kodeMasuk === 'DL');
            const isOutDL = (kodePulang === 'DL');

            if (isInDL) {
                // Check-in on DL is official duty outside office
                isLate = false;
                lateSec = 0;
                lateFormatted = 'Dinas Luar (DL)';
            } else if (inSec > stdInSec) {
                isLate = true;
                lateSec = inSec - stdInSec;
                lateFormatted = formatDurationSimple(lateSec);
            }

            // Jam Pulang Wajib Minimal
            minOutSec = stdOutSec + lateSec;
            minOutStr = secondsToTime(minOutSec);

            // Durasi Kerja
            grossSec = Math.max(0, outSec - inSec);
            breakSec = getBreakOverlap(inSec, outSec, breakStartSec, breakEndSec);
            netSec = Math.max(0, grossSec - breakSec);
            diffTargetSec = netSec - targetSec;

            // Short Duration Anomaly Check (< 15 menit)
            if (netSec < 900) {
                isShortDuration = true;
                isAnomaly = true;
            }

            // Evaluasi Jam Pulang
            if (outSec >= minOutSec || isOutDL) {
                status = 'Hadir Utuh';
                statusBadge = 'success';
            } else {
                status = 'Jam Kerja Kurang';
                statusBadge = 'danger';
            }
        }

        records.push({
            tanggal: dateStr,
            hari: dayName,
            uraianTugas: extractTaskDescription(block, header),
            dayOfWeek,
            isWeekend: isLibur,
            isExcused,
            isDL,
            isAnomaly,
            isShortDuration,
            jamMasuk: jamMasuk || '-',
            kodeMasuk: kodeMasuk || '-',
            jamPulang: jamPulang || '-',
            kodePulang: kodePulang || '-',
            isLate,
            lateSec,
            lateFormatted,
            stdInStr: '07:30:00',
            stdOutStr: secondsToTime(stdOutSec),
            minOutStr,
            minOutSec,
            grossFormatted: formatDurationSimple(grossSec),
            breakFormatted: formatDurationSimple(breakSec),
            netSec,
            netFormatted: formatDurationSimple(netSec),
            diffTargetSec,
            diffTargetFormatted: formatDuration(diffTargetSec),
            status,
            statusBadge
        });
    }

    // Summary Statistics
    const workingDays = records.filter(r => !r.isWeekend);
    const hadirUtuhCount = workingDays.filter(r => r.status === 'Hadir Utuh').length;
    const jamKurangCount = workingDays.filter(r => r.status === 'Jam Kerja Kurang').length;
    const tidakMelakukanAbsensiCount = workingDays.filter(r => r.status === 'Tidak Melakukan Absensi').length;
    const tidakCekOutMasukCount = workingDays.filter(r => r.status === 'Tidak Cek Out' || r.status === 'Tidak Cek Masuk').length;
    const izinCutiDlCount = workingDays.filter(r => r.isExcused || r.isDL).length;
    const lateDaysCount = workingDays.filter(r => r.isLate).length;
    const anomalyDaysCount = workingDays.filter(r => r.isAnomaly).length;

    // Evaluated days (excluding excused / unexcused absences)
    const evaluatedDays = workingDays.filter(r => !r.isExcused && r.status !== 'Tidak Melakukan Absensi' && r.status !== 'Tidak Cek Out' && r.status !== 'Tidak Cek Masuk');

    const totalLateSec = workingDays.reduce((acc, r) => acc + r.lateSec, 0);
    const totalNetSec = workingDays.reduce((acc, r) => acc + r.netSec, 0);
    const totalTargetSec = evaluatedDays.length * 27000;
    const totalDiffSec = totalNetSec - totalTargetSec;

    const summary = {
        totalDays: records.length,
        totalWorkingDays: workingDays.length,
        totalWeekendDays: records.length - workingDays.length,
        hadirUtuhCount,
        jamKurangCount,
        tidakMelakukanAbsensiCount,
        tidakCekOutMasukCount,
        izinCutiDlCount,
        lateDaysCount,
        anomalyDaysCount,
        totalLateFormatted: formatDurationSimple(totalLateSec),
        totalNetFormatted: formatDurationSimple(totalNetSec),
        totalTargetFormatted: formatDurationSimple(totalTargetSec),
        totalDiffFormatted: formatDuration(totalDiffSec),
        isTotalNetAchieved: totalDiffSec >= 0
    };

    return {
        header,
        summary,
        records
    };
}

async function extractAttendancePhotos(buffer, dateStr) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const parser = new PDFParse(new Uint8Array(buffer));
    try {
        const textResult = await parser.getText();
        const targetPage = textResult.pages.find(page => page.text.includes(dateStr));
        if (!targetPage) {
            const error = new Error(`Tanggal ${dateStr} tidak ditemukan pada PDF.`);
            error.statusCode = 404;
            throw error;
        }

        const page = await parser.doc.getPage(targetPage.num);
        const textContent = await page.getTextContent();
        const dateItem = textContent.items.find(item => item.str.trim() === dateStr)
            || textContent.items.find(item => item.str.includes(dateStr));
        if (!dateItem) {
            throw new Error(`Posisi tanggal ${dateStr} tidak dapat dibaca dari PDF.`);
        }

        const imagesResult = await parser.getImage({
            partial: [targetPage.num],
            imageThreshold: 200,
            imageDataUrl: true,
            imageBuffer: false
        });
        const images = imagesResult.pages[0]?.images || [];
        const operatorList = await page.getOperatorList();
        const imageOperations = [];
        const imageOps = new Set([
            pdfjs.OPS.paintInlineImageXObject,
            pdfjs.OPS.paintImageXObject
        ]);
        const matrixStack = [];
        let transform = [1, 0, 0, 1, 0, 0];

        for (let index = 0; index < operatorList.fnArray.length; index++) {
            const operation = operatorList.fnArray[index];
            if (operation === pdfjs.OPS.save) {
                matrixStack.push(transform);
                transform = transform.slice();
            } else if (operation === pdfjs.OPS.restore) {
                transform = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
            } else if (operation === pdfjs.OPS.transform) {
                transform = pdfjs.Util.transform(transform, operatorList.argsArray[index]);
            } else if (imageOps.has(operation)) {
                const [, width, height] = operatorList.argsArray[index];
                if (width > 200 && height > 200) {
                    imageOperations.push({
                        x: transform[0] / 2 + transform[2] / 2 + transform[4],
                        y: transform[1] / 2 + transform[3] / 2 + transform[5]
                    });
                }
            }
        }

        if (images.length !== imageOperations.length) {
            throw new Error('Foto PIC tidak dapat dicocokkan dengan posisi di PDF.');
        }

        const picColumnSplitX = page.getViewport({ scale: 1 }).width * 0.87;
        const dayPhotos = images
            .map((image, index) => ({ ...imageOperations[index], dataUrl: image.dataUrl }))
            .filter(image => {
                const closestDate = textContent.items
                    .filter(item => /^\d{2}-\d{2}-\d{4}$/.test(item.str.trim()))
                    .reduce((closest, item) => {
                        const distance = Math.abs(item.transform[5] - image.y);
                        return distance < closest.distance
                            ? { date: item.str.trim(), distance }
                            : closest;
                    }, { date: '', distance: Infinity });
                return closestDate.date === dateStr;
            })
            .sort((first, second) => first.x - second.x)
            .map(image => ({
                label: image.x < picColumnSplitX ? 'Foto PIC Masuk' : 'Foto PIC Pulang',
                dataUrl: image.dataUrl
            }));

        return dayPhotos;
    } finally {
        await parser.destroy();
    }
}

// API Endpoint: PDF Upload & Parse
app.post('/api/upload', upload.array('pdf', 100), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'Tidak ada file PDF yang diunggah.' });
        }

        const results = [];
        for (const file of req.files) {
            try {
                const parsed = await parseAbsensiPdf(file.buffer, file.originalname);
                results.push(parsed);
            } catch (err) {
                console.error(`Error parsing file ${file.originalname}:`, err);
                results.push({
                    header: { filename: file.originalname, nama: file.originalname, nip: '-', bulan: '-', tahun: '-', instansi: 'Error' },
                    error: err.message,
                    summary: { totalWorkingDays: 0, hadirUtuhCount: 0, jamKurangCount: 0, tidakMelakukanAbsensiCount: 0, izinCutiDlCount: 0, totalDiffFormatted: '0s' },
                    records: []
                });
            }
        }

        return res.json({ 
            success: true, 
            count: results.length,
            isBatch: results.length > 1,
            data: results.length === 1 ? results[0] : results,
            allResults: results
        });
    } catch (err) {
        console.error('Error processing PDF batch:', err);
        return res.status(500).json({ success: false, error: 'Gagal memproses file PDF: ' + err.message });
    }
});

app.post('/api/day-photos', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'File PDF tidak ditemukan.' });
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(req.body.tanggal || '')) {
        return res.status(400).json({ success: false, error: 'Format tanggal tidak valid.' });
    }

    try {
        const photos = await extractAttendancePhotos(req.file.buffer, req.body.tanggal);
        return res.json({ success: true, photos });
    } catch (err) {
        console.error(`Error extracting photos for ${req.body.tanggal}:`, err);
        return res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || 'Gagal mengambil foto PIC dari PDF.'
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server Absensi Parser berjalan di http://localhost:${PORT}`);
});
