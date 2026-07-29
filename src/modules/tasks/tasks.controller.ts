import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TaskStatus } from '../../db/schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

// TODO: @UseGuards(JwtAuthGuard) + resolve real user id from request.
const TODO_USER_ID = 'TODO-user-id';

@Controller('lists/:listId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(TODO_USER_ID, listId, dto);
  }

  @Get()
  findAll(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasksService.findAll(TODO_USER_ID, listId, status);
  }

  @Get(':taskId')
  findOne(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasksService.findOne(TODO_USER_ID, listId, taskId);
  }

  @Patch(':taskId')
  update(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(TODO_USER_ID, listId, taskId, dto);
  }

  @Patch(':taskId/status')
  updateStatus(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(TODO_USER_ID, listId, taskId, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.tasksService.remove(TODO_USER_ID, listId, taskId);
  }
}
