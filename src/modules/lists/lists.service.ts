import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { CreateListDto } from './dto/create-list.dto';
import { RenameListDto } from './dto/rename-list.dto';

@Injectable()
export class ListsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  create(_userId: string, _dto: CreateListDto): never {
    void this.db;
    throw new NotImplementedException('ListsService.create not implemented');
  }

  findAllForUser(_userId: string, _role?: 'owner' | 'viewer'): never {
    throw new NotImplementedException(
      'ListsService.findAllForUser not implemented',
    );
  }

  findOne(_userId: string, _listId: string): never {
    throw new NotImplementedException('ListsService.findOne not implemented');
  }

  rename(_userId: string, _listId: string, _dto: RenameListDto): never {
    throw new NotImplementedException('ListsService.rename not implemented');
  }

  remove(_userId: string, _listId: string): never {
    throw new NotImplementedException('ListsService.remove not implemented');
  }
}
