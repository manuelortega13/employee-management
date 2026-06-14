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
