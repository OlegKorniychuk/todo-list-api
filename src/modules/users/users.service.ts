import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/db/pg-error';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { NewUser, User, users } from '../../db/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return user;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const newUser: NewUser = { email: email.toLowerCase(), passwordHash };
    try {
      const [user] = await this.db.insert(users).values(newUser).returning();
      return user;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }
}
