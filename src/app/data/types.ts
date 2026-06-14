export interface EmployeeRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  phone: string;
  position: string;
  departmentId: number | null;
  dailyRate: number;
  role: 'ADMIN' | 'EMPLOYEE';
  hireDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecordRow {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkInPhoto: string;
  checkOut: string | null;
  checkOutPhoto: string | null;
  totalBreakMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface BreakRecordRow {
  id: number;
  attendanceId: number;
  startTime: string;
  startPhoto: string;
  endTime: string | null;
  endPhoto: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestType = 'LEAVE' | 'SICK' | 'OTHER';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimeOffRequestRecord {
  id: number;
  employeeId: number;
  type: RequestType;
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CashAdvanceStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEDUCTED'
  | 'CANCELLED';

export interface CashAdvanceRecord {
  id: number;
  employeeId: number;
  amount: number;
  reason: string;
  status: CashAdvanceStatus;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: string | null;
  deductedAt: string | null;
  deductedPayrollId: number | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = 'DRAFT' | 'RELEASED' | 'CANCELLED' | 'VOIDED';

export interface PayrollRecord {
  id: number;
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  dailyRate: number;
  workHoursPerDay: number;
  hourlyRate: number;
  totalHoursMs: number;
  totalBreakMs: number;
  daysComplete: number;
  daysIncomplete: number;
  grossSalary: number;
  deductions: number;
  bonuses: number;
  netSalary: number;
  notes: string;
  status: PayrollStatus;
  generatedAt: string;
  generatedById: number;
  releasedAt: string | null;
  releasedById: number | null;
  cancelledAt: string | null;
  cancelledById: number | null;
  voidedAt: string | null;
  voidedById: number | null;
  createdAt: string;
  updatedAt: string;
}
