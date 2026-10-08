const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const buf = fs.readFileSync('./M.FADHIL_AFKARUNAKPU_KABUPATEN_TULANG_BAWANG_BARAT-TAHUN-2026-BULAN-SEPTEMBER-20261005150610.pdf');
const parser = new PDFParse(new Uint8Array(buf));

parser.getText().then(res => {
    console.log("=== RAW TEXT ===");
    console.log(res.text);
    fs.writeFileSync('./scratch/fadhil_pdf_text.txt', res.text);
});
