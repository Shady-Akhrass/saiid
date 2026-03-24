import apiClient from '../utils/axiosConfig';

const supervisionAPI = {
    // التقارير المختصرة
    async getSummaryDashboard(refresh = false) {
        const params = refresh ? { _refresh: 1 } : {};
        const response = await apiClient.get('/supervision/summary-dashboard', { params });
        return response.data;
    },

    async getFinancialSummary(refresh = false) {
        const params = refresh ? { _refresh: 1 } : {};
        const response = await apiClient.get('/supervision/financial-summary', { params });
        return response.data;
    },

    async getPerformanceSummary(refresh = false) {
        const params = refresh ? { _refresh: 1 } : {};
        const response = await apiClient.get('/supervision/performance-summary', { params });
        return response.data;
    },

    // التقارير المفصلة
    async getDetailedProjects(filters = {}) {
        const response = await apiClient.get('/supervision/detailed-projects', {
            params: filters
        });
        return response.data;
    },

    async getDetailedFinancial(filters = {}) {
        const response = await apiClient.get('/supervision/detailed-financial', {
            params: filters
        });
        return response.data;
    },

    async getDetailedBeneficiaries(filters = {}) {
        const response = await apiClient.get('/supervision/detailed-beneficiaries', {
            params: filters
        });
        return response.data;
    },

    async getPhotographersStatistics(refresh = false) {
        const params = refresh ? { _refresh: 1 } : {};
        const response = await apiClient.get('/supervision/photographers-statistics', { params });
        return response.data;
    },

    // التصدير - يستخدم apiClient مع blob لتحميل الملف مباشرة بدلاً من فتح صفحة جديدة
    // يُرسل فقط معايير الفلترة دون per_page و page (التصدير يفترض إرجاع كل البيانات)
    async exportReport(reportType, filters = {}) {
        const { per_page, page, ...filterParams } = filters;
        const params = {
            report_type: reportType,
            ...filterParams,
            _t: Date.now()
        };

        const response = await apiClient.get('/supervision/export', {
            params,
            responseType: 'blob',
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
            skipDeduplication: true,
            skipCacheTimestamp: true
        });

        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;

        const contentDisposition = response.headers['content-disposition'];
        let filename = `supervision_${reportType}_export.xlsx`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '').trim();
            }
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    }
};

export default supervisionAPI;
