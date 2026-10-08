const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const buf = fs.readFileSync('./ADYANTO_WAHYUDHI_NUGROHOKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150538.pdf');
const parser = new PDFParse(new Uint8Array(buf));

parser.getText().then(res => {
    const text = res.text;

    // Header extraction
    const namaMatch = text.match(/NAMA\s*:\s*(.+)/i);
    const nipMatch = text.match(/NIP\s*:\s*(.+)/i);
    const bulanMatch = text.match(/BULAN\s*:\s*(.+)/i);
    const tahunMatch = text.match(/TAHUN\s*(20\d\d)/i);
    const instansiMatch = text.match(/DAFTAR ABSENSI BULANAN\s*([\s\S]*?)\s*TAHUN/i);

    const header = {
        nama: namaMatch ? namaMatch[1].trim() : '',
        nip: nipMatch ? nipMatch[1].trim() : '',
        bulan: bulanMatch ? bulanMatch[1].trim() : '',
        tahun: tahunMatch ? tahunMatch[1].trim() : '',
        instansi: instansiMatch ? instansiMatch[1].trim().replace(/\n/g, ' ') : ''
    };

    console.log("Header:", header);

    // Clean up repeating headers/footers in text
    let cleanText = text.replace(/Page \d+\/\d+[\s\S]*?-- \d+ of \d+ --/g, '');
    cleanText = cleanText.replace(/No TANGGAL NAMA NIP URAIAN TUGAS[\s\S]*?JAM KODE PIC JAM KODE PIC/g, '');

    // Match dates DD-MM-YYYY
    const dateRegex = /(\d{2}-\d{2}-\d{4})/g;
    let matches = [];
    let match;
    while ((match = dateRegex.exec(cleanText)) !== null) {
        matches.push({ date: match[1], index: match.index });
    }

    const records = [];

    for (let i = 0; i < matches.length; i++) {
        const dateStr = matches[i].date;
        const startIndex = matches[i].index + dateStr.length;
        const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : cleanText.length;
        const block = cleanText.substring(startIndex, endIndex).trim();

        // Extract times and status codes
        // Format example: 07:11:56 WFO 16:14:34 WFO or SABTU or MINGGU
        const isSabtu = /SABTU/i.test(block);
        const isMinggu = /MINGGU/i.test(block);

        // Find all time patterns HH:mm:ss
        const timeMatches = [...block.matchAll(/(\d{2}:\d{2}:\d{2})\s+([A-Z]{3,4})/g)];

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
            jamMasuk = timeMatches[0][1];
            kodeMasuk = timeMatches[0][2];
        }

        records.push({
            tanggal: dateStr,
            isSabtu,
            isMinggu,
            jamMasuk,
            kodeMasuk,
            jamPulang,
            kodePulang,
            rawBlock: block.replace(/\s+/g, ' ')
        });
    }

    console.log(`Parsed ${records.length} date records:`);
    console.table(records);
});
