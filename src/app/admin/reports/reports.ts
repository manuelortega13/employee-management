import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../employee/attendance/attendance.service';
import { Employee } from '../employees/data/employee.model';
import { EmployeeService } from '../employees/data/employee.service';

interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  totalBreakMs: number;
}

interface EmployeeReport {
  employee: Employee;
  records: AttendanceRecord[];
  totalWorkedMs: number;
  totalBreakMs: number;
  daysPresent: number;
}

@Component({
  selector: 'app-admin-reports',
  imports: [DatePipe, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class AdminReports {
  private readonly employeeService = inject(EmployeeService);
  private readonly attendance = inject(AttendanceService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly reports = signal<EmployeeReport[]>([]);
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly selectedMonth = signal(new Date().getMonth() + 1);
  protected readonly loading = signal(false);
  protected readonly selectedEmployeeId = signal<number | null>(null);

  protected readonly monthLabel = computed(() => {
    const date = new Date(this.selectedYear(), this.selectedMonth() - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  // Recent years for the year dropdown (current year back 5, plus next year).
  protected readonly years = ((): number[] => {
    const current = new Date().getFullYear();
    const list: number[] = [];
    for (let y = current + 1; y >= current - 5; y--) list.push(y);
    return list;
  })();

  protected readonly activeEmployeeLabel = computed(() => {
    const id = this.selectedEmployeeId();
    if (id === null) return 'All Employees';
    const emp = this.employees().find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'All Employees';
  });

  protected readonly isDefaultFilter = computed(() => {
    const now = new Date();
    return (
      this.selectedEmployeeId() === null &&
      this.selectedMonth() === now.getMonth() + 1 &&
      this.selectedYear() === now.getFullYear()
    );
  });

  protected resetFilters(): void {
    const now = new Date();
    this.selectedEmployeeId.set(null);
    this.selectedMonth.set(now.getMonth() + 1);
    this.selectedYear.set(now.getFullYear());
    this.loadReport();
  }

  protected readonly filteredReports = computed(() => {
    const id = this.selectedEmployeeId();
    if (id === null) return this.reports();
    return this.reports().filter((r) => r.employee.id === id);
  });

  protected readonly grandTotalWorkedMs = computed(() =>
    this.filteredReports().reduce((sum, r) => sum + r.totalWorkedMs, 0)
  );

  // Edit modal
  protected readonly editOpen = signal(false);
  protected readonly editRecord = signal<AttendanceRecord | null>(null);
  protected readonly editForm = signal({ date: '', checkInTime: '', checkOutTime: '' });
  protected readonly editError = signal<string | null>(null);
  protected readonly editBusy = signal(false);
  protected readonly editStatus = signal<string | null>(null);

  constructor() {
    this.loadEmployees();
  }

  protected openEdit(record: AttendanceRecord): void {
    this.editError.set(null);
    this.editRecord.set(record);
    const checkInLocal = utcStringToLocalParts(record.checkIn);
    const checkOutLocal = record.checkOut ? utcStringToLocalParts(record.checkOut) : null;
    this.editForm.set({
      date: record.date,
      checkInTime: checkInLocal.time,
      checkOutTime: checkOutLocal?.time ?? '',
    });
    this.editOpen.set(true);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
    this.editRecord.set(null);
    this.editError.set(null);
  }

  protected updateEditField(
    field: 'checkInTime' | 'checkOutTime',
    value: string
  ): void {
    this.editForm.update((f) => ({ ...f, [field]: value }));
  }

  protected async saveEdit(): Promise<void> {
    const r = this.editRecord();
    if (!r) return;
    const f = this.editForm();
    if (!f.checkInTime) {
      this.editError.set('Check-in time is required');
      return;
    }
    this.editBusy.set(true);
    this.editError.set(null);
    try {
      const checkInIso = localPartsToUtcString(f.date, f.checkInTime);
      const checkOutIso = f.checkOutTime
        ? localPartsToUtcString(f.date, f.checkOutTime)
        : null;
      await this.attendance.adminEditTimes(r.id, {
        checkIn: checkInIso,
        checkOut: checkOutIso,
      });
      this.editStatus.set('Attendance updated.');
      this.editOpen.set(false);
      await this.loadReport();
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Could not update');
    } finally {
      this.editBusy.set(false);
    }
  }

  protected async loadReport(): Promise<void> {
    this.loading.set(true);
    try {
      const employees = this.employees();
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const results: EmployeeReport[] = [];

      for (const emp of employees) {
        const records = await this.attendance.getRecordsForEmployeeMonth(emp.id, year, month);
        const totalWorkedMs = records.reduce((sum, r) => sum + this.attendance.getWorkedMs(r), 0);
        const totalBreakMs = records.reduce((sum, r) => sum + (r.totalBreakMs ?? 0), 0);

        if (records.length > 0 || this.selectedEmployeeId() === emp.id) {
          results.push({
            employee: emp,
            records: records
              .map((r) => ({
                id: r.id,
                employeeId: r.employeeId,
                date: r.date,
                checkIn: r.checkIn,
                checkOut: r.checkOut,
                totalBreakMs: r.totalBreakMs,
              }))
              .sort((a, b) => b.date.localeCompare(a.date)),
            totalWorkedMs,
            totalBreakMs,
            daysPresent: records.length,
          });
        }
      }

      results.sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName));
      this.reports.set(results);
    } finally {
      this.loading.set(false);
    }
  }

  protected getRecordWorkedMs(record: AttendanceRecord): number {
    if (!record.checkOut) return 0;
    const total = new Date(record.checkOut + 'Z').getTime() - new Date(record.checkIn + 'Z').getTime();
    return total - (record.totalBreakMs ?? 0);
  }

  protected formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  protected utc(timestamp: string): string {
    return timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  }

  private loadEmployees(): void {
    this.employeeService.findAll().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loadReport();
      },
    });
  }
}

function utcStringToLocalParts(ts: string): { date: string; time: string } {
  const iso = ts.endsWith('Z') ? ts : ts + 'Z';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function localPartsToUtcString(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
  return local.toISOString().replace(/Z$/, '');
}
