import Dexie, { Table } from 'dexie';
import {
  AttendanceRecordRow,
  BreakRecordRow,
  EmployeeRecord,
  MetaRow,
} from './types';

export class EmployeeDb extends Dexie {
  employees!: Table<EmployeeRecord, number>;
  attendances!: Table<AttendanceRecordRow, number>;
  breaks!: Table<BreakRecordRow, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('employee-management');
    this.version(1).stores({
      employees: '++id, &email, role, isActive',
      attendances: '++id, employeeId, date, [employeeId+date]',
      breaks: '++id, attendanceId',
      meta: '&key',
    });
  }
}

export const db = new EmployeeDb();
