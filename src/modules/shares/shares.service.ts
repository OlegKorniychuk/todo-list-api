import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { CreateShareDto } from './dto/create-share.dto';

@Injectable()
export class SharesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  create(_userId: string, _listId: string, _dto: CreateShareDto): never {
    void this.db;
    throw new NotImplementedException('SharesService.create not implemented');
  }

  findAll(_userId: string, _listId: string): never {
    throw new NotImplementedException('SharesService.findAll not implemented');
  }

  remove(_userId: string, _listId: string, _targetUserId: string): never {
    throw new NotImplementedException('SharesService.remove not implemented');
  }
}
