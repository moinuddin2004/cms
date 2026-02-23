import type { ReactNode } from 'react';

/** Trend direction for stat cards */
export type TrendDirection = 'up' | 'down';

/** Props for the StatCard component */
export interface StatCardData {
    title: string;
    value: string;
    subLabel: string;
    percentageChange: number;
    trend: TrendDirection;
    icon: ReactNode;
}

/** Single data point for the analytics chart */
export interface ChartDataPoint {
    month: string;
    income: number;
    expenses: number;
}

/** Spending category for the breakdown card */
export interface SpendingCategory {
    name: string;
    amount: number;
    color: string;
    percentage: number;
}

/** Spending overview data */
export interface SpendingData {
    totalExpense: number;
    percentageChange: number;
    trend: TrendDirection;
    categories: SpendingCategory[];
}

/** Appointment status */
export type AppointmentStatus = 'Completed' | 'No Show' | 'Scheduled' | 'Cancelled';

/** Appointment record */
export interface Appointment {
    id: string;
    patientName: string;
    patientAge: number;
    patientAvatar: string;
    date: string;
    timeSlot: string;
    duration: string;
    contactPhone: string;
    contactEmail: string;
    status: AppointmentStatus;
    doctorAssigned: string;
    details: string;
}

/** Complete dashboard stats response */
export interface DashboardStats {
    totalPatients: StatCardData;
    appointmentsCompleted: StatCardData;
    revenueGenerated: StatCardData;
    patientSatisfaction: StatCardData;
}

/** Chart period option */
export type ChartPeriod = '6 month' | '12 month';
