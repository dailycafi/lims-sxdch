// API 响应类型定义

// 基础响应类型
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 用户相关类型
export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// 项目相关类型
export interface Project {
  id: number;
  code: string;
  name: string;
  applicant_org_id: number;
  applicant_org?: Organization;
  start_date: string;
  expected_end_date: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  code: string;
  name: string;
  applicant_org_id: number;
  start_date: string;
  expected_end_date: string;
}

// 样本相关类型
export interface Sample {
  id: number;
  code: string;
  name: string;
  project_id: number;
  project?: Project;
  sample_type_id: number;
  sample_type?: SampleType;
  quantity: number;
  unit: string;
  storage_location: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SampleCreate {
  code: string;
  name: string;
  project_id: number;
  sample_type_id: number;
  quantity: number;
  unit: string;
  storage_location: string;
}

export interface SampleBorrowRequest {
  sample_id: number;
  quantity: number;
  unit: string;
  purpose: string;
  expected_return_date: string;
  borrower_name: string;
  borrower_contact: string;
}

export interface SampleTransferRequest {
  sample_id: number;
  from_location: string;
  to_location: string;
  quantity: number;
  unit: string;
  reason: string;
  target_org_id?: number;
}

// 组织相关类型
export interface Organization {
  id: number;
  name: string;
  org_type: 'internal' | 'external';
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  org_type: 'internal' | 'external';
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface OrganizationUpdate extends OrganizationCreate {
  audit_reason: string;
}

// 样本类型相关
export interface SampleType {
  id: number;
  code: string;
  name: string;
  description?: string;
  specifications?: string;
  storage_conditions?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SampleTypeCreate {
  code: string;
  name: string;
  description?: string;
  specifications?: string;
  storage_conditions?: string;
}

export interface SampleTypeUpdate extends SampleTypeCreate {
  audit_reason: string;
}

// 审计日志类型
export interface AuditLog {
  id: number;
  user_id: number;
  user?: User;
  entity_type: string;
  entity_id: number;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

// 偏差管理类型
export interface Deviation {
  id: number;
  code: string;
  title: string;
  description: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DeviationCreate {
  title: string;
  description: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
}

// 统计相关类型
export interface Statistics {
  samples_total: number;
  samples_by_status: Record<string, number>;
  projects_total: number;
  projects_by_status: Record<string, number>;
  recent_activities: AuditLog[];
}
