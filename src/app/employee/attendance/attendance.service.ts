import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { db } from '../../data/db';
import { AttendanceRecordRow, BreakRecordRow } from '../../data/types';
import { formatLocalDate } from '../../shared/date-util';

export interface BreakRecord {
  id: number;
  attendanceId: number;
  startTime: string;
  startPhoto: string;
  endTime: string | null;
  endPhoto: string | null;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkInPhoto: string;
  checkOut: string | null;
  checkOutPhoto: string | null;
  breaks: BreakRecord[];
  totalBreakMs: number;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly auth = inject(AuthService);

  readonly records = signal<AttendanceRecord[]>([]);
  readonly loading = signal(false);

  readonly todayRecord = computed(() => {
    const today = this.formatDate(new Date());
    return this.records().find((r) => r.date === today) ?? null;
  });

  readonly isOnBreak = computed(() => {
    const today = this.todayRecord();
    if (!today) return false;
    return today.breaks.some((b) => b.endTime === null);
  });

  private get employeeId(): number {
    return this.auth.user()!.id;
  }

  loadRecords(): void {
    this.loading.set(true);
    this.queryRecords(this.employeeId)
      .then((records) => {
        this.records.set(records);
        this.loading.set(false);
      })
      .catch(() => this.loading.set(false));
  }

  checkIn(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.runMutation(
      () => this.performCheckIn(photo),
      onSuccess,
      onError,
      'Check-in failed'
    );
  }

  checkOut(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.runMutation(
      () => this.performCheckOut(photo),
      onSuccess,
      onError,
      'Check-out failed'
    );
  }

  startBreak(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.runMutation(
      () => this.performStartBreak(photo),
      onSuccess,
      onError,
      'Failed to start break'
    );
  }

  endBreak(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.runMutation(
      () => this.performEndBreak(photo),
      onSuccess,
      onError,
      'Failed to end break'
    );
  }

  async getRecordsForEmployeeMonth(
    employeeId: number,
    year: number,
    month: number
  ): Promise<AttendanceRecord[]> {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = await db.attendances
      .where('employeeId')
      .equals(employeeId)
      .filter((r) => r.date.startsWith(prefix))
      .toArray();
    return this.hydrateRecords(rows);
  }

  async getTodayRecordsForAll(): Promise<AttendanceRecord[]> {
    const today = this.formatDate(new Date());
    const rows = await db.attendances.where('date').equals(today).toArray();
    return this.hydrateRecords(rows);
  }

  async adminEditTimes(
    recordId: number,
    opts: { checkIn?: string; checkOut?: string | null }
  ): Promise<AttendanceRecordRow> {
    const row = await db.attendances.get(recordId);
    if (!row) throw new Error('Attendance record not found');

    const next: Partial<AttendanceRecordRow> = {};
    if (opts.checkIn !== undefined) next.checkIn = stripZ(opts.checkIn);

    if (opts.checkOut !== undefined) {
      next.checkOut = opts.checkOut === null ? null : stripZ(opts.checkOut);
    }

    const proposedCheckIn = next.checkIn ?? row.checkIn;
    const proposedCheckOut = next.checkOut === undefined ? row.checkOut : next.checkOut;
    if (proposedCheckOut !== null && proposedCheckOut !== undefined) {
      const inT = new Date(this.toLocalTime(proposedCheckIn)).getTime();
      const outT = new Date(this.toLocalTime(proposedCheckOut)).getTime();
      if (outT < inT) {
        throw new Error('Check-out must be after check-in');
      }
    }

    next.updatedAt = new Date().toISOString();
    await db.attendances.update(recordId, next);
    return (await db.attendances.get(recordId))!;
  }

  getRecordsForMonth(year: number, month: number): AttendanceRecord[] {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return this.records().filter((r) => r.date.startsWith(prefix));
  }

  formatDate(date: Date): string {
    return formatLocalDate(date);
  }

  toLocalTime(utcTimestamp: string): string {
    return utcTimestamp.endsWith('Z') ? utcTimestamp : utcTimestamp + 'Z';
  }

  getWorkedMs(record: AttendanceRecord): number {
    if (!record.checkOut) return 0;
    const total =
      new Date(this.toLocalTime(record.checkOut)).getTime() -
      new Date(this.toLocalTime(record.checkIn)).getTime();
    return total - (record.totalBreakMs ?? 0);
  }

  formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  private runMutation(
    op: () => Promise<void>,
    onSuccess: () => void,
    onError: (msg: string) => void,
    fallbackMessage: string
  ): void {
    op()
      .then(() => {
        this.loadRecords();
        onSuccess();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : fallbackMessage;
        onError(message || fallbackMessage);
      });
  }

  private async performCheckIn(photo: string): Promise<void> {
    const employeeId = this.employeeId;
    const date = this.formatDate(new Date());
    const existing = await db.attendances
      .where('[employeeId+date]')
      .equals([employeeId, date])
      .first();
    if (existing) throw new Error('Already checked in today');

    const now = nowUtcString();
    await db.attendances.add({
      id: undefined as unknown as number,
      employeeId,
      date,
      checkIn: now,
      checkInPhoto: photo,
      checkOut: null,
      checkOutPhoto: null,
      totalBreakMs: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async performCheckOut(photo: string): Promise<void> {
    const today = await this.todayRow();
    if (!today) throw new Error('No active check-in to close');
    if (today.checkOut) throw new Error('Already checked out today');

    const openBreak = await db.breaks
      .where('attendanceId')
      .equals(today.id)
      .filter((b) => b.endTime === null)
      .first();
    if (openBreak) throw new Error('End your current break before checking out');

    const now = nowUtcString();
    await db.attendances.update(today.id, {
      checkOut: now,
      checkOutPhoto: photo,
      updatedAt: now,
    });
  }

  private async performStartBreak(photo: string): Promise<void> {
    const today = await this.todayRow();
    if (!today) throw new Error('Check in before starting a break');
    if (today.checkOut) throw new Error('You have already checked out today');

    const openBreak = await db.breaks
      .where('attendanceId')
      .equals(today.id)
      .filter((b) => b.endTime === null)
      .first();
    if (openBreak) throw new Error('You already have an active break');

    const now = nowUtcString();
    await db.breaks.add({
      id: undefined as unknown as number,
      attendanceId: today.id,
      startTime: now,
      startPhoto: photo,
      endTime: null,
      endPhoto: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async performEndBreak(photo: string): Promise<void> {
    const today = await this.todayRow();
    if (!today) throw new Error('No active check-in');

    const openBreak = await db.breaks
      .where('attendanceId')
      .equals(today.id)
      .filter((b) => b.endTime === null)
      .first();
    if (!openBreak) throw new Error('No active break to end');

    const now = nowUtcString();
    const duration =
      new Date(this.toLocalTime(now)).getTime() -
      new Date(this.toLocalTime(openBreak.startTime)).getTime();

    await db.transaction('rw', db.breaks, db.attendances, async () => {
      await db.breaks.update(openBreak.id, {
        endTime: now,
        endPhoto: photo,
        updatedAt: now,
      });
      await db.attendances.update(today.id, {
        totalBreakMs: (today.totalBreakMs ?? 0) + Math.max(0, duration),
        updatedAt: now,
      });
    });
  }

  private async todayRow(): Promise<AttendanceRecordRow | undefined> {
    const date = this.formatDate(new Date());
    return db.attendances.where('[employeeId+date]').equals([this.employeeId, date]).first();
  }

  private async queryRecords(employeeId: number): Promise<AttendanceRecord[]> {
    const rows = await db.attendances.where('employeeId').equals(employeeId).toArray();
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    return this.hydrateRecords(rows);
  }

  private async hydrateRecords(rows: AttendanceRecordRow[]): Promise<AttendanceRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const allBreaks = await db.breaks.where('attendanceId').anyOf(ids).toArray();
    const breakMap = new Map<number, BreakRecordRow[]>();
    for (const b of allBreaks) {
      const list = breakMap.get(b.attendanceId) ?? [];
      list.push(b);
      breakMap.set(b.attendanceId, list);
    }
    for (const [, list] of breakMap) {
      list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
    }
    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      date: row.date,
      checkIn: row.checkIn,
      checkInPhoto: row.checkInPhoto,
      checkOut: row.checkOut,
      checkOutPhoto: row.checkOutPhoto,
      totalBreakMs: row.totalBreakMs ?? 0,
      breaks: (breakMap.get(row.id) ?? []).map((b) => ({
        id: b.id,
        attendanceId: b.attendanceId,
        startTime: b.startTime,
        startPhoto: b.startPhoto,
        endTime: b.endTime,
        endPhoto: b.endPhoto,
      })),
    }));
  }
}

function nowUtcString(): string {
  return new Date().toISOString().replace(/Z$/, '');
}

function stripZ(iso: string): string {
  return iso.replace(/Z$/, '');
}
