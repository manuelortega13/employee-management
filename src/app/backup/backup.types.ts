import {
  AttendanceRecordRow,
  BreakRecordRow,
  CashAdvanceRecord,
  DepartmentRecord,
  EmployeeRecord,
  PayrollRecord,
  TimeOffRequestRecord,
} from '../data/types';
import { formatLocalDate } from '../shared/date-util';

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
  const iso = formatLocalDate(date);
  return `${BACKUP_PREFIX}${iso}.json`;
}
