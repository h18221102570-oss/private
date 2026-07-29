// 项目阶段枚举
export enum ProjectPhase {
  INITIATION = 'initiation',     // 前期
  DESIGN = 'design',             // 设计
  CONSTRUCTION = 'construction', // 施工
  ACCEPTANCE = 'acceptance',     // 竣工
  OPERATION = 'operation',       // 运营
}

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  [ProjectPhase.INITIATION]: '前期阶段',
  [ProjectPhase.DESIGN]: '设计阶段',
  [ProjectPhase.CONSTRUCTION]: '施工阶段',
  [ProjectPhase.ACCEPTANCE]: '竣工阶段',
  [ProjectPhase.OPERATION]: '运营阶段',
};

export const PHASE_ORDER: ProjectPhase[] = [
  ProjectPhase.INITIATION,
  ProjectPhase.DESIGN,
  ProjectPhase.CONSTRUCTION,
  ProjectPhase.ACCEPTANCE,
  ProjectPhase.OPERATION,
];

// 项目状态
export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SUSPENDED = 'suspended',
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: '规划中',
  [ProjectStatus.IN_PROGRESS]: '进行中',
  [ProjectStatus.COMPLETED]: '已完成',
  [ProjectStatus.SUSPENDED]: '已暂停',
};

// 文档分类
export enum DocumentCategory {
  DRAWING = 'drawing',
  CONTRACT = 'contract',
  REPORT = 'report',
  APPROVAL = 'approval',
  PLAN = 'plan',
  ACCEPTANCE_DOC = 'acceptance_doc',
  OTHER = 'other',
}

export const DOC_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  [DocumentCategory.DRAWING]: '图纸',
  [DocumentCategory.CONTRACT]: '合同',
  [DocumentCategory.REPORT]: '报告',
  [DocumentCategory.APPROVAL]: '审批文件',
  [DocumentCategory.PLAN]: '施工方案',
  [DocumentCategory.ACCEPTANCE_DOC]: '验收文件',
  [DocumentCategory.OTHER]: '其他',
};

// 用户角色
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '超级管理员',
  [UserRole.ADMIN]: '管理员',
  [UserRole.USER]: '普通用户',
};

export interface AdminInfo {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

// 文档
export interface Document {
  id: string;
  projectId: string;
  phase: ProjectPhase;
  name: string;
  category: DocumentCategory;
  fileData: string;         // base64 encoded
  fileType: string;         // mime type
  fileSize: number;         // bytes
  tags: string[];
  description: string;
  uploadedAt: string;       // ISO date string
  deleted: boolean;         // 是否已移入回收站
  deletedAt?: string;       // 删除时间
}

// 人员架构
export enum MemberRole {
  PROJECT_MANAGER = 'project_manager',
  ENGINEER = 'engineer',
  SUPERVISOR = 'supervisor',
  DESIGNER = 'designer',
  WORKER = 'worker',
  OTHER = 'other',
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.PROJECT_MANAGER]: '项目经理',
  [MemberRole.ENGINEER]: '工程师',
  [MemberRole.SUPERVISOR]: '监理',
  [MemberRole.DESIGNER]: '设计师',
  [MemberRole.WORKER]: '施工人员',
  [MemberRole.OTHER]: '其他',
};

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  phone: string;
  email: string;
  department: string;
  notes: string;
  createdAt: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  currentPhase: ProjectPhase;
  location: string;
  manager: string;
  budget: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  // 工程信息
  developer: string;        // 建设单位
  contractor: string;       // 施工单位
  designUnit: string;       // 设计单位
  supervisor: string;       // 监理单位
  projectType: string;      // 工程类型
  buildingArea: string;     // 建筑面积
  structureType: string;    // 结构类型
  floorCount: string;       // 层数
  // 关联人员
  memberIds: string[];
}

// 仪表盘统计
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalDocuments: number;
  phaseDistribution: Record<ProjectPhase, number>;
  recentUploads: Document[];
}

// 搜索筛选
export interface SearchFilters {
  keyword: string;
  projectId: string;
  phase?: ProjectPhase;
  category?: DocumentCategory;
}

// 任务状态
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: '待处理',
  [TaskStatus.IN_PROGRESS]: '进行中',
  [TaskStatus.COMPLETED]: '已完成',
};

// 任务优先级
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.HIGH]: '高',
  [TaskPriority.MEDIUM]: '中',
  [TaskPriority.LOW]: '低',
};

// 待办任务
export interface Task {
  id: string;
  projectId: string;      // 关联项目（空字符串表示全局任务）
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;       // 负责人
  dueDate: string;        // 截止日期
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
