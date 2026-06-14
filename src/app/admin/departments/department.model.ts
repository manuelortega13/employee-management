export interface Department {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentCreateRequest {
  name: string;
  description: string;
}

export interface DepartmentUpdateRequest {
  name?: string;
  description?: string;
}
