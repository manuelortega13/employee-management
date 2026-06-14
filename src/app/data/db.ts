import Dexie, { Table } from 'dexie';
import {
  AttendanceRecordRow,
  BreakRecordRow,
  CashAdvanceRecord,
  DepartmentRecord,
  EmployeeRecord,
  MetaRow,
  PayrollRecord,
  TimeOffRequestRecord,
} from './types';

export class EmployeeDb extends Dexie {
  employees!: Table<EmployeeRecord, number>;
  attendances!: Table<AttendanceRecordRow, number>;
  breaks!: Table<BreakRecordRow, number>;
  meta!: Table<MetaRow, string>;
  departments!: Table<DepartmentRecord, number>;
  requests!: Table<TimeOffRequestRecord, number>;
  payrolls!: Table<PayrollRecord, number>;
  cashAdvances!: Table<CashAdvanceRecord, number>;

  constructor() {
    super('employee-management');
    this.version(1).stores({
      employees: '++id, &email, role, isActive',
      attendances: '++id, employeeId, date, [employeeId+date]',
      breaks: '++id, attendanceId',
      meta: '&key',
    });
    this.version(2).stores({
      departments: '++id, &name',
      requests: '++id, employeeId, status, [employeeId+status]',
    });
    this.version(3).stores({
      payrolls: '++id, employeeId, status, periodStart, [employeeId+status]',
    });
    this.version(4).stores({
      cashAdvances: '++id, employeeId, status, [employeeId+status]',
    });
  }
}

export const db = new EmployeeDb();
