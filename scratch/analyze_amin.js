const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const buf = fs.readFileSync('./AMIN_NUROHIMKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150545.pdf');
const parser = new PDFParse(new Uint8Array(buf));

parser.getText().then(res => {
    let cleanText = res.text.replace(/Page \d+\/\d+[\s\S]*?-- \d+ of \d+ --/g, '');
    cleanText = cleanText.replace(/No TANGGAL NAMA NIP URAIAN TUGAS[\s\S]*?JAM KODE PIC JAM KODE PIC/g, '');

    const dateRegex = /(\d{2}-\d{2}-\d{4})/g;
    let matches = [];
    let match;
    while ((match = dateRegex.exec(cleanText)) !== null) {
        matches.push({ date: match[1], index: match.index });
    }

    console.log("Found dates:", matches.length);

    for (let i = 0; i < matches.length; i++) {
        const dateStr = matches[i].date;
        const startIndex = matches[i].index + dateStr.length;
        const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : cleanText.length;
        const block = cleanText.substring(startIndex, endIndex).trim().replace(/\s+/g, ' ');

        const timeMatches = [...block.matchAll(/(\d{2}:\d{2}:\d{2})\s+([A-Z]{2,4})/g)];
        const isTidakCekOut = /TIDAK\s+CEK\s+OUT/i.test(block);
        const isTidakCekMasuk = /TIDAK\s+CEK\s+MASUK/i.test(block);
        const isTidakMelakukanAbsensi = /TIDAK\s+MELAKUKAN\s+ABSENSI/i.test(block);

        console.log(`[${dateStr}] Times:`, timeMatches.map(m => `${m[1]} (${m[2]})`), `| TidakCekOut: ${isTidakCekOut} | TidakMelakukanAbsensi: ${isTidakMelakukanAbsensi}`);
        console.log(`   Block text: ${block}`);
    }
});
