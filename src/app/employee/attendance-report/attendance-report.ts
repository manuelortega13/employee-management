import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AttendanceService, AttendanceRecord } from '../attendance/attendance.service';

@Component({
  selector: 'app-attendance-report',
  imports: [DatePipe],
  templateUrl: './attendance-report.html',
  styleUrl: './attendance-report.css',
})
export class AttendanceReport {
  private readonly attendance = inject(AttendanceService);

  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly selectedMonth = signal(new Date().getMonth());

  constructor() {
    this.attendance.loadRecords();
  }

  protected readonly monthLabel = computed(() => {
    const date = new Date(this.selectedYear(), this.selectedMonth(), 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  protected readonly monthRecords = computed(() =>
    this.attendance.getRecordsForMonth(this.selectedYear(), this.selectedMonth())
  );

  protected readonly totalDays = computed(() => this.monthRecords().length);

  protected readonly completedDays = computed(
    () => this.monthRecords().filter((r) => r.checkOut !== null).length
  );

  protected readonly totalWorkedMs = computed(() =>
    this.monthRecords().reduce((sum, r) => sum + this.attendance.getWorkedMs(r), 0)
  );

  protected readonly averageWorkedMs = computed(() => {
    const completed = this.completedDays();
    return completed > 0 ? this.totalWorkedMs() / completed : 0;
  });

  protected previousMonth(): void {
    if (this.selectedMonth() === 0) {
      this.selectedMonth.set(11);
      this.selectedYear.update((y) => y - 1);
    } else {
      this.selectedMonth.update((m) => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.selectedMonth() === 11) {
      this.selectedMonth.set(0);
      this.selectedYear.update((y) => y + 1);
    } else {
      this.selectedMonth.update((m) => m + 1);
    }
  }

  protected formatDuration(ms: number): string {
    return this.attendance.formatDuration(ms);
  }

  protected getWorkedMs(record: AttendanceRecord): number {
    return this.attendance.getWorkedMs(record);
  }

  protected utc(timestamp: string): string {
    return this.attendance.toLocalTime(timestamp);
  }

  protected getStatus(record: AttendanceRecord): string {
    if (record.checkOut) return 'Complete';
    return 'In progress';
  }
}
