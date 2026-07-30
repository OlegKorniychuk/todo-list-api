import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { ListShare, listShares, todoLists, users } from '../../db/schema';
import { ListAccessService } from '../lists/list-access.service';
import { UsersService } from '../users/users.service';
import { CreateShareDto } from './dto/create-share.dto';

export interface ShareResource {
  id: string;
  listId: string;
  userId: string;
  email: string;
  createdAt: Date;
}

@Injectable()
export class SharesService {
  private readonly PG_UNIQUE_VIOLATION = '23505';

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly listAccessService: ListAccessService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    userId: string,
    listId: string,
    dto: CreateShareDto,
  ): Promise<ShareResource> {
    await this.assertOwner(userId, listId);

    const target = await this.usersService.findByEmail(dto.email);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.id === userId) {
      throw new UnprocessableEntityException(
        'Cannot share a list with yourself',
      );
    }

    try {
      const [share] = await this.db
        .insert(listShares)
        .values({ listId, userId: target.id })
        .returning();
      return this.toResource(share, target.email);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('List already shared with this user');
      }
      throw err;
    }
  }

  async findAll(userId: string, listId: string): Promise<ShareResource[]> {
    await this.assertOwner(userId, listId);

    const rows = await this.db
      .select({ share: listShares, email: users.email })
      .from(listShares)
      .innerJoin(users, eq(listShares.userId, users.id))
      .where(eq(listShares.listId, listId));

    return rows.map(({ share, email }) => this.toResource(share, email));
  }

  async remove(
    userId: string,
    listId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertOwner(userId, listId);

    const [deleted] = await this.db
      .delete(listShares)
      .where(
        and(eq(listShares.listId, listId), eq(listShares.userId, targetUserId)),
      )
      .returning();
    if (!deleted) {
      throw new NotFoundException('Share not found');
    }
  }

  /** Resolves owner access, throwing 404/403 as appropriate. */
  private async assertOwner(userId: string, listId: string): Promise<void> {
    const role = await this.listAccessService.resolve(userId, listId);
    if (role === 'owner') {
      return;
    }

    if (!role) {
      const [list] = await this.db
        .select({ id: todoLists.id })
        .from(todoLists)
        .where(eq(todoLists.id, listId))
        .limit(1);
      if (!list) {
        throw new NotFoundException('List not found');
      }
    }
    throw new ForbiddenException();
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: unknown }).code === this.PG_UNIQUE_VIOLATION
    );
  }

  private toResource(share: ListShare, email: string): ShareResource {
    return {
      id: share.id,
      listId: share.listId,
      userId: share.userId,
      email,
      createdAt: share.createdAt,
    };
  }
}
