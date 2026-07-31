import { IsOptional, IsUUID } from 'class-validator';

export class ReorderTaskDto {
  @IsOptional()
  @IsUUID('4')
  afterTaskId?: string | null;
}
