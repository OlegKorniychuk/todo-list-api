import { IsIn } from 'class-validator';
import { TaskStatus, taskStatus } from '../../../db/schema';

export class UpdateTaskStatusDto {
  @IsIn(taskStatus.enumValues)
  status!: TaskStatus;
}
