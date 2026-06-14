import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { Department } from '../../admin/departments/department.model';
import { DepartmentService } from '../../admin/departments/department.service';
import { Employee } from '../../admin/employees/data/employee.model';
import { EmployeeService } from '../../admin/employees/data/employee.service';

@Component({
  selector: 'app-employee-profile',
  imports: [DatePipe, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class EmployeeProfile {
  private readonly auth = inject(AuthService);
  private readonly employees = inject(EmployeeService);
  private readonly departmentService = inject(DepartmentService);

  protected readonly authUser = this.auth.user;
  protected readonly employee = signal<Employee | null>(null);
  protected readonly departments = signal<Department[]>([]);
  protected readonly editMode = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  protected readonly form = signal({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly departmentName = computed(() => {
    const id = this.employee()?.departmentId ?? null;
    if (id === null) return '—';
    return this.departments().find((d) => d.id === id)?.name ?? '—';
  });

  constructor() {
    this.load();
  }

  protected enterEdit(): void {
    const e = this.employee();
    if (!e) return;
    this.error.set(null);
    this.status.set(null);
    this.form.set({
      firstName: e.firstName,
      lastName: e.lastName,
      phone: e.phone,
      password: '',
      confirmPassword: '',
    });
    this.editMode.set(true);
  }

  protected cancelEdit(): void {
    this.editMode.set(false);
    this.error.set(null);
  }

  protected updateField(field: keyof ReturnType<typeof this.form>, value: string): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  protected async save(): Promise<void> {
    const me = this.employee();
    if (!me) return;
    const data = this.form();

    if (data.password && data.password !== data.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      const updated = await firstValueFrom(
        this.employees.update(me.id, {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone.trim(),
          ...(data.password ? { password: data.password } : {}),
        })
      );
      this.employee.set(updated);
      this.auth.refreshFromStore({
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        role: updated.role,
      });
      this.editMode.set(false);
      this.status.set('Profile updated.');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const user = this.authUser();
    if (!user) return;
    try {
      const [me, depts] = await Promise.all([
        firstValueFrom(this.employees.findById(user.id)),
        this.departmentService.findAll().catch(() => [] as Department[]),
      ]);
      this.employee.set(me);
      this.departments.set(depts);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load profile.');
    }
  }
}
