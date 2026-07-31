import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { listShares, TodoList, todoLists } from '../../db/schema';
import { CreateListDto } from './dto/create-list.dto';
import { RenameListDto } from './dto/rename-list.dto';
import { ListAccessService } from './list-access.service';

export interface ListResource {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ListsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly listAccessService: ListAccessService,
  ) {}

  async create(userId: string, dto: CreateListDto): Promise<ListResource> {
    const [list] = await this.db
      .insert(todoLists)
      .values({ ownerId: userId, name: dto.name })
      .returning();
    return this.toResource(list, 'owner');
  }

  async findAllForUser(
    userId: string,
    role?: 'owner' | 'viewer',
  ): Promise<ListResource[]> {
    const resources: ListResource[] = [];

    if (!role || role === 'owner') {
      const owned = await this.db
        .select()
        .from(todoLists)
        .where(eq(todoLists.ownerId, userId))
        .orderBy(asc(todoLists.createdAt));
      resources.push(...owned.map((list) => this.toResource(list, 'owner')));
    }

    if (!role || role === 'viewer') {
      const shared = await this.db
        .select({ list: todoLists })
        .from(listShares)
        .innerJoin(todoLists, eq(listShares.listId, todoLists.id))
        .where(eq(listShares.userId, userId))
        .orderBy(asc(todoLists.createdAt));
      resources.push(
        ...shared.map(({ list }) => this.toResource(list, 'viewer')),
      );
    }

    // Owned and shared lists come from two separate queries; each is sorted
    // internally, but the concatenation above isn't globally ordered when
    // both blocks are present (e.g. a newer owned list next to an older
    // shared one), so re-sort the merged result once.
    resources.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return resources;
  }

  async findOne(userId: string, listId: string): Promise<ListResource> {
    const list = await this.findListOrThrow(listId);

    const role = await this.listAccessService.resolve(userId, listId);
    if (!role) {
      throw new ForbiddenException();
    }

    return this.toResource(list, role);
  }

  async rename(
    userId: string,
    listId: string,
    dto: RenameListDto,
  ): Promise<ListResource> {
    const list = await this.findListOrThrow(listId);
    if (list.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const [updated] = await this.db
      .update(todoLists)
      .set({ name: dto.name, updatedAt: new Date() })
      .where(eq(todoLists.id, listId))
      .returning();

    return this.toResource(updated, 'owner');
  }

  async remove(userId: string, listId: string): Promise<void> {
    const list = await this.findListOrThrow(listId);
    if (list.ownerId !== userId) {
      throw new ForbiddenException();
    }

    await this.db.delete(todoLists).where(eq(todoLists.id, listId));
  }

  private async findListOrThrow(listId: string): Promise<TodoList> {
    const [list] = await this.db
      .select()
      .from(todoLists)
      .where(eq(todoLists.id, listId))
      .limit(1);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    return list;
  }

  private toResource(list: TodoList, role: 'owner' | 'viewer'): ListResource {
    return {
      id: list.id,
      name: list.name,
      ownerId: list.ownerId,
      role,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }
}
