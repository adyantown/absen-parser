document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const fileNameDisplay = document.getElementById('fileName');
    const uploadSection = document.getElementById('uploadSection');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loadingText = document.getElementById('loadingText');
    const resultsSection = document.getElementById('resultsSection');
    const btnNewUpload = document.getElementById('btnNewUpload');

    // Batch Selector DOM
    const batchSelectorBar = document.getElementById('batchSelectorBar');
    const employeeSelect = document.getElementById('employeeSelect');

    // Profile DOM
    const profileCard = document.getElementById('profileCard');
    const empNama = document.getElementById('empNama');
    const empNip = document.getElementById('empNip');
    const empPeriode = document.getElementById('empPeriode');
    const empInstansi = document.getElementById('empInstansi');

    // KPI DOM
    const kpiWorkingDays = document.getElementById('kpiWorkingDays');
    const kpiHadirUtuh = document.getElementById('kpiHadirUtuh');
    const kpiHadirUtuhPct = document.getElementById('kpiHadirUtuhPct');
    const kpiJamKurang = document.getElementById('kpiJamKurang');
    const kpiJamKurangPct = document.getElementById('kpiJamKurangPct');
    const kpiTidakAbsen = document.getElementById('kpiTidakAbsen');
    const kpiTotalLateDays = document.getElementById('kpiTotalLateDays');
    const kpiTotalLateMinutes = document.getElementById('kpiTotalLateMinutes');
    const kpiTotalDiff = document.getElementById('kpiTotalDiff');
    const kpiTotalDiffStatus = document.getElementById('kpiTotalDiffStatus');

    // Table DOM
    const tableTitle = document.getElementById('tableTitle');
    const tableHead = document.getElementById('tableHead');
    const searchInput = document.getElementById('searchInput');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const filterTabsContainer = document.getElementById('filterTabsContainer');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const btnExportCsv = document.getElementById('btnExportCsv');

    // Tab counts
    const countAll = document.getElementById('countAll');
    const countHadir = document.getElementById('countHadir');
    const countKurang = document.getElementById('countKurang');
    const countTidakAbsen = document.getElementById('countTidakAbsen');
    const countNoCheckout = document.getElementById('countNoCheckout');
    const countLate = document.getElementById('countLate');
    const countExcused = document.getElementById('countExcused');
    const countWeekend = document.getElementById('countWeekend');

    // Modal DOM
    const detailModal = document.getElementById('detailModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    // Global State
    let allParsedData = []; // Array of employee objects
    let selectedIndex = 0;  // Index of selected employee
    let isBatchMode = false;
    let viewMode = 'single'; // 'single' or 'batch_rekap'
    let activeFilter = 'all';
    let searchQuery = '';

    // Drag & Drop Handlers
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileUpload(files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files);
        }
    });

    btnNewUpload.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        dropzone.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        btnNewUpload.classList.add('hidden');
        fileInput.value = '';
        selectedFileInfo.style.display = 'none';
        allParsedData = [];
    });

    // Handle Upload Call
    async function handleFileUpload(fileList) {
        const files = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (files.length === 0) {
            alert('Silakan pilih setidaknya satu file PDF.');
            return;
        }

        fileNameDisplay.textContent = files.length === 1 ? files[0].name : `${files.length} File PDF Dipilih (Batch Processing)`;
        selectedFileInfo.style.display = 'inline-flex';

        dropzone.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        loadingText.textContent = `Memproses ${files.length} file PDF absensi...`;

        const formData = new FormData();
        files.forEach(f => formData.append('pdf', f));

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                allParsedData = Array.isArray(result.data) ? result.data : [result.data];
                isBatchMode = allParsedData.length > 1;

                setupBatchSelector();

                if (isBatchMode) {
                    switchToBatchRekapView();
                } else {
                    switchToEmployeeView(0);
                }

                uploadSection.classList.add('hidden');
                resultsSection.classList.remove('hidden');
                btnNewUpload.classList.remove('hidden');
            } else {
                alert('Gagal memproses PDF: ' + (result.error || 'Terjadi kesalahan'));
                dropzone.classList.remove('hidden');
                loadingSpinner.classList.add('hidden');
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Gagal mengirim file ke server.');
            dropzone.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
        }
    }

    // Setup Batch Dropdown
    function setupBatchSelector() {
        if (!isBatchMode) {
            batchSelectorBar.classList.add('hidden');
            return;
        }

        batchSelectorBar.classList.remove('hidden');
        employeeSelect.innerHTML = '<option value="summary_all">-- Rekapitulasi Semua Pegawai (Batch Summary) --</option>';

        allParsedData.forEach((item, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${idx + 1}. ${item.header.nama} (NIP: ${item.header.nip})`;
            employeeSelect.appendChild(opt);
        });
    }

    employeeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'summary_all') {
            switchToBatchRekapView();
        } else {
            switchToEmployeeView(parseInt(val, 10));
        }
    });

    // View: Single Employee
    function switchToEmployeeView(index) {
        viewMode = 'single';
        selectedIndex = index;
        const data = allParsedData[index];

        profileCard.classList.remove('hidden');
        filterTabsContainer.classList.remove('hidden');
        tableTitle.innerHTML = `<i class="fa-solid fa-list-check"></i> Detail Absensi & Pemenuhan Jam Kerja - ${data.header.nama}`;

        renderEmployeeProfile(data.header);
        renderSummaryKpis(data.summary);
        renderTabCounts(data.records, data.summary);
        renderSingleEmployeeTableHead();
        renderTable(data.records);
    }

    // View: Batch Rekapitulasi Summary
    function switchToBatchRekapView() {
        viewMode = 'batch_rekap';
        profileCard.classList.add('hidden');
        filterTabsContainer.classList.add('hidden');
        tableTitle.innerHTML = `<i class="fa-solid fa-users"></i> Rekapitulasi Jam Kerja & Kehadiran Pegawai (${allParsedData.length} Pegawai)`;

        // Calculate Overall Batch KPIs
        const totalWorkingDays = allParsedData.reduce((acc, d) => acc + (d.summary ? d.summary.totalWorkingDays : 0), 0);
        const totalHadirUtuh = allParsedData.reduce((acc, d) => acc + (d.summary ? d.summary.hadirUtuhCount : 0), 0);
        const totalJamKurang = allParsedData.reduce((acc, d) => acc + (d.summary ? d.summary.jamKurangCount : 0), 0);
        const totalTidakAbsen = allParsedData.reduce((acc, d) => acc + (d.summary ? d.summary.tidakMelakukanAbsensiCount : 0), 0);
        const totalLateDays = allParsedData.reduce((acc, d) => acc + (d.summary ? d.summary.lateDaysCount : 0), 0);

        kpiWorkingDays.textContent = totalWorkingDays;
        kpiHadirUtuh.textContent = totalHadirUtuh;
        kpiHadirUtuhPct.textContent = totalWorkingDays > 0 ? `${Math.round((totalHadirUtuh / totalWorkingDays) * 100)}% dari total` : '0%';
        kpiJamKurang.textContent = totalJamKurang;
        kpiJamKurangPct.textContent = totalWorkingDays > 0 ? `${Math.round((totalJamKurang / totalWorkingDays) * 100)}% dari total` : '0%';
        kpiTidakAbsen.textContent = totalTidakAbsen;
        kpiTotalLateDays.textContent = `${totalLateDays} Hari`;
        kpiTotalLateMinutes.textContent = `Total Keterlambatan`;

        kpiTotalDiff.textContent = `${allParsedData.length} Pegawai`;
        kpiTotalDiff.className = 'text-green';
        kpiTotalDiffStatus.textContent = 'Batch Processed';

        renderBatchRekapTableHead();
        renderBatchRekapTableBody();
    }

    // Render Employee Profile Card
    function renderEmployeeProfile(header) {
        empNama.textContent = header.nama;
        empNip.textContent = header.nip;
        empPeriode.textContent = `${header.bulan} ${header.tahun}`;
        empInstansi.textContent = header.instansi;
    }

    // Render Summary KPIs
    function renderSummaryKpis(summary) {
        kpiWorkingDays.textContent = summary.totalWorkingDays;
        kpiHadirUtuh.textContent = summary.hadirUtuhCount;
        
        const hadirPct = summary.totalWorkingDays > 0 ? Math.round((summary.hadirUtuhCount / summary.totalWorkingDays) * 100) : 0;
        kpiHadirUtuhPct.textContent = `${hadirPct}% dari hari kerja`;

        kpiJamKurang.textContent = summary.jamKurangCount;
        const kurangPct = summary.totalWorkingDays > 0 ? Math.round((summary.jamKurangCount / summary.totalWorkingDays) * 100) : 0;
        kpiJamKurangPct.textContent = `${kurangPct}% dari hari kerja`;

        kpiTidakAbsen.textContent = summary.tidakMelakukanAbsensiCount;

        kpiTotalLateDays.textContent = `${summary.lateDaysCount} Hari`;
        kpiTotalLateMinutes.textContent = `Total: ${summary.totalLateFormatted}`;

        kpiTotalDiff.textContent = summary.totalDiffFormatted;
        if (summary.isTotalNetAchieved) {
            kpiTotalDiff.className = 'text-green';
            kpiTotalDiffStatus.textContent = 'Memenuhi Target Jam Kerja';
        } else {
            kpiTotalDiff.className = 'text-red';
            kpiTotalDiffStatus.textContent = 'Kurang dari Target Jam Kerja';
        }
    }

    // Render Tab Counts
    function renderTabCounts(records, summary) {
        countAll.textContent = records.length;
        countHadir.textContent = summary.hadirUtuhCount;
        countKurang.textContent = summary.jamKurangCount;
        countTidakAbsen.textContent = summary.tidakMelakukanAbsensiCount;
        countNoCheckout.textContent = summary.tidakCekOutMasukCount || 0;
        countLate.textContent = summary.lateDaysCount;
        countExcused.textContent = summary.izinCutiDlCount;
        countWeekend.textContent = summary.totalWeekendDays;
    }

    // Table Headers
    function renderSingleEmployeeTableHead() {
        tableHead.innerHTML = `
            <tr>
                <th>Tanggal & Hari</th>
                <th>Jam Masuk</th>
                <th>Jam Pulang</th>
                <th>Status Keterlambatan</th>
                <th>Pulang Wajib Min.</th>
                <th>Net Durasi Kerja</th>
                <th>Status Kehadiran</th>
                <th class="text-center">Aksi</th>
            </tr>
        `;
    }

    function renderBatchRekapTableHead() {
        tableHead.innerHTML = `
            <tr>
                <th>Nama Pegawai</th>
                <th>NIP</th>
                <th>Hari Kerja</th>
                <th>Hadir Utuh</th>
                <th>Jam Kurang</th>
                <th>Tidak Absen</th>
                <th>Tdk Cek Out/Msk</th>
                <th>Terlambat</th>
                <th>Izin/Cuti/DL</th>
                <th>Akumulasi Selisih</th>
                <th class="text-center">Detail</th>
            </tr>
        `;
    }

    // Single Employee Table Body
    function renderTable(records) {
        attendanceTableBody.innerHTML = '';

        const filtered = records.filter(r => {
            if (activeFilter === 'Hadir Utuh' && r.status !== 'Hadir Utuh') return false;
            if (activeFilter === 'Jam Kerja Kurang' && r.status !== 'Jam Kerja Kurang') return false;
            if (activeFilter === 'Tidak Melakukan Absensi' && r.status !== 'Tidak Melakukan Absensi') return false;
            if (activeFilter === 'Tidak Cek Out/Masuk' && (r.status !== 'Tidak Cek Out' && r.status !== 'Tidak Cek Masuk')) return false;
            if (activeFilter === 'Terlambat' && !r.isLate) return false;
            if (activeFilter === 'Izin/Cuti/DL' && !r.isExcused && !r.isDL) return false;
            if (activeFilter === 'Libur' && !r.isWeekend) return false;

            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const textStr = `${r.tanggal} ${r.hari} ${r.status} ${r.jamMasuk} ${r.jamPulang}`.toLowerCase();
                if (!textStr.includes(q)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            attendanceTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 32px; color: var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px;"></i><br>
                        Tidak ada data yang sesuai dengan filter.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach((r) => {
            const tr = document.createElement('tr');
            if (r.isWeekend) tr.classList.add('row-weekend');

            const kodeMasukBadge = r.kodeMasuk !== '-' ? `<span class="code-tag ${r.kodeMasuk === 'WFO' ? 'code-wfo' : 'code-wfh'}">${r.kodeMasuk}</span>` : '';
            const kodePulangBadge = r.kodePulang !== '-' ? `<span class="code-tag ${r.kodePulang === 'WFO' ? 'code-wfo' : 'code-wfh'}">${r.kodePulang}</span>` : '';

            let lateBadge = `<span class="badge badge-secondary">Tepat Waktu</span>`;
            if (r.kodeMasuk === 'DL') {
                lateBadge = `<span class="badge badge-info"><i class="fa-solid fa-briefcase"></i> Dinas Luar (DL)</span>`;
            } else if (r.isLate) {
                lateBadge = `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Terlambat ${r.lateFormatted}</span>`;
            } else if (r.isWeekend || r.isExcused || r.isAnomaly) {
                lateBadge = `<span class="badge badge-secondary">-</span>`;
            }

            let statusBadge = `<span class="badge badge-${r.statusBadge}">${r.status}</span>`;
            if (r.isShortDuration) {
                statusBadge += ` <span class="badge badge-warning" title="Durasi absensi sangat singkat (< 15 menit)"><i class="fa-solid fa-triangle-exclamation"></i> Durasi Singkat</span>`;
            }

            tr.innerHTML = `
                <td>
                    <strong>${r.tanggal}</strong><br>
                    <small style="color: var(--text-muted);">${r.hari}</small>
                </td>
                <td>${r.jamMasuk} ${kodeMasukBadge}</td>
                <td>${r.jamPulang} ${kodePulangBadge}</td>
                <td>${lateBadge}</td>
                <td><strong>${r.minOutStr}</strong></td>
                <td>
                    <strong>${r.netFormatted}</strong><br>
                    <small class="${r.diffTargetSec >= 0 ? 'text-green' : 'text-red'}">${r.diffTargetFormatted}</small>
                </td>
                <td>${statusBadge}</td>
                <td class="text-center">
                    <button class="btn-icon btn-detail" data-date="${r.tanggal}" title="Lihat Detail Rincian">
                        <i class="fa-solid fa-circle-info"></i>
                    </button>
                </td>
            `;

            attendanceTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateStr = btn.getAttribute('data-date');
                const rec = allParsedData[selectedIndex].records.find(item => item.tanggal === dateStr);
                if (rec) showDetailModal(rec);
            });
        });
    }

    // Batch Rekap Table Body
    function renderBatchRekapTableBody() {
        attendanceTableBody.innerHTML = '';

        const filtered = allParsedData.filter(d => {
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const textStr = `${d.header.nama} ${d.header.nip} ${d.header.bulan}`.toLowerCase();
                if (!textStr.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            attendanceTableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center" style="padding: 32px; color: var(--text-muted);">
                        Tidak ada data pegawai yang sesuai.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach((d, idx) => {
            const tr = document.createElement('tr');
            const sum = d.summary || {};

            tr.innerHTML = `
                <td><strong>${d.header.nama}</strong></td>
                <td>${d.header.nip}</td>
                <td>${sum.totalWorkingDays || 0}</td>
                <td><span class="badge badge-success">${sum.hadirUtuhCount || 0}</span></td>
                <td><span class="badge badge-danger">${sum.jamKurangCount || 0}</span></td>
                <td><span class="badge badge-dark-red">${sum.tidakMelakukanAbsensiCount || 0}</span></td>
                <td><span class="badge badge-warning">${sum.tidakCekOutMasukCount || 0}</span></td>
                <td><span class="badge badge-warning">${sum.lateDaysCount || 0}</span></td>
                <td><span class="badge badge-info">${sum.izinCutiDlCount || 0}</span></td>
                <td><strong class="${sum.isTotalNetAchieved ? 'text-green' : 'text-red'}">${sum.totalDiffFormatted || '0s'}</strong></td>
                <td class="text-center">
                    <button class="btn-icon btn-view-emp" data-idx="${idx}" title="Buka Detail Pegawai Ini">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </td>
            `;

            attendanceTableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-view-emp').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                employeeSelect.value = idx;
                switchToEmployeeView(idx);
            });
        });
    }

    // Modal Calculation Details
    function showDetailModal(r) {
        modalTitle.innerHTML = `<i class="fa-solid fa-calculator"></i> Detail Perhitungan (${r.tanggal} - ${r.hari})`;

        modalBody.innerHTML = `
            <div class="detail-list">
                <div class="detail-item">
                    <span>Tanggal & Hari:</span>
                    <span>${r.tanggal} (${r.hari})</span>
                </div>
                <div class="detail-item">
                    <span>Jam Masuk Standar:</span>
                    <span>07:30:00</span>
                </div>
                <div class="detail-item">
                    <span>Jam Masuk Aktual:</span>
                    <span>${r.jamMasuk} ${r.kodeMasuk !== '-' ? '(' + r.kodeMasuk + ')' : ''}</span>
                </div>
                <div class="detail-item">
                    <span>Durasi Keterlambatan:</span>
                    <span class="${r.isLate ? 'text-amber' : 'text-green'}">${r.lateFormatted}</span>
                </div>
                <div class="detail-item">
                    <span>Jam Pulang Standar:</span>
                    <span>${r.stdOutStr}</span>
                </div>
                <div class="detail-item">
                    <span>Jam Pulang Wajib Minimal (+Hutang Waktu):</span>
                    <span style="color: var(--kpu-red); font-weight: 700;">${r.minOutStr}</span>
                </div>
                <div class="detail-item">
                    <span>Jam Pulang Aktual:</span>
                    <span>${r.jamPulang} ${r.kodePulang !== '-' ? '(' + r.kodePulang + ')' : ''}</span>
                </div>
                <div class="detail-item">
                    <span>Potongan Istirahat Otomatis:</span>
                    <span>${r.breakFormatted}</span>
                </div>
                <div class="detail-item">
                    <span>Durasi Kerja Net (Efektif):</span>
                    <span style="font-weight: 700;">${r.netFormatted}</span>
                </div>
                <div class="detail-item">
                    <span>Selisih vs Target (7j 30m):</span>
                    <span class="${r.diffTargetSec >= 0 ? 'text-green' : 'text-red'}">${r.diffTargetFormatted}</span>
                </div>
                <div class="detail-item">
                    <span>Status Akhir Kehadiran:</span>
                    <span class="badge badge-${r.statusBadge}">${r.status}</span>
                </div>
            </div>
        `;

        detailModal.classList.remove('hidden');
    }

    btnCloseModal.addEventListener('click', () => {
        detailModal.classList.add('hidden');
    });

    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) detailModal.classList.add('hidden');
    });

    // Filter Tab Clicks
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            if (viewMode === 'single' && allParsedData[selectedIndex]) {
                renderTable(allParsedData[selectedIndex].records);
            }
        });
    });

    // Search Input Event
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (viewMode === 'single' && allParsedData[selectedIndex]) {
            renderTable(allParsedData[selectedIndex].records);
        } else if (viewMode === 'batch_rekap') {
            renderBatchRekapTableBody();
        }
    });

    // Export CSV
    btnExportCsv.addEventListener('click', () => {
        if (allParsedData.length === 0) return;

        if (viewMode === 'batch_rekap') {
            let csv = 'Nama Pegawai,NIP,Bulan,Tahun,Hari Kerja,Hadir Utuh,Jam Kurang,Tidak Absen,Tidak Cek Out/Masuk,Terlambat,Izin Cuti DL,Selisih Jam Kerja\n';
            allParsedData.forEach(d => {
                const s = d.summary || {};
                csv += `"${d.header.nama}","${d.header.nip}","${d.header.bulan}","${d.header.tahun}","${s.totalWorkingDays || 0}","${s.hadirUtuhCount || 0}","${s.jamKurangCount || 0}","${s.tidakMelakukanAbsensiCount || 0}","${s.tidakCekOutMasukCount || 0}","${s.lateDaysCount || 0}","${s.izinCutiDlCount || 0}","${s.totalDiffFormatted || '0s'}"\n`;
            });
            downloadCsv(csv, `Rekapitulasi_Batch_Absensi_Pegawai.csv`);
        } else {
            const data = allParsedData[selectedIndex];
            let csv = 'Tanggal,Hari,Jam Masuk,Kode Masuk,Jam Pulang,Kode Pulang,Keterlambatan,Jam Pulang Wajib Min,Durasi Net,Status\n';
            data.records.forEach(r => {
                csv += `"${r.tanggal}","${r.hari}","${r.jamMasuk}","${r.kodeMasuk}","${r.jamPulang}","${r.kodePulang}","${r.lateFormatted}","${r.minOutStr}","${r.netFormatted}","${r.status}"\n`;
            });
            downloadCsv(csv, `Laporan_Absensi_${data.header.nama.replace(/\s+/g, '_')}_${data.header.bulan}_${data.header.tahun}.csv`);
        }
    });

    function downloadCsv(content, fileName) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }
});
