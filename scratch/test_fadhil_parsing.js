const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const buf = fs.readFileSync('./M.FADHIL_AFKARUNAKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150610.pdf');
const parser = new PDFParse(new Uint8Array(buf));

parser.getText().then(res => {
    const text = res.text;
    let cleanText = text.replace(/Page \d+\/\d+[\s\S]*?-- \d+ of \d+ --/g, '');
    cleanText = cleanText.replace(/No TANGGAL NAMA NIP URAIAN TUGAS[\s\S]*?JAM KODE PIC JAM KODE PIC/g, '');

    const dateRegex = /(\d{2}-\d{2}-\d{4})/g;
    let matches = [];
    let match;
    while ((match = dateRegex.exec(cleanText)) !== null) {
        matches.push({ date: match[1], index: match.index });
    }

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    for (let i = 0; i < matches.length; i++) {
        const dateStr = matches[i].date;
        const startIndex = matches[i].index + dateStr.length;
        const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : cleanText.length;
        const block = cleanText.substring(startIndex, endIndex).trim();

        const dateObj = dayjs(dateStr, 'DD-MM-YYYY');
        const dayOfWeek = dateObj.day();
        const dayName = dayNames[dayOfWeek];
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        // Strict weekend / holiday detection
        // Only consider text holiday if block is literally "SABTU", "MINGGU", or contains "LIBUR NASIONAL"
        const isStandaloneWeekendText = /^\s*(SABTU|MINGGU)\b/i.test(block);
        const isNationalHoliday = /\bLIBUR\s+NASIONAL\b/i.test(block);
        const isLibur = isWeekend || isStandaloneWeekendText || isNationalHoliday;

        console.log(`Date: ${dateStr} (${dayName}) | isWeekend: ${isWeekend} | isLibur: ${isLibur}`);
    }
});
