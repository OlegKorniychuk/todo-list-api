import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findById(_id: string): never {
    void this.db;
    throw new NotImplementedException('UsersService.findById not implemented');
  }

  findByEmail(_email: string): never {
    throw new NotImplementedException(
      'UsersService.findByEmail not implemented',
    );
  }

  create(_email: string, _passwordHash: string): never {
    throw new NotImplementedException('UsersService.create not implemented');
  }
}
