import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.constants';
import { Database } from '../../db/drizzle.types';
import { TaskStatus } from '../../db/schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TasksService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  create(_userId: string, _listId: string, _dto: CreateTaskDto): never {
    void this.db;
    throw new NotImplementedException('TasksService.create not implemented');
  }

  findAll(_userId: string, _listId: string, _status?: TaskStatus): never {
    throw new NotImplementedException('TasksService.findAll not implemented');
  }

  findOne(_userId: string, _listId: string, _taskId: string): never {
    throw new NotImplementedException('TasksService.findOne not implemented');
  }

  update(
    _userId: string,
    _listId: string,
    _taskId: string,
    _dto: UpdateTaskDto,
  ): never {
    throw new NotImplementedException('TasksService.update not implemented');
  }

  updateStatus(
    _userId: string,
    _listId: string,
    _taskId: string,
    _dto: UpdateTaskStatusDto,
  ): never {
    throw new NotImplementedException(
      'TasksService.updateStatus not implemented',
    );
  }

  remove(_userId: string, _listId: string, _taskId: string): never {
    throw new NotImplementedException('TasksService.remove not implemented');
  }
}
