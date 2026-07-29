import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateShareDto } from './dto/create-share.dto';
import { SharesService } from './shares.service';

// TODO: @UseGuards(JwtAuthGuard) + resolve real owner id from request.
const TODO_USER_ID = 'TODO-user-id';

@Controller('lists/:listId/shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  create(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.sharesService.create(TODO_USER_ID, listId, dto);
  }

  @Get()
  findAll(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.sharesService.findAll(TODO_USER_ID, listId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.sharesService.remove(TODO_USER_ID, listId, userId);
  }
}
