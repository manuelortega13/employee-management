import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AttendanceService } from '../attendance/attendance.service';

type PrimaryAction = 'checkIn' | 'checkOut' | 'done';

@Component({
  selector: 'app-employee-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class EmployeeLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly attendance = inject(AttendanceService);

  protected readonly user = this.auth.user;

  protected readonly primaryAction = computed<PrimaryAction>(() => {
    const today = this.attendance.todayRecord();
    if (!today) return 'checkIn';
    if (today.checkOut) return 'done';
    return 'checkOut';
  });

  protected readonly primaryActionLabel = computed(() => {
    switch (this.primaryAction()) {
      case 'checkIn':
        return 'Check In';
      case 'checkOut':
        return 'Check Out';
      case 'done':
        return 'Done';
    }
  });

  constructor() {
    this.attendance.loadRecords();
  }

  protected triggerPrimaryAction(): void {
    const action = this.primaryAction();
    if (action === 'done') return;
    this.router.navigate(['/attendance'], { queryParams: { action } });
  }

  protected logout(): void {
    this.auth.logout();
  }
}
