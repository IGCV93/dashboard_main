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
            // Calculate actual days in quarter by summing the months
            const quarterMonths = {
                'Q1': [0, 1, 2],  // Jan, Feb, Mar
                'Q2': [3, 4, 5],  // Apr, May, Jun
                'Q3': [6, 7, 8],  // Jul, Aug, Sep
                'Q4': [9, 10, 11] // Oct, Nov, Dec
            };

            const months = quarterMonths[selectedPeriod] || quarterMonths['Q1'];
            let totalDays = 0;

            months.forEach(monthIndex => {
                totalDays += new Date(year, monthIndex + 1, 0).getDate();
            });

            return totalDays;
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

    /**
     * Generate year options for dropdowns based on data availability
     * @param {Array} salesData - Sales data to detect years from
     * @param {number} startYear - Starting year (default: 2020)
     * @returns {Array} Array of year objects with value and label
     */
    function getYearOptions(salesData = [], startYear = 2020) {
        const currentYear = new Date().getFullYear();
        const years = new Set();
        
        // Add years from sales data
        if (salesData && salesData.length > 0) {
            salesData.forEach(record => {
                if (record.date) {
                    const year = new Date(record.date).getFullYear();
                    if (year >= startYear && year <= currentYear) {
                        years.add(year);
                    }
                }
            });
        }
        
        // If no data, fallback to current year and previous year
        if (years.size === 0) {
            years.add(currentYear);
            if (currentYear > startYear) {
                years.add(currentYear - 1);
            }
        }
        
        // Convert to array and sort descending
        const yearArray = Array.from(years).sort((a, b) => b - a);
        
        return yearArray.map(year => ({
            value: year.toString(),
            label: year.toString()
        }));
    }

    /**
     * Get the latest year from sales data
     * @param {Array} salesData - Sales data to analyze
     * @returns {string} Latest year as string, or current year if no data
     */
    function getLatestYearFromData(salesData = []) {
        if (!salesData || salesData.length === 0) {
            return new Date().getFullYear().toString();
        }

        let latestYear = 0;
        salesData.forEach(record => {
            if (record.date) {
                const year = new Date(record.date).getFullYear();
                if (year > latestYear) {
                    latestYear = year;
                }
            }
        });

        return latestYear > 0 ? latestYear.toString() : new Date().getFullYear().toString();
    }

    /**
     * Get actual days in a specific quarter for accurate monthly target distribution
     * @param {number} year - The year
     * @param {string} quarter - Quarter string (Q1, Q2, Q3, Q4)
     * @returns {number} Total days in the quarter
     */
    function getDaysInQuarter(year, quarter) {
        const quarterMonths = {
            'Q1': [0, 1, 2],  // Jan, Feb, Mar
            'Q2': [3, 4, 5],  // Apr, May, Jun
            'Q3': [6, 7, 8],  // Jul, Aug, Sep
            'Q4': [9, 10, 11] // Oct, Nov, Dec
        };

        const months = quarterMonths[quarter] || quarterMonths['Q1'];
        let totalDays = 0;

        months.forEach(monthIndex => {
            totalDays += new Date(year, monthIndex + 1, 0).getDate();
        });

        return totalDays;
    }

    /**
     * Get days in a specific month
     * @param {number} year - The year
     * @param {number} month - Month (1-12)
     * @returns {number} Days in the month
     */
    function getDaysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }
    
    // Make available globally
    window.dateUtils = {
        getCurrentQuarter,
        getCurrentMonth,
        getCurrentYear,
        getDaysInPeriod,
        getDaysElapsed,
        getTwoBusinessDaysAgo,
        getYearOptions,
        getLatestYearFromData,
        getDaysInQuarter,
        getDaysInMonth
    };
    
    window.ChaiVision = window.ChaiVision || {};
    window.ChaiVision.dateUtils = window.dateUtils;
})();
