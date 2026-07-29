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
import { CreateListDto } from './dto/create-list.dto';
import { RenameListDto } from './dto/rename-list.dto';
import { ListsService } from './lists.service';

// TODO: @UseGuards(JwtAuthGuard) + resolve real user id from request.
const TODO_USER_ID = 'TODO-user-id';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  create(@Body() dto: CreateListDto) {
    return this.listsService.create(TODO_USER_ID, dto);
  }

  @Get()
  findAll(@Query('role') role?: 'owner' | 'viewer') {
    return this.listsService.findAllForUser(TODO_USER_ID, role);
  }

  @Get(':listId')
  findOne(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.listsService.findOne(TODO_USER_ID, listId);
  }

  @Patch(':listId')
  rename(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: RenameListDto,
  ) {
    return this.listsService.rename(TODO_USER_ID, listId, dto);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.listsService.remove(TODO_USER_ID, listId);
  }
}
