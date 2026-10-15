const PDFDocument = require('pdfkit');
const path = require('path');

const PAGE_MARGIN = 26;
const FIRST_COLUMN_WIDTH = 170;
const EMPLOYEE_ROW_HEIGHT = 30;
const FOOTER_HEIGHT = 18;
const SIGNATURE_GAP = 14;
const SIGNATURE_BLOCK_HEIGHT = 112;
const MONTH_NAMES = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

function getAttendanceMarks(record) {
    if (record.isHoliday) {
        return { checkIn: 'LIBUR', checkOut: 'LIBUR' };
    }

    if (record.status === 'Libur (Akhir Pekan)') {
        return { checkIn: '-', checkOut: '-' };
    }

    if (record.status === 'Cuti') {
        return { checkIn: record.status.toUpperCase(), checkOut: 'CUTI' };
    }
    if (record.status === 'Sakit') {
        return { checkIn: record.status.toUpperCase(), checkOut: 'SAKIT' };
    }
    if (record.status === 'Izin') {
        return { checkIn: record.status.toUpperCase(), checkOut: 'IZIN' };
    }

    if (record.status === 'Tidak Melakukan Absensi') {
        return { checkIn: 'ALPA', checkOut: 'ALPA' };
    }

    const hasCheckIn = record.jamMasuk && record.jamMasuk !== '-';
    const hasCheckOut = record.jamPulang && record.jamPulang !== '-';
    const getCode = (code, time) => (code && code !== '-' ? code.toUpperCase() : time.slice(0, 5));

    if (!hasCheckIn && !hasCheckOut) {
        return { checkIn: record.status === 'Dinas Luar (DL)' ? 'DL' : '-', checkOut: '-' };
    }

    return {
        checkIn: hasCheckIn ? getCode(record.kodeMasuk, record.jamMasuk) : 'TCM',
        checkOut: hasCheckOut ? getCode(record.kodePulang, record.jamPulang) : 'TCO',
    };
}

function validateAttendanceReport(report) {
    if (!report || typeof report !== 'object') {
        throw new Error('Data rekap absensi tidak valid.');
    }
    if (typeof report.month !== 'string' || !MONTH_NAMES.includes(report.month.trim().toUpperCase())) {
        throw new Error('Bulan rekap absensi tidak valid.');
    }
    if (!Number.isInteger(report.year) || report.year < 2000 || report.year > 2100) {
        throw new Error('Tahun rekap absensi tidak valid.');
    }
    if (!Array.isArray(report.employees) || report.employees.length === 0 || report.employees.length > 100) {
        throw new Error('Data rekap harus berisi 1 sampai 100 pegawai.');
    }
    const expectedMonth = String(MONTH_NAMES.indexOf(report.month.trim().toUpperCase()) + 1).padStart(2, '0');
    const daysInMonth = new Date(Date.UTC(report.year, Number(expectedMonth), 0)).getUTCDate();

    for (const employee of report.employees) {
        if (!employee || typeof employee.name !== 'string' || employee.name.length > 200) {
            throw new Error('Nama pegawai pada data rekap tidak valid.');
        }
        if (typeof employee.nip !== 'string' || employee.nip.length > 40) {
            throw new Error('NIP pegawai pada data rekap tidak valid.');
        }
        if (!Array.isArray(employee.records) || employee.records.length > 31) {
            throw new Error('Data tanggal absensi pegawai tidak valid.');
        }
        for (const record of employee.records) {
            if (!record || !/^\d{2}-\d{2}-\d{4}$/.test(record.tanggal || '') || record.tanggal.slice(3, 5) !== expectedMonth || record.tanggal.slice(6) !== String(report.year) || Number(record.tanggal.slice(0, 2)) > daysInMonth) {
                throw new Error('Tanggal pada data rekap tidak valid.');
            }
        }
    }
}

