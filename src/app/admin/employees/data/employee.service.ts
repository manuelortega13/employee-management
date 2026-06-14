import { Injectable } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { db } from '../../../data/db';
import { hashPassword } from '../../../data/password';
import { EmployeeRecord } from '../../../data/types';
import { Employee, EmployeeCreateRequest, EmployeeUpdateRequest } from './employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  findAll(): Observable<Employee[]> {
    return defer(() => from(this.queryAll()));
  }

  findById(id: number): Observable<Employee> {
    return defer(() => from(this.queryById(id)));
  }

  create(request: EmployeeCreateRequest): Observable<Employee> {
    return defer(() => from(this.insert(request)));
  }

  update(id: number, request: EmployeeUpdateRequest): Observable<Employee> {
    return defer(() => from(this.applyUpdate(id, request)));
  }

  delete(id: number): Observable<void> {
    return defer(() => from(db.employees.delete(id).then(() => undefined)));
  }

  private async queryAll(): Promise<Employee[]> {
    const rows = await db.employees.orderBy('id').toArray();
    return rows.map(toEmployee);
  }

  private async queryById(id: number): Promise<Employee> {
    const row = await db.employees.get(id);
    if (!row) throw new Error('Employee not found');
    return toEmployee(row);
  }

  private async insert(request: EmployeeCreateRequest): Promise<Employee> {
    const email = request.email.trim().toLowerCase();
    const existing = await db.employees.where('email').equalsIgnoreCase(email).first();
    if (existing) throw new Error('An employee with this email already exists');
    if (!request.password) throw new Error('Password is required');

    const { hash, salt } = await hashPassword(request.password);
    const now = new Date().toISOString();
    const id = await db.employees.add({
      id: undefined as unknown as number,
      firstName: request.firstName,
      lastName: request.lastName,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      phone: request.phone ?? '',
      position: request.position ?? '',
      departmentId: request.departmentId ?? null,
      role: request.role,
      hireDate: request.hireDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return this.queryById(id as number);
  }

  private async applyUpdate(id: number, request: EmployeeUpdateRequest): Promise<Employee> {
    const existing = await db.employees.get(id);
    if (!existing) throw new Error('Employee not found');

    if (request.email !== undefined) {
      const email = request.email.trim().toLowerCase();
      const conflict = await db.employees.where('email').equalsIgnoreCase(email).first();
      if (conflict && conflict.id !== id) {
        throw new Error('An employee with this email already exists');
      }
    }

    const patch: Partial<EmployeeRecord> = {
      updatedAt: new Date().toISOString(),
    };
    if (request.firstName !== undefined) patch.firstName = request.firstName;
    if (request.lastName !== undefined) patch.lastName = request.lastName;
    if (request.email !== undefined) patch.email = request.email.trim().toLowerCase();
    if (request.phone !== undefined) patch.phone = request.phone;
    if (request.position !== undefined) patch.position = request.position;
    if (request.departmentId !== undefined) patch.departmentId = request.departmentId;
    if (request.role !== undefined) patch.role = request.role;
    if (request.hireDate !== undefined) patch.hireDate = request.hireDate;
    if (request.isActive !== undefined) patch.isActive = request.isActive;

    if (request.password) {
      const { hash, salt } = await hashPassword(request.password);
      patch.passwordHash = hash;
      patch.passwordSalt = salt;
    }

    await db.employees.update(id, patch);
    return this.queryById(id);
  }
}

function toEmployee(row: EmployeeRecord): Employee {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    position: row.position,
    departmentId: row.departmentId,
    role: row.role,
    hireDate: row.hireDate,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
