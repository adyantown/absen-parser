const HOLIDAYS = {
    '17-08-2026': 'Hari Kemerdekaan Republik Indonesia',
    '25-08-2026': 'Maulid Nabi Muhammad SAW',
    '24-12-2026': 'Cuti Bersama Hari Raya Natal',
    '25-12-2026': 'Hari Raya Natal',
    '01-01-2027': 'Tahun Baru Masehi',
};

function getHolidayForDate(date) {
    const name = HOLIDAYS[date];
    return name ? { date, name } : null;
}

function getHolidaysForMonth(year, month) {
    const yearString = String(year);
    const monthString = String(month).padStart(2, '0');
    return Object.entries(HOLIDAYS)
        .filter(([date]) => date.slice(3, 5) === monthString && date.slice(6) === yearString)
        .map(([date, name]) => ({ date, name }));
}

module.exports = { getHolidayForDate, getHolidaysForMonth };
