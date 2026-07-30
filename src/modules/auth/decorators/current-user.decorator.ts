import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../../db/schema';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: User }>();
    return data ? request.user[data] : request.user;
  },
);
