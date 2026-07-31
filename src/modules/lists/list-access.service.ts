import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { listShares, todoLists } from '../../db/schema';

export type ListAccessRole = 'owner' | 'viewer' | null;

@Injectable()
export class ListAccessService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async resolve(userId: string, listId: string): Promise<ListAccessRole> {
    const [list] = await this.db
      .select({ ownerId: todoLists.ownerId })
      .from(todoLists)
      .where(eq(todoLists.id, listId))
      .limit(1);

    if (!list) return null;
    if (list.ownerId === userId) return 'owner';

    const [share] = await this.db
      .select({ id: listShares.id })
      .from(listShares)
      .where(and(eq(listShares.listId, listId), eq(listShares.userId, userId)))
      .limit(1);

    return share ? 'viewer' : null;
  }
}
