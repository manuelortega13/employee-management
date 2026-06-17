import Dexie, { Table } from 'dexie';
import { formatLocalDate, parseStoredTimestamp } from '../shared/date-util';
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
    // Repair attendance `date` fields written with the old UTC-based formatter.
    // Early-morning check-ins in timezones ahead of UTC (e.g. UTC+8) were filed
    // under the previous calendar day. Re-derive `date` from the local date of
    // each record's check-in timestamp so it matches the user's wall-clock day.
    this.version(5)
      .stores({
        attendances: '++id, employeeId, date, [employeeId+date]',
      })
      .upgrade((tx) =>
        tx
          .table<AttendanceRecordRow, number>('attendances')
          .toCollection()
          .modify((row) => {
            if (!row.checkIn) return;
            const corrected = formatLocalDate(parseStoredTimestamp(row.checkIn));
            if (corrected !== row.date) row.date = corrected;
          })
      );
  }
}

export const db = new EmployeeDb();
