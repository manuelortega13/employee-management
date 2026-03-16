import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

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
  private readonly http = inject(HttpClient);
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
    this.http.get<AttendanceRecord[]>(`/api/attendance/employee/${this.employeeId}`).subscribe({
      next: (records) => {
        this.records.set(records);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  checkIn(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.http
      .post<AttendanceRecord>('/api/attendance/check-in', {
        employeeId: this.employeeId,
        checkInPhoto: photo,
      })
      .subscribe({
        next: () => {
          this.loadRecords();
          onSuccess();
        },
        error: (err) => onError(err.error?.message ?? 'Check-in failed'),
      });
  }

  checkOut(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.http
      .put<AttendanceRecord>(`/api/attendance/employee/${this.employeeId}/check-out`, {
        checkOutPhoto: photo,
      })
      .subscribe({
        next: () => {
          this.loadRecords();
          onSuccess();
        },
        error: (err) => onError(err.error?.message ?? 'Check-out failed'),
      });
  }

  startBreak(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.http
      .post<BreakRecord>(`/api/breaks/employee/${this.employeeId}/start`, { startPhoto: photo })
      .subscribe({
        next: () => {
          this.loadRecords();
          onSuccess();
        },
        error: (err) => onError(err.error?.message ?? 'Failed to start break'),
      });
  }

  endBreak(photo: string, onSuccess: () => void, onError: (msg: string) => void): void {
    this.http
      .put<BreakRecord>(`/api/breaks/employee/${this.employeeId}/end`, { endPhoto: photo })
      .subscribe({
        next: () => {
          this.loadRecords();
          onSuccess();
        },
        error: (err) => onError(err.error?.message ?? 'Failed to end break'),
      });
  }

  getRecordsForMonth(year: number, month: number): AttendanceRecord[] {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return this.records().filter((r) => r.date.startsWith(prefix));
  }

  formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
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
}
