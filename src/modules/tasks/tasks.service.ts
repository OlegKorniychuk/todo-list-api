import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { Task, TaskStatus, tasks, todoLists } from '../../db/schema';
import { ListAccessService } from '../lists/list-access.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

export interface TaskResource {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TasksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly listAccessService: ListAccessService,
  ) {}

  async create(
    userId: string,
    listId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResource> {
    await this.assertRole(userId, listId, 'owner');

    const [task] = await this.db
      .insert(tasks)
      .values({ listId, title: dto.title, description: dto.description })
      .returning();

    return this.toResource(task);
  }

  async findAll(
    userId: string,
    listId: string,
    status?: TaskStatus,
  ): Promise<TaskResource[]> {
    await this.assertRole(userId, listId);

    const conditions = status
      ? and(eq(tasks.listId, listId), eq(tasks.status, status))
      : eq(tasks.listId, listId);

    const rows = await this.db.select().from(tasks).where(conditions);
    return rows.map((task) => this.toResource(task));
  }

  async findOne(
    userId: string,
    listId: string,
    taskId: string,
  ): Promise<TaskResource> {
    await this.assertRole(userId, listId);
    const task = await this.findTaskOrThrow(listId, taskId);
    return this.toResource(task);
  }

  async update(
    userId: string,
    listId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResource> {
    await this.assertRole(userId, listId, 'owner');
    await this.findTaskOrThrow(listId, taskId);

    const [updated] = await this.db
      .update(tasks)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    return this.toResource(updated);
  }

  async updateStatus(
    userId: string,
    listId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<TaskResource> {
    await this.assertRole(userId, listId, 'owner');
    await this.findTaskOrThrow(listId, taskId);

    const [updated] = await this.db
      .update(tasks)
      .set({ status: dto.status, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    return this.toResource(updated);
  }

  async remove(userId: string, listId: string, taskId: string): Promise<void> {
    await this.assertRole(userId, listId, 'owner');
    await this.findTaskOrThrow(listId, taskId);

    await this.db.delete(tasks).where(eq(tasks.id, taskId));
  }

  /** Resolves the caller's role on the list, throwing 404/403 as appropriate. */
  private async assertRole(
    userId: string,
    listId: string,
    requiredRole?: 'owner',
  ): Promise<void> {
    const role = await this.listAccessService.resolve(userId, listId);
    if (role && (!requiredRole || role === requiredRole)) {
      return;
    }

    if (!role) {
      await this.ensureListExists(listId);
    }
    throw new ForbiddenException();
  }

  private async ensureListExists(listId: string): Promise<void> {
    const [list] = await this.db
      .select({ id: todoLists.id })
      .from(todoLists)
      .where(eq(todoLists.id, listId))
      .limit(1);
    if (!list) {
      throw new NotFoundException('List not found');
    }
  }

  private async findTaskOrThrow(listId: string, taskId: string): Promise<Task> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.listId, listId)))
      .limit(1);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private toResource(task: Task): TaskResource {
    return {
      id: task.id,
      listId: task.listId,
      title: task.title,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
