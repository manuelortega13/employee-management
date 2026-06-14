import { Injectable } from '@angular/core';
import { db } from '../../data/db';
import { DepartmentRecord } from '../../data/types';
import { Department, DepartmentCreateRequest, DepartmentUpdateRequest } from './department.model';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  async findAll(): Promise<Department[]> {
    const rows = await db.departments.orderBy('name').toArray();
    return rows.map(toDepartment);
  }

  async findById(id: number): Promise<Department> {
    const row = await db.departments.get(id);
    if (!row) throw new Error('Department not found');
    return toDepartment(row);
  }

  async create(request: DepartmentCreateRequest): Promise<Department> {
    const name = request.name.trim();
    if (!name) throw new Error('Name is required');
    const conflict = await db.departments.where('name').equalsIgnoreCase(name).first();
    if (conflict) throw new Error('A department with this name already exists');

    const now = new Date().toISOString();
    const id = await db.departments.add({
      id: undefined as unknown as number,
      name,
      description: request.description ?? '',
      createdAt: now,
      updatedAt: now,
    });
    return this.findById(id as number);
  }

  async update(id: number, request: DepartmentUpdateRequest): Promise<Department> {
    const existing = await db.departments.get(id);
    if (!existing) throw new Error('Department not found');

    if (request.name !== undefined) {
      const name = request.name.trim();
      if (!name) throw new Error('Name is required');
      const conflict = await db.departments.where('name').equalsIgnoreCase(name).first();
      if (conflict && conflict.id !== id) {
        throw new Error('A department with this name already exists');
      }
    }

    await db.departments.update(id, {
      ...(request.name !== undefined ? { name: request.name.trim() } : {}),
      ...(request.description !== undefined ? { description: request.description } : {}),
      updatedAt: new Date().toISOString(),
    });
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    const inUse = await db.employees.filter((e) => e.departmentId === id).count();
    if (inUse > 0) {
      throw new Error(`Cannot delete: ${inUse} employee(s) are assigned to this department`);
    }
    await db.departments.delete(id);
  }

  async employeeCount(id: number): Promise<number> {
    return db.employees.filter((e) => e.departmentId === id).count();
  }
}

function toDepartment(row: DepartmentRecord): Department {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
