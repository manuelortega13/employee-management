import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, EmployeeCreateRequest, EmployeeUpdateRequest } from './data/employee.model';
import { EmployeeService } from './data/employee.service';

@Component({
  selector: 'app-admin-employees',
  imports: [DatePipe, FormsModule],
  templateUrl: './employees.html',
  styleUrl: './employees.css',
})
export class AdminEmployees {
  private readonly service = inject(EmployeeService);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly modalOpen = signal(false);
  protected readonly editingEmployee = signal<Employee | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly deleteConfirmId = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = signal({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    position: '',
    departmentId: null as number | null,
    role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE',
    hireDate: '',
    isActive: true,
  });

  protected readonly filteredEmployees = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.employees();
    return this.employees().filter(
      (e) =>
        e.firstName.toLowerCase().includes(query) ||
        e.lastName.toLowerCase().includes(query) ||
        e.email.toLowerCase().includes(query) ||
        e.position.toLowerCase().includes(query)
    );
  });

  constructor() {
    this.loadEmployees();
  }

  protected openCreate(): void {
    this.editingEmployee.set(null);
    this.error.set(null);
    this.form.set({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      position: '',
      departmentId: null,
      role: 'EMPLOYEE',
      hireDate: '',
      isActive: true,
    });
    this.modalOpen.set(true);
  }

  protected openEdit(employee: Employee): void {
    this.editingEmployee.set(employee);
    this.error.set(null);
    this.form.set({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      password: '',
      phone: employee.phone,
      position: employee.position,
      departmentId: employee.departmentId,
      role: employee.role,
      hireDate: employee.hireDate,
      isActive: employee.isActive,
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editingEmployee.set(null);
    this.error.set(null);
  }

  protected save(): void {
    const data = this.form();
    const editing = this.editingEmployee();

    if (editing) {
      const request: EmployeeUpdateRequest = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        position: data.position,
        departmentId: data.departmentId,
        role: data.role,
        hireDate: data.hireDate,
        isActive: data.isActive,
        ...(data.password ? { password: data.password } : {}),
      };
      this.service.update(editing.id, request).subscribe({
        next: () => {
          this.closeModal();
          this.loadEmployees();
        },
        error: (err) => this.error.set(err.error?.message ?? 'Failed to update employee'),
      });
    } else {
      const request: EmployeeCreateRequest = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        position: data.position,
        departmentId: data.departmentId,
        role: data.role,
        hireDate: data.hireDate,
      };
      this.service.create(request).subscribe({
        next: () => {
          this.closeModal();
          this.loadEmployees();
        },
        error: (err) => this.error.set(err.error?.message ?? 'Failed to create employee'),
      });
    }
  }

  protected confirmDelete(id: number): void {
    this.deleteConfirmId.set(id);
  }

  protected cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  protected deleteEmployee(id: number): void {
    this.service.delete(id).subscribe({
      next: () => {
        this.deleteConfirmId.set(null);
        this.loadEmployees();
      },
      error: () => {
        this.deleteConfirmId.set(null);
      },
    });
  }

  protected updateFormField(field: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  private loadEmployees(): void {
    this.loading.set(true);
    this.service.findAll().subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
