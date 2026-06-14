import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { AttendanceRecord, AttendanceService } from '../attendance/attendance.service';

type TodayStatus = 'notStarted' | 'checkedIn' | 'onBreak' | 'checkedOut';

@Component({
  selector: 'app-employee-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class EmployeeDashboard implements OnDestroy {
  private readonly attendance = inject(AttendanceService);
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly now = signal(new Date());

  private clockInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.attendance.loadRecords();
    this.clockInterval = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval !== null) clearInterval(this.clockInterval);
  }

  protected readonly todayRecord = computed(() => {
    this.now();
    return this.attendance.todayRecord();
  });

  protected readonly status = computed<TodayStatus>(() => {
    const today = this.todayRecord();
    if (!today) return 'notStarted';
    if (today.checkOut) return 'checkedOut';
    if (this.attendance.isOnBreak()) return 'onBreak';
    return 'checkedIn';
  });

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'notStarted':
        return 'Not checked in yet';
      case 'checkedIn':
        return 'Checked in';
      case 'onBreak':
        return 'On break';
      case 'checkedOut':
        return 'Checked out';
    }
  });

  protected readonly statusBadgeClass = computed(() => {
    switch (this.status()) {
      case 'notStarted':
        return 'badge-neutral';
      case 'checkedIn':
        return 'badge-good';
      case 'onBreak':
        return 'badge-warn';
      case 'checkedOut':
        return 'badge-done';
    }
  });

  protected readonly checkInTime = computed(() => {
    const today = this.todayRecord();
    return today ? this.attendance.toLocalTime(today.checkIn) : null;
  });

  protected readonly checkOutTime = computed(() => {
    const today = this.todayRecord();
    return today?.checkOut ? this.attendance.toLocalTime(today.checkOut) : null;
  });

  protected readonly hoursToday = computed(() => {
    const today = this.todayRecord();
    if (!today) return '0h 0m';
    if (today.checkOut) {
      return this.attendance.formatDuration(this.attendance.getWorkedMs(today));
    }
    const elapsed =
      this.now().getTime() - new Date(this.attendance.toLocalTime(today.checkIn)).getTime();
    return this.attendance.formatDuration(Math.max(0, elapsed - (today.totalBreakMs ?? 0)));
  });

  protected readonly monthRecords = computed(() => {
    const d = this.now();
    return this.attendance.getRecordsForMonth(d.getFullYear(), d.getMonth());
  });

  protected readonly daysPresent = computed(() => this.monthRecords().length);

  protected readonly totalMonthMs = computed(() =>
    this.monthRecords().reduce((sum, r) => sum + this.attendance.getWorkedMs(r), 0)
  );

  protected readonly totalMonthLabel = computed(() =>
    this.attendance.formatDuration(this.totalMonthMs())
  );

  protected readonly avgHoursLabel = computed(() => {
    const completed = this.monthRecords().filter((r) => r.checkOut).length;
    if (completed === 0) return '—';
    return this.attendance.formatDuration(this.totalMonthMs() / completed);
  });

  protected readonly monthLabel = computed(() =>
    this.now().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  protected utc(timestamp: string): string {
    return this.attendance.toLocalTime(timestamp);
  }
}
