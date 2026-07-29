import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';

/**
 * Stub guard for JWT-protected routes.
 *
 * TODO: verify the `Authorization: Bearer <token>` access token, then attach the
 * resolved user to `request.user`. Apply via `@UseGuards(JwtAuthGuard)` on
 * protected controllers/handlers once implemented.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    throw new NotImplementedException('JWT auth guard not implemented');
  }
}
