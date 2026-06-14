import {
  AttendanceRecordRow,
  BreakRecordRow,
  CashAdvanceRecord,
  DepartmentRecord,
  EmployeeRecord,
  PayrollRecord,
  TimeOffRequestRecord,
} from '../data/types';

export const BACKUP_SCHEMA = 'employee-management';
export const BACKUP_VERSION = 4;
export const BACKUP_PREFIX = 'employee-management-backup-';

export interface BackupFile {
  version: number;
  schema: string;
  exportedAt: string;
  tables: {
    employees: EmployeeRecord[];
    attendances: AttendanceRecordRow[];
    breaks: BreakRecordRow[];
    departments?: DepartmentRecord[];
    requests?: TimeOffRequestRecord[];
    payrolls?: PayrollRecord[];
    cashAdvances?: CashAdvanceRecord[];
  };
}

export function backupFilename(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  return `${BACKUP_PREFIX}${iso}.json`;
}
