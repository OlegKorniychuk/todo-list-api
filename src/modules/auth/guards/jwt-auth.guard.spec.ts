import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  let guard: JwtAuthGuard;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  const contextWithHeaders = (headers: Record<string, string>) => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    return {
      request,
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext,
    };
  };

  it('throws UnauthorizedException when no Authorization header is present', async () => {
    const { context } = contextWithHeaders({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the header is not a Bearer token', async () => {
    const { context } = contextWithHeaders({ authorization: 'Basic abc' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the token is invalid or expired', async () => {
    const { context } = contextWithHeaders({ authorization: 'Bearer bad' });
    mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the token subject no longer exists', async () => {
    const { context } = contextWithHeaders({ authorization: 'Bearer good' });
    mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
    mockUsersService.findById.mockResolvedValueOnce(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the resolved user to the request and allows access', async () => {
    const { context, request } = contextWithHeaders({
      authorization: 'Bearer good',
    });
    const user = { id: 'user-1', email: 'a@b.com' };
    mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
    mockUsersService.findById.mockResolvedValueOnce(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(mockUsersService.findById).toHaveBeenCalledWith('user-1');
  });
});
