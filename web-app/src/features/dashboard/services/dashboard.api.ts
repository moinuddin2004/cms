import type {
    Appointment,
    ChartDataPoint,
    DashboardStats,
    SpendingData,
} from '../types';

/**
 * Mock API module for dashboard data.
 * Structured so each function can be swapped to a real Axios call later.
 * 
 * To switch to real API:
 *   import apiClient from '@/lib/api';
 *   export const fetchDashboardStats = () => apiClient.get<DashboardStats>('/dashboard/stats').then(r => r.data);
 */

// Simulates network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchDashboardStats(): Promise<DashboardStats> {
    await delay(600);
    return {
        totalPatients: {
            title: 'Total Patients',
            value: '1630',
            subLabel: 'Last 7 days',
            percentageChange: 3.5,
            trend: 'up',
            icon: 'users',
        },
        appointmentsCompleted: {
            title: 'Appointments Completed',
            value: '1293',
            subLabel: 'Last 7 days',
            percentageChange: 2.5,
            trend: 'down',
            icon: 'calendar-check',
        },
        revenueGenerated: {
            title: 'Revenue Generated',
            value: '$75,000',
            subLabel: 'Last 7 days',
            percentageChange: 12,
            trend: 'up',
            icon: 'dollar-sign',
        },
        patientSatisfaction: {
            title: 'Patient Satisfaction',
            value: '4.8 / 5.0',
            subLabel: 'Last 7 days',
            percentageChange: 24,
            trend: 'up',
            icon: 'smile',
        },
    };
}

export async function fetchChartData(): Promise<ChartDataPoint[]> {
    await delay(800);
    return [
        { month: 'Jan', income: 450, expenses: 200 },
        { month: 'Feb', income: 300, expenses: 250 },
        { month: 'Mar', income: 550, expenses: 380 },
        { month: 'Apr', income: 870, expenses: 546 },
        { month: 'May', income: 200, expenses: 150 },
        { month: 'Jun', income: 350, expenses: 280 },
        { month: 'Jul', income: 180, expenses: 120 },
    ];
}

export async function fetchSpendingBreakdown(): Promise<SpendingData> {
    await delay(700);
    return {
        totalExpense: 167467.0,
        percentageChange: 1.8,
        trend: 'up',
        categories: [
            { name: 'Medical Equipment', amount: 21000, color: '#1e3a5f', percentage: 25 },
            { name: 'Rental Cost', amount: 13000, color: '#2d5a8e', percentage: 18 },
            { name: 'Supplies', amount: 11200, color: '#3b82f6', percentage: 15 },
            { name: 'Promotion cost', amount: 11390, color: '#f59e0b', percentage: 14 },
            { name: 'Others', amount: 18389, color: '#22c55e', percentage: 12 },
        ],
    };
}

export async function fetchAppointments(): Promise<Appointment[]> {
    await delay(500);
    return [
        {
            id: '1',
            patientName: 'Bessie Cooper',
            patientAge: 45,
            patientAvatar: '',
            date: 'Wed, Nov 24th, 2024',
            timeSlot: '8:00 - 9:00 AM',
            duration: '60 min',
            contactPhone: '(702) 555-0122',
            contactEmail: 'tanya.hill@example.com',
            status: 'Completed',
            doctorAssigned: 'Dr. Emily Johnson',
            details: 'Follow Up',
        },
        {
            id: '2',
            patientName: 'Leslie Alexander',
            patientAge: 34,
            patientAvatar: '',
            date: 'Wed, Nov 24th, 2024',
            timeSlot: '8:30 - 9:15 AM',
            duration: '45 min',
            contactPhone: '(205) 555-0100',
            contactEmail: 'debbie.baker@example.com',
            status: 'Completed',
            doctorAssigned: 'Dr. Sarah Lee',
            details: 'Check Up',
        },
        {
            id: '3',
            patientName: 'Albert Flores',
            patientAge: 40,
            patientAvatar: '',
            date: 'Thu, Nov 25th, 2024',
            timeSlot: '9:00 - 9:30 AM',
            duration: '30 min',
            contactPhone: '(316) 555-0116',
            contactEmail: 'kenzi.lawson@example.com',
            status: 'Completed',
            doctorAssigned: 'Dr. Emily Johnson',
            details: 'Therapy',
        },
        {
            id: '4',
            patientName: 'Theresa Webb',
            patientAge: 28,
            patientAvatar: '',
            date: 'Thu, Nov 26th, 2024',
            timeSlot: '9:15 - 10:00 AM',
            duration: '45 min',
            contactPhone: '(480) 555-0103',
            contactEmail: 'debra.holt@example.com',
            status: 'No Show',
            doctorAssigned: 'Dr. Sarah Lee',
            details: 'Lab Test',
        },
    ];
}
