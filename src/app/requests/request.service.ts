import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { db } from '../data/db';
import { RequestStatus, RequestType, TimeOffRequestRecord } from '../data/types';

export interface TimeOffRequest {
  id: number;
  employeeId: number;
  type: RequestType;
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequest {
  type: RequestType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface DecisionRequest {
  status: 'APPROVED' | 'REJECTED';
  decisionNote: string;
}

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly auth = inject(AuthService);

  async findMine(): Promise<TimeOffRequest[]> {
    const user = this.auth.user();
    if (!user) return [];
    const rows = await db.requests.where('employeeId').equals(user.id).toArray();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toRequest);
  }

  async findAll(): Promise<TimeOffRequest[]> {
    const rows = await db.requests.toArray();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toRequest);
  }

  async findByStatus(status: RequestStatus): Promise<TimeOffRequest[]> {
    const rows = await db.requests.where('status').equals(status).toArray();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toRequest);
  }

  async create(request: CreateRequest): Promise<TimeOffRequest> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in to submit a request');

    if (!request.startDate || !request.endDate) {
      throw new Error('Start and end dates are required');
    }
    if (request.startDate > request.endDate) {
      throw new Error('End date must be on or after start date');
    }
    if (!request.reason.trim()) {
      throw new Error('Please provide a reason');
    }

    const now = new Date().toISOString();
    const id = await db.requests.add({
      id: undefined as unknown as number,
      employeeId: user.id,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason.trim(),
      status: 'PENDING',
      decisionNote: null,
      decidedById: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const row = await db.requests.get(id as number);
    return toRequest(row!);
  }

  async cancel(id: number): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in');
    const row = await db.requests.get(id);
    if (!row) throw new Error('Request not found');
    if (row.employeeId !== user.id) throw new Error('You can only cancel your own requests');
    if (row.status !== 'PENDING') throw new Error('Only pending requests can be cancelled');
    await db.requests.update(id, {
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    });
  }

  async decide(id: number, decision: DecisionRequest): Promise<void> {
    const user = this.auth.user();
    if (!user || user.role !== 'ADMIN') throw new Error('Only admins can approve or reject');
    const row = await db.requests.get(id);
    if (!row) throw new Error('Request not found');
    if (row.status !== 'PENDING') throw new Error('Only pending requests can be decided');

    const now = new Date().toISOString();
    await db.requests.update(id, {
      status: decision.status,
      decisionNote: decision.decisionNote.trim() || null,
      decidedById: user.id,
      decidedAt: now,
      updatedAt: now,
    });
  }

  countPending(): Promise<number> {
    return db.requests.where('status').equals('PENDING').count();
  }
}

function toRequest(row: TimeOffRequestRecord): TimeOffRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status,
    decisionNote: row.decisionNote,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
