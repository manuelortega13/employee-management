import { AttendanceRecordRow, BreakRecordRow, EmployeeRecord } from '../data/types';

export const BACKUP_SCHEMA = 'employee-management';
export const BACKUP_VERSION = 1;
export const BACKUP_PREFIX = 'employee-management-backup-';

export interface BackupFile {
  version: number;
  schema: string;
  exportedAt: string;
  tables: {
    employees: EmployeeRecord[];
    attendances: AttendanceRecordRow[];
    breaks: BreakRecordRow[];
  };
}

export function backupFilename(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  return `${BACKUP_PREFIX}${iso}.json`;
}
