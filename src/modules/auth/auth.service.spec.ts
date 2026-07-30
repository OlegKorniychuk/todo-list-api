import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { hashToken } from '../../common/crypto/token';
import { DRIZZLE } from '../../db/drizzle.constants';
import { refreshTokens } from '../../db/schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('../../common/crypto/password');

const mockedHashPassword = hashPassword as jest.Mock;
const mockedVerifyPassword = verifyPassword as jest.Mock;

describe('AuthService', () => {
  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  const mockDb = {
    insert: jest.fn(),
    values: jest.fn(),
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
  };

  let service: AuthService;

  const NOW_SECONDS = Math.floor(Date.now() / 1000);

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue(undefined);
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();

    mockConfigService.getOrThrow.mockReturnValue('refresh-secret');
    mockConfigService.get.mockReturnValue('7d');

    mockJwtService.signAsync
      .mockResolvedValueOnce('access.jwt.token')
      .mockResolvedValueOnce('refresh.jwt.token');
    mockJwtService.decode.mockReturnValue({ exp: NOW_SECONDS + 7 * 86400 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, creates the user, and issues a token pair', async () => {
      mockedHashPassword.mockResolvedValueOnce('hashed-password');
      const user = {
        id: 'user-1',
        email: 'new@x.com',
        passwordHash: 'hashed-password',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockUsersService.create.mockResolvedValueOnce(user);

      const result = await service.register({
        email: 'new@x.com',
        password: 'P@ssw0rd123',
      });

      expect(mockedHashPassword).toHaveBeenCalledWith('P@ssw0rd123');
      expect(mockUsersService.create).toHaveBeenCalledWith(
        'new@x.com',
        'hashed-password',
      );
      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'new@x.com',
          createdAt: user.createdAt,
        },
        accessToken: 'access.jwt.token',
        refreshToken: 'refresh.jwt.token',
      });
    });

    it('persists a hashed refresh token row', async () => {
      mockedHashPassword.mockResolvedValueOnce('hashed-password');
      mockUsersService.create.mockResolvedValueOnce({
        id: 'user-1',
        email: 'new@x.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register({ email: 'new@x.com', password: 'P@ssw0rd123' });

      expect(mockDb.insert).toHaveBeenCalledWith(refreshTokens);
      expect(mockDb.values).toHaveBeenCalledWith({
        userId: 'user-1',
        tokenHash: hashToken('refresh.jwt.token'),
        expiresAt: new Date((NOW_SECONDS + 7 * 86400) * 1000),
      });
    });

    it('propagates ConflictException on duplicate email', async () => {
      mockedHashPassword.mockResolvedValueOnce('hashed-password');
      mockUsersService.create.mockRejectedValueOnce(
        new ConflictException('Email already registered'),
      );

      await expect(
        service.register({ email: 'dup@x.com', password: 'P@ssw0rd123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token pair for correct credentials, without a user key', async () => {
      const user = {
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsersService.findByEmail.mockResolvedValueOnce(user);
      mockedVerifyPassword.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'a@b.com',
        password: 'P@ssw0rd123',
      });

      expect(mockedVerifyPassword).toHaveBeenCalledWith(
        'P@ssw0rd123',
        'hashed-password',
      );
      expect(result).toEqual({
        accessToken: 'access.jwt.token',
        refreshToken: 'refresh.jwt.token',
      });
      expect(mockDb.insert).toHaveBeenCalledWith(refreshTokens);
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(undefined);

      await expect(
        service.login({ email: 'nobody@x.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockedVerifyPassword).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockedVerifyPassword.mockResolvedValueOnce(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const presentedToken = 'presented.refresh.jwt';
    const activeRow = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken(presentedToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400_000),
    };

    it('rotates a valid token: revokes the old row and issues a new pair', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockDb.limit.mockResolvedValueOnce([activeRow]);

      const result = await service.refresh({ refreshToken: presentedToken });

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(presentedToken, {
        secret: 'refresh-secret',
      });
      expect(mockDb.update).toHaveBeenCalledWith(refreshTokens);
      expect(result).toEqual({
        accessToken: 'access.jwt.token',
        refreshToken: 'refresh.jwt.token',
      });
    });

    it('throws UnauthorizedException when the JWT is invalid or expired', async () => {
      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('expired'));

      await expect(
        service.refresh({ refreshToken: presentedToken }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockDb.limit).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no matching row exists', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.refresh({ refreshToken: presentedToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the row is already revoked (reuse)', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockDb.limit.mockResolvedValueOnce([
        { ...activeRow, revokedAt: new Date() },
      ]);

      await expect(
        service.refresh({ refreshToken: presentedToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the row is expired', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockDb.limit.mockResolvedValueOnce([
        { ...activeRow, expiresAt: new Date(Date.now() - 1000) },
      ]);

      await expect(
        service.refresh({ refreshToken: presentedToken }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the user active refresh tokens', async () => {
      await service.logout('user-1');

      expect(mockDb.update).toHaveBeenCalledWith(refreshTokens);
      expect(mockDb.set).toHaveBeenCalled();
    });
  });
});