function drawPageHeader(doc, report, pageNumber, totalPages) {
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const logoPath = path.join(__dirname, 'public', 'kpu_logo.png');
    let y = PAGE_MARGIN;

    doc.image(logoPath, PAGE_MARGIN, y, { fit: [58, 58] });
    doc.font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111111')
        .text('KOMISI PEMILIHAN UMUM', PAGE_MARGIN, y + 2, {
            width: contentWidth,
            align: 'center',
        });
    doc.font('Helvetica-Bold')
        .fontSize(12)
        .text('KABUPATEN TULANG BAWANG BARAT', PAGE_MARGIN, y + 18, {
            width: contentWidth,
            align: 'center',
        });
    doc.font('Helvetica')
        .fontSize(8.5)
        .text('Jalan Kh. Ahmad Dahlan Candra Mukti Kec. Tulang Bawang Tengah', PAGE_MARGIN, y + 36, {
            width: contentWidth,
            align: 'center',
        });
    doc.text('Kabupaten Tulang Bawang Barat', PAGE_MARGIN, y + 47, {
        width: contentWidth,
        align: 'center',
    });
    doc.font('Helvetica')
        .fontSize(7.5)
        .text('Telp: -    Email: kab_tulang bawang barat@kpu.go.id', PAGE_MARGIN, y + 57, {
            width: contentWidth,
            align: 'center',
        });

    y += 71;
    doc.lineWidth(3)
        .moveTo(PAGE_MARGIN, y)
        .lineTo(pageWidth - PAGE_MARGIN, y)
        .stroke('#111111');

    y += 15;

    if (pageNumber === 1) {
        doc.font('Helvetica-Bold').fontSize(11).text('REKAPITULASI KEHADIRAN PEGAWAI', PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center',
        });
        y += 15;
        doc.font('Helvetica-Bold').fontSize(9).text(`BULAN ${report.month.toUpperCase()} TAHUN ${report.year}`, PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center',
        });
        y += 15;
        doc.font('Helvetica').fontSize(7).fillColor('#333333').text('Atas: Check-in  |  Bawah: Check-out  |  TCO: Tidak Check-out  |  ALPA: Tidak melakukan absensi  |  DL: Dinas Luar ', PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center',
        });
        y += 17;
        if (report.holidayNotes?.length) {
            const holidayNotes = report.holidayNotes.map(({ date, name }) => `${date}: ${name}`).join('  |  ');
            doc.font('Helvetica').fontSize(7).fillColor('#333333').text(`Hari libur: ${holidayNotes}`, PAGE_MARGIN, y, {
                width: contentWidth,
                align: 'center',
                lineBreak: false,
            });
            y += 10;
        }
    } else {
        doc.font('Helvetica-Bold').fontSize(9).text(`REKAPITULASI KEHADIRAN — ${report.month.toUpperCase()} ${report.year} (LANJUTAN)`, PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center',
        });
        y += 23;
    }

    return y;
}

