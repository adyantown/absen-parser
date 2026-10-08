const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = './ADYANTO_WAHYUDHI_NUGROHOKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150538.pdf';

let dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
    console.log("=== PDF METADATA & INFO ===");
    console.log("Pages:", data.numpages);
    console.log("=== EXTRACTED TEXT ===");
    console.log(data.text);
    fs.writeFileSync('./scratch/pdf_extracted.txt', data.text);
}).catch(err => {
    console.error("PDF parse error:", err);
});
