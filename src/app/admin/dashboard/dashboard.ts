import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceRecord, AttendanceService } from '../../employee/attendance/attendance.service';
import { Employee } from '../employees/data/employee.model';
import { EmployeeService } from '../employees/data/employee.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AdminDashboard {
  private readonly employeeService = inject(EmployeeService);
  private readonly attendance = inject(AttendanceService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly todayRecords = signal<AttendanceRecord[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.load();
  }

  protected readonly totalEmployees = computed(() => this.employees().length);

  protected readonly activeEmployees = computed(
    () => this.employees().filter((e) => e.isActive).length
  );

  protected readonly checkedInNow = computed(() =>
    this.todayRecords().filter((r) => !r.checkOut).length
  );

  protected readonly onBreakNow = computed(
    () =>
      this.todayRecords().filter(
        (r) => !r.checkOut && r.breaks.some((b) => b.endTime === null)
      ).length
  );

  protected readonly attendanceTodayCount = computed(() => this.todayRecords().length);

  protected readonly attendanceRate = computed(() => {
    const active = this.activeEmployees();
    if (active === 0) return '0%';
    return `${Math.round((this.attendanceTodayCount() / active) * 100)}%`;
  });

  protected readonly newHires = computed(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.employees().filter((e) => {
      const hired = new Date(e.hireDate).getTime();
      return !Number.isNaN(hired) && hired >= cutoff;
    }).length;
  });

  protected readonly adminCount = computed(
    () => this.employees().filter((e) => e.role === 'ADMIN').length
  );

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [employees, todays] = await Promise.all([
        firstValueFrom(this.employeeService.findAll()),
        this.attendance.getTodayRecordsForAll(),
      ]);
      this.employees.set(employees);
      this.todayRecords.set(todays);
    } finally {
      this.loading.set(false);
    }
  }
}