function drawPageFooter(doc, pageNumber, totalPages) {
    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    doc.font('Helvetica')
        .fontSize(7)
        .fillColor('#333333')
        .text(`Halaman ${pageNumber} dari ${totalPages}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN - 20, {
            width: contentWidth,
            align: 'right',
            lineBreak: false,
        });
}

function drawSignature(doc, y, date) {
    const width = 260;
    const x = doc.page.width - PAGE_MARGIN - width;
    const month = MONTH_NAMES[date.getMonth()];
    const formattedMonth = `${month[0]}${month.slice(1).toLowerCase()}`;

    doc.font('Helvetica').fontSize(8).fillColor('#111111').text(`Candra Mukti, ${date.getDate()} ${formattedMonth} ${date.getFullYear()}`, x, y, {
        width,
        align: 'center',
        lineBreak: false,
    });
    doc.font('Helvetica')
        .fontSize(8)
        .text('Plt. Sekretaris Komisi Pemilihan Umum', x, y + 14, {
            width,
            align: 'center',
            lineBreak: false,
        });
    doc.text('Kabupaten Tulang Bawang Barat', x, y + 26, {
        width,
        align: 'center',
        lineBreak: false,
    });
    doc.text('Selaku Penyelenggara SPIP', x, y + 38, {
        width,
        align: 'center',
        lineBreak: false,
    });
    doc.font('Helvetica-Bold')
        .fontSize(8)
        .text('Wahyu Ari Bowo', x, y + 87, {
            width,
            align: 'center',
            lineBreak: false,
        });
    doc.font('Helvetica')
        .fontSize(8)
        .text('NIP. 19861130 201012 1 001', x, y + 99, {
            width,
            align: 'center',
            lineBreak: false,
        });
}

function drawTableHeader(doc, report, y, dayCount) {
    const tableX = PAGE_MARGIN;
    const tableWidth = doc.page.width - PAGE_MARGIN * 2;
    const dayWidth = (tableWidth - FIRST_COLUMN_WIDTH) / dayCount;
    const headerHeight = 20;

    doc.save();
    doc.rect(tableX, y, tableWidth, headerHeight).fill('#e9eef5');
    doc.restore();
    doc.rect(tableX, y, tableWidth, headerHeight).lineWidth(0.6).stroke('#333333');

    doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#111111')
        .text('NAMA PEGAWAI', tableX + 4, y + 7, {
            width: FIRST_COLUMN_WIDTH - 8,
            align: 'left',
            lineBreak: false,
        });
    doc.font('Helvetica-Bold').fontSize(dayCount > 28 ? 6 : 7);

    for (let day = 1; day <= dayCount; day++) {
        const x = tableX + FIRST_COLUMN_WIDTH + (day - 1) * dayWidth;
        doc.moveTo(x, y)
            .lineTo(x, y + headerHeight)
            .lineWidth(0.3)
            .stroke('#777777');
        doc.text(String(day), x, y + 7, {
            width: dayWidth,
            align: 'center',
            lineBreak: false,
        });
    }

    const firstDayDivider = tableX + FIRST_COLUMN_WIDTH;
    doc.moveTo(firstDayDivider, y)
        .lineTo(firstDayDivider, y + headerHeight)
        .lineWidth(0.7)
        .stroke('#333333');
    return { tableX, tableWidth, dayWidth, nextY: y + headerHeight };
}

function drawEmployeeRow(doc, employee, recordsByDay, geometry, y, dayCount) {
    const { tableX, tableWidth, dayWidth } = geometry;
    const rowHeight = EMPLOYEE_ROW_HEIGHT;
    const halfHeight = rowHeight / 2;

    doc.rect(tableX, y, tableWidth, rowHeight).lineWidth(0.45).stroke('#666666');
    doc.moveTo(tableX, y + halfHeight)
        .lineTo(tableX + tableWidth, y + halfHeight)
        .lineWidth(0.3)
        .stroke('#999999');
    doc.moveTo(tableX + FIRST_COLUMN_WIDTH, y)
        .lineTo(tableX + FIRST_COLUMN_WIDTH, y + rowHeight)
        .lineWidth(0.7)
        .stroke('#666666');

    doc.font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#111111')
        .text(employee.name, tableX + 4, y + 8, {
            width: FIRST_COLUMN_WIDTH - 8,
            height: 10,
            ellipsis: true,
            lineBreak: false,
        });
    doc.font('Helvetica')
        .fontSize(6)
        .fillColor('#555555')
        .text(`NIP: ${employee.nip}`, tableX + 4, y + 21, {
            width: FIRST_COLUMN_WIDTH - 8,
            height: 8,
            ellipsis: true,
            lineBreak: false,
        });

    for (let day = 1; day <= dayCount; day++) {
        const x = tableX + FIRST_COLUMN_WIDTH + (day - 1) * dayWidth;
        const record = recordsByDay.get(day);
        const marks = record ? getAttendanceMarks(record) : { checkIn: '-', checkOut: '-' };
        const isWeekend = record?.isWeekend;

        if (isWeekend) {
            doc.save();
            doc.rect(x + 0.3, y + 0.3, dayWidth - 0.6, rowHeight - 0.6).fill('#f3f4f6');
            doc.restore();
        }

        doc.moveTo(x, y)
            .lineTo(x, y + rowHeight)
            .lineWidth(0.25)
            .stroke('#aaaaaa');
        doc.font('Helvetica')
            .fontSize(dayCount > 28 ? 5.3 : 6)
            .fillColor(getMarkColor(marks.checkIn))
            .text(marks.checkIn, x + 0.5, y + 3.5, {
                width: dayWidth - 1,
                align: 'center',
                lineBreak: false,
                ellipsis: true,
            });
        doc.font('Helvetica')
            .fontSize(dayCount > 28 ? 5.3 : 6)
            .fillColor(getMarkColor(marks.checkOut))
            .text(marks.checkOut, x + 0.5, y + halfHeight + 3.5, {
                width: dayWidth - 1,
                align: 'center',
                lineBreak: false,
                ellipsis: true,
            });
    }
}

function getMarkColor(mark) {
    if (mark === 'ALPA') return '#b91c1c';
    if (mark === 'WFH') return '#047857';
    if (mark === 'LIBUR') return '#ff0000';
    if (mark === 'TCO' || mark === 'TCM') return '#b45309';
    if (['SAKIT', 'CUTI', 'IZIN', 'DL'].includes(mark)) return '#6d28d9';
    return '#111827';
}

async function createAttendanceReport(report) {
    validateAttendanceReport(report);

    const month = report.month.trim().toUpperCase();
    const monthIndex = MONTH_NAMES.indexOf(month);
    const dayCount = new Date(Date.UTC(report.year, monthIndex + 1, 0)).getUTCDate();
    const employees = report.employees.map((employee) => ({
        name: employee.name.trim(),
        nip: employee.nip.trim(),
        recordsByDay: new Map(employee.records.map((record) => [Number(record.tanggal.slice(0, 2)), record])),
    }));
    const holidayNotes = [...new Map(report.employees.flatMap((employee) => employee.records.filter((record) => record.isHoliday && record.holidayName).map((record) => [record.tanggal, { date: record.tanggal, name: record.holidayName }]))).values()].sort((a, b) => Number(a.date.slice(0, 2)) - Number(b.date.slice(0, 2)));
    const availableHeight = 842 - PAGE_MARGIN * 2 - FOOTER_HEIGHT;
    const firstPageHeaderExtra = holidayNotes.length > 0 ? 10 : 0;
    const firstPageRows = Math.floor((availableHeight - 145 - 20 - firstPageHeaderExtra) / EMPLOYEE_ROW_HEIGHT);
    const followingPageRows = Math.floor((availableHeight - 108 - 20) / EMPLOYEE_ROW_HEIGHT);
    const lastFirstPageRows = Math.floor((availableHeight - 145 - 20 - firstPageHeaderExtra - SIGNATURE_GAP - SIGNATURE_BLOCK_HEIGHT) / EMPLOYEE_ROW_HEIGHT);
    const lastFollowingPageRows = Math.floor((availableHeight - 108 - 20 - SIGNATURE_GAP - SIGNATURE_BLOCK_HEIGHT) / EMPLOYEE_ROW_HEIGHT);
    const pageCapacities = [];

    for (let pageCount = 1; ; pageCount++) {
        const capacity = pageCount === 1 ? lastFirstPageRows : firstPageRows + (pageCount - 2) * followingPageRows + lastFollowingPageRows;
        if (employees.length <= capacity) {
            if (pageCount === 1) {
                pageCapacities.push(lastFirstPageRows);
            } else {
                pageCapacities.push(firstPageRows);
                for (let page = 1; page < pageCount - 1; page++) {
                    pageCapacities.push(followingPageRows);
                }
                pageCapacities.push(lastFollowingPageRows);
            }
            break;
        }
    }

    let remainingEmployees = employees.length;
    const pageRowCounts = pageCapacities.map((capacity, index) => {
        const pagesRemaining = pageCapacities.length - index;
        const futureCapacity = pageCapacities.slice(index + 1).reduce((total, rows) => total + rows, 0);
        const minimumRows = Math.max(1, remainingEmployees - futureCapacity);
        const balancedRows = Math.ceil(remainingEmployees / pagesRemaining);
        const rows = Math.min(capacity, Math.max(minimumRows, balancedRows));
        remainingEmployees -= rows;
        return rows;
    });
    const totalPages = pageRowCounts.length;
    const generatedAt = new Date();

    const doc = new PDFDocument({
        size: 'A3',
        layout: 'landscape',
        margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
        compress: true,
        info: {
            Title: `Rekapitulasi Kehadiran ${month} ${report.year}`,
            Author: 'KPU Kabupaten Tulang Bawang Barat',
            Subject: 'Rekapitulasi status check-in dan check-out pegawai',
        },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    let employeeIndex = 0;
    let pageNumber = 1;
    while (employeeIndex < employees.length) {
        if (pageNumber > 1) doc.addPage();
        const startY = drawPageHeader(doc, { month, year: report.year, holidayNotes }, pageNumber, totalPages);
        const geometry = drawTableHeader(doc, report, startY, dayCount);
        const endIndex = Math.min(employees.length, employeeIndex + pageRowCounts[pageNumber - 1]);

        while (employeeIndex < endIndex) {
            const employee = employees[employeeIndex];
            drawEmployeeRow(doc, employee, employee.recordsByDay, geometry, geometry.nextY, dayCount);
            geometry.nextY += EMPLOYEE_ROW_HEIGHT;
            employeeIndex++;
        }
        if (pageNumber === totalPages) {
            drawSignature(doc, geometry.nextY + SIGNATURE_GAP, generatedAt);
        }
        drawPageFooter(doc, pageNumber, totalPages);
        pageNumber++;
    }

    doc.end();
    return completed;
}

module.exports = { createAttendanceReport, getAttendanceMarks, validateAttendanceReport };
