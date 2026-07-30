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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateShareDto } from './dto/create-share.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@ApiBearerAuth('access-token')
@Controller('lists/:listId/shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateShareDto,
  ) {
    return await this.sharesService.create(userId, listId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return { data: await this.sharesService.findAll(userId, listId) };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') callerId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return await this.sharesService.remove(callerId, listId, targetUserId);
  }
}
