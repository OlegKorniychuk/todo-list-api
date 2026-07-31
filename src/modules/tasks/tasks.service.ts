import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, max, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { Task, TaskStatus, tasks, todoLists } from '../../db/schema';
import { ListAccessService } from '../lists/list-access.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

const POSITION_GAP = 65536;

export interface TaskResource {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
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

    const [{ maxPosition }] = await this.db
      .select({ maxPosition: max(tasks.position) })
      .from(tasks)
      .where(eq(tasks.listId, listId));
    const position = (maxPosition ?? 0) + POSITION_GAP;

    const [task] = await this.db
      .insert(tasks)
      .values({
        listId,
        title: dto.title,
        description: dto.description,
        position,
      })
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

    const rows = await this.db
      .select()
      .from(tasks)
      .where(conditions)
      .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));
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

  async reorder(
    userId: string,
    listId: string,
    taskId: string,
    dto: ReorderTaskDto,
  ): Promise<TaskResource> {
    await this.assertRole(userId, listId, 'owner');

    if (dto.afterTaskId === taskId) {
      throw new BadRequestException(
        'A task cannot be reordered relative to itself',
      );
    }

    return await this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.listId, listId)))
        .limit(1);
      if (!task) {
        throw new NotFoundException('Task not found');
      }

      // Excluding the moved task up front means the neighbor lookup below
      // never has to special-case "moving next to its own current position".
      const siblings = await tx
        .select({
          id: tasks.id,
          position: tasks.position,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(and(eq(tasks.listId, listId), ne(tasks.id, taskId)))
        .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));

      let leftIndex = -1;
      if (dto.afterTaskId) {
        leftIndex = siblings.findIndex((s) => s.id === dto.afterTaskId);
        if (leftIndex === -1) {
          throw new NotFoundException('afterTaskId not found in this list');
        }
      }

      const leftPosition =
        leftIndex === -1 ? null : siblings[leftIndex].position;
      const rightPosition =
        leftIndex + 1 < siblings.length
          ? siblings[leftIndex + 1].position
          : null;
      const newPosition = this.computeMidpoint(leftPosition, rightPosition);
      const degenerate =
        newPosition <= (leftPosition ?? 0) ||
        (rightPosition !== null && newPosition >= rightPosition);

      if (!degenerate) {
        const [updated] = await tx
          .update(tasks)
          .set({ position: newPosition, updatedAt: new Date() })
          .where(eq(tasks.id, taskId))
          .returning();
        return this.toResource(updated);
      }

      // Float precision between these two neighbors is exhausted (repeated
      // inserts into the same gap) — renumber the whole list instead.
      const orderedIds = siblings.map((s) => s.id);
      orderedIds.splice(leftIndex + 1, 0, taskId);

      let movedResource: TaskResource | undefined;
      for (const [index, id] of orderedIds.entries()) {
        const position = (index + 1) * POSITION_GAP;
        const isMovedTask = id === taskId;
        const [row] = await tx
          .update(tasks)
          .set(isMovedTask ? { position, updatedAt: new Date() } : { position })
          .where(eq(tasks.id, id))
          .returning();
        if (isMovedTask) {
          movedResource = this.toResource(row);
        }
      }
      return movedResource!;
    });
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

  private computeMidpoint(lower: number | null, upper: number | null): number {
    if (lower === null && upper === null) return POSITION_GAP;
    if (lower === null) return upper! / 2;
    if (upper === null) return lower + POSITION_GAP;
    return (lower + upper) / 2;
  }

  private toResource(task: Task): TaskResource {
    return {
      id: task.id,
      listId: task.listId,
      title: task.title,
      description: task.description,
      status: task.status,
      position: task.position,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
