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
export interface RoleSimple {
  id: number;
  code: string;
  name: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  roles?: RoleSimple[];  // 新增：用户的角色列表
  is_active: boolean;
  is_superuser?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  refresh_expires_in?: number;
  user?: User;
}

// 角色和权限相关类型
export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  module: string;
  created_at: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  permissions?: Permission[];
  permission_count?: number;
}

export interface RoleCreate {
  code?: string;  // 可选，系统会自动生成
  name: string;
  description?: string;
  is_active?: boolean;
  permission_ids: number[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
  permission_ids?: number[];
}

export interface UserCreate {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role_ids: number[];
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role_ids?: number[];
  is_active?: boolean;
}


// 项目相关类型
export interface Project {
  id: number;
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_id?: number | null;
  sponsor?: Organization | null;
  clinical_org?: Organization | null;
  clinical_orgs?: Organization[];  // 支持多个临床机构
  sample_code_rule?: Record<string, any> | null;
  is_active: boolean;
  is_archived: boolean;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ProjectCreate {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_id?: number | null;
  clinical_org_ids?: number[];  // 支持多个临床机构
  sample_code_rule?: Record<string, any> | null;
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

// 组织类型
export interface OrganizationType {
  id: number;
  value: string;
  label: string;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
}

export interface OrganizationTypeCreate {
  value: string;
  label: string;
  display_order?: number;
}

export interface OrganizationTypeUpdate {
  label?: string;
  display_order?: number;
  is_active?: boolean;
}

// 组织相关类型
export interface Organization {
  id: number;
  name: string;
  // 后端实际枚举：sponsor | clinical | testing | transport（也可能扩展）
  org_type: 'sponsor' | 'clinical' | 'testing' | 'transport' | string;
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
  org_type: 'sponsor' | 'clinical' | 'testing' | 'transport' | string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface OrganizationUpdate extends OrganizationCreate {
  audit_reason: string;
}

// 项目-组织关联（项目维度补充信息）
export interface ProjectOrganizationLink {
  id: number;
  project_id: number;
  organization_id: number;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  organization: Organization;
}

export interface ProjectOrganizationLinkCreate {
  organization_id: number;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
}

export interface ProjectOrganizationLinkUpdate extends ProjectOrganizationLinkCreate {
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
  deviation_code: string;
  title: string;
  description: string;
  category: string;
  severity: 'minor' | 'major' | 'critical';
  status: string;
  reported_by: number;
  impact_assessment: string;
  immediate_action?: string;
  project_id?: number;
  created_at: string;
  updated_at: string;
}

export interface DeviationCreate {
  title: string;
  severity: 'minor' | 'major' | 'critical';
  category: string;
  description: string;
  impact_assessment: string;
  immediate_action?: string;
  project_id?: number | null;
  sample_ids?: number[];
}

// 任务中心
export type TaskCategory = 'borrow' | 'return' | 'transfer' | 'destroy';

export interface TaskItem {
  id: number;
  category: TaskCategory;
  project_id: number;
  project_code?: string | null;
  sponsor_project_code?: string | null;
  title: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  due_at?: string | null;
  requester?: string | null;
  assignee?: string | null;
  sample_count?: number | null;
  action_required: boolean;
  metadata: Record<string, any>;
}

export interface TaskOverview {
  borrow: TaskItem[];
  return: TaskItem[];
  transfer: TaskItem[];
  destroy: TaskItem[];
}

// 统计相关类型
export interface Statistics {
  total_samples: number;
  in_storage: number;
  checked_out: number;
  transferred: number;
  destroyed: number;
  avg_storage_days: number;
  total_exposure_time: number;
  exposure_events: number;
  // 为了兼容角色统计，添加一些可选字段
  total_users?: number;
  total_projects?: number;
  active_projects?: number;
  pending_approvals?: number;
  approved_today?: number;
  my_tasks?: number;
  my_samples?: number;
  completed_today?: number;
  pending_tasks?: number;
  processed_today?: number;
  audit_logs_today?: number;
  // 实时系统数据
  active_users?: number;
  daily_activities?: number;
}
