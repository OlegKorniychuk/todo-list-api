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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskStatus } from '../../db/schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('lists/:listId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return await this.tasksService.create(userId, listId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Query('status') status?: TaskStatus,
  ) {
    return {
      data: await this.tasksService.findAll(userId, listId, status),
    };
  }

  @Get(':taskId')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return await this.tasksService.findOne(userId, listId, taskId);
  }

  @Patch(':taskId')
  async update(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return await this.tasksService.update(userId, listId, taskId, dto);
  }

  @Patch(':taskId/status')
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return await this.tasksService.updateStatus(userId, listId, taskId, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return await this.tasksService.remove(userId, listId, taskId);
  }
}
