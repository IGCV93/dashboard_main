(function() {
    'use strict';
    
    function getCurrentQuarter() {
        const month = new Date().getMonth();
        return `Q${Math.floor(month / 3) + 1}`;
    }

    function getCurrentMonth() {
        return new Date().getMonth() + 1;
    }

    function getCurrentYear() {
        return new Date().getFullYear().toString();
    }

    function getDaysInPeriod(view, selectedPeriod, selectedYear, selectedMonth) {
        const year = parseInt(selectedYear);
        
        if (view === 'annual') {
            const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            return isLeapYear ? 366 : 365;
        } else if (view === 'quarterly') {
            const quarterDays = {
                'Q1': (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 91 : 90,
                'Q2': 91,
                'Q3': 92,
                'Q4': 92
            };
            return quarterDays[selectedPeriod] || 90;
        } else if (view === 'monthly') {
            const month = parseInt(selectedMonth) - 1;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            return daysInMonth;
        }
        return 30;
    }

    function getDaysElapsed(view, selectedPeriod, selectedYear, selectedMonth) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let startDate, endDate;
        
        if (view === 'annual') {
            startDate = new Date(parseInt(selectedYear), 0, 1);
            endDate = new Date(parseInt(selectedYear), 11, 31);
        } else if (view === 'quarterly') {
            const quarterStarts = { 'Q1': 0, 'Q2': 3, 'Q3': 6, 'Q4': 9 };
            const quarterEnds = { 'Q1': 2, 'Q2': 5, 'Q3': 8, 'Q4': 11 };
            startDate = new Date(parseInt(selectedYear), quarterStarts[selectedPeriod], 1);
            endDate = new Date(parseInt(selectedYear), quarterEnds[selectedPeriod] + 1, 0);
        } else if (view === 'monthly') {
            const month = parseInt(selectedMonth) - 1;
            startDate = new Date(parseInt(selectedYear), month, 1);
            endDate = new Date(parseInt(selectedYear), month + 1, 0);
        }
        
        if (today < startDate) return 0;
        if (today > endDate) return getDaysInPeriod(view, selectedPeriod, selectedYear, selectedMonth);
        
        const elapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
        return elapsed;
    }

    function getTwoBusinessDaysAgo() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        today.setDate(today.getDate() - 2);
        return today;
    }
    
    // Make available globally
    window.dateUtils = {
        getCurrentQuarter,
        getCurrentMonth,
        getCurrentYear,
        getDaysInPeriod,
        getDaysElapsed,
        getTwoBusinessDaysAgo
    };
    
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.dateUtils = window.dateUtils;
})();
