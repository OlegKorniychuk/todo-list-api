import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(AuthController);
  });

  it('delegates register to AuthService', async () => {
    const dto = { email: 'a@b.com', password: 'P@ssw0rd123' };
    mockAuthService.register.mockResolvedValueOnce('registered');

    await expect(controller.register(dto)).resolves.toBe('registered');
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login to AuthService', async () => {
    const dto = { email: 'a@b.com', password: 'P@ssw0rd123' };
    mockAuthService.login.mockResolvedValueOnce('logged-in');

    await expect(controller.login(dto)).resolves.toBe('logged-in');
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates refresh to AuthService', async () => {
    const dto = { refreshToken: 'a.b.c' };
    mockAuthService.refresh.mockResolvedValueOnce('refreshed');

    await expect(controller.refresh(dto)).resolves.toBe('refreshed');
    expect(mockAuthService.refresh).toHaveBeenCalledWith(dto);
  });

  it('delegates logout to AuthService with the current user id', async () => {
    await controller.logout('user-1');

    expect(mockAuthService.logout).toHaveBeenCalledWith('user-1');
  });

  it('returns the current user shaped without the password hash', () => {
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: 'secret-hash',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(controller.me(user as never)).toEqual({
      id: 'user-1',
      email: 'a@b.com',
      createdAt: user.createdAt,
    });
  });
});
