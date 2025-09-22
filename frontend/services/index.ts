// 先导入所有服务
import { AuthService } from './auth.service';
import { ProjectsService } from './projects.service';
import { SamplesService } from './samples.service';
import { GlobalParamsService } from './global-params.service';
import { UsersService } from './users.service';
import { AuditService } from './audit.service';
import { DeviationsService } from './deviations.service';
import { StatisticsService } from './statistics.service';
import { ArchiveService } from './archive.service';
import { TasksService } from './tasks.service';

// 统一导出所有服务
export {
  AuthService,
  ProjectsService,
  SamplesService,
  GlobalParamsService,
  UsersService,
  AuditService,
  DeviationsService,
  StatisticsService,
  ArchiveService,
  TasksService,
};

// 为了方便使用，也可以创建一个统一的 API 对象
export const API = {
  auth: AuthService,
  projects: ProjectsService,
  samples: SamplesService,
  globalParams: GlobalParamsService,
  users: UsersService,
  audit: AuditService,
  deviations: DeviationsService,
  statistics: StatisticsService,
  archive: ArchiveService,
  tasks: TasksService,
} as const;
