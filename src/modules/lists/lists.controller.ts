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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateListDto } from './dto/create-list.dto';
import { RenameListDto } from './dto/rename-list.dto';
import { ListsService } from './lists.service';

@ApiTags('lists')
@ApiBearerAuth('access-token')
@Controller('lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateListDto) {
    return await this.listsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('role') role?: 'owner' | 'viewer',
  ) {
    return { data: await this.listsService.findAllForUser(userId, role) };
  }

  @Get(':listId')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return await this.listsService.findOne(userId, listId);
  }

  @Patch(':listId')
  async rename(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: RenameListDto,
  ) {
    return await this.listsService.rename(userId, listId, dto);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return await this.listsService.remove(userId, listId);
  }
}
