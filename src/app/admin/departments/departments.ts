import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Department } from './department.model';
import { DepartmentService } from './department.service';

@Component({
  selector: 'app-admin-departments',
  imports: [FormsModule],
  templateUrl: './departments.html',
  styleUrl: './departments.css',
})
export class AdminDepartments {
  private readonly service = inject(DepartmentService);

  protected readonly departments = signal<Department[]>([]);
  protected readonly counts = signal<Map<number, number>>(new Map());
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Department | null>(null);
  protected readonly deleteConfirmId = signal<number | null>(null);
  protected readonly searchQuery = signal('');

  protected readonly form = signal({ name: '', description: '' });

  protected readonly filteredDepartments = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.departments();
    return this.departments().filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    );
  });

  constructor() {
    this.load();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.set({ name: '', description: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(department: Department): void {
    this.editing.set(department);
    this.error.set(null);
    this.form.set({ name: department.name, description: department.description });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
    this.error.set(null);
  }

  protected updateField(field: 'name' | 'description', value: string): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  protected async save(): Promise<void> {
    this.error.set(null);
    try {
      const data = this.form();
      const editing = this.editing();
      if (editing) {
        await this.service.update(editing.id, data);
      } else {
        await this.service.create(data);
      }
      this.modalOpen.set(false);
      this.editing.set(null);
      await this.load();
    } catch (err) {
      this.error.set(this.errMessage(err, 'Could not save department'));
    }
  }

  protected confirmDelete(id: number): void {
    this.deleteConfirmId.set(id);
  }

  protected cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  protected async deleteDepartment(id: number): Promise<void> {
    try {
      await this.service.delete(id);
      this.deleteConfirmId.set(null);
      await this.load();
    } catch (err) {
      this.deleteConfirmId.set(null);
      this.error.set(this.errMessage(err, 'Could not delete department'));
    }
  }

  protected getCount(id: number): number {
    return this.counts().get(id) ?? 0;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const departments = await this.service.findAll();
      this.departments.set(departments);
      const map = new Map<number, number>();
      await Promise.all(
        departments.map(async (d) => {
          map.set(d.id, await this.service.employeeCount(d.id));
        })
      );
      this.counts.set(map);
    } finally {
      this.loading.set(false);
    }
  }

  private errMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }
}
