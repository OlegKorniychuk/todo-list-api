import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { ListAccessService } from '../lists/list-access.service';
import { UsersService } from '../users/users.service';
import { SharesService } from './shares.service';

// Mimics drizzle's query builder: chainable, and awaitable (thenable) at any
// point in the chain, so both `.limit(1)`-terminated and bare `.where(...)`
// queries resolve to the same fixture without needing a real query builder.
function chain(result: unknown) {
  const node: Record<string, unknown> = {
    from: jest.fn(() => node),
    where: jest.fn(() => node),
    limit: jest.fn(() => node),
    values: jest.fn(() => node),
    innerJoin: jest.fn(() => node),
    returning: jest.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected as never),
  };
  return node;
}

function rejectingChain(err: unknown) {
  const node: Record<string, unknown> = {
    values: jest.fn(() => node),
    returning: jest.fn().mockRejectedValueOnce(err),
  };
  return node;
}

describe('SharesService', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };
  const mockListAccessService = { resolve: jest.fn() };
  const mockUsersService = { findByEmail: jest.fn() };

  let service: SharesService;

  const target = {
    id: 'target-1',
    email: 'viewer@example.com',
    createdAt: new Date('2026-01-01'),
  };
  const share = {
    id: 'share-1',
    listId: 'list-1',
    userId: 'target-1',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharesService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ListAccessService, useValue: mockListAccessService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get(SharesService);
  });

  describe('create', () => {
    it('shares the list with an existing user by email', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockUsersService.findByEmail.mockResolvedValueOnce(target);
      mockDb.insert.mockReturnValueOnce(chain([share]));

      await expect(
        service.create('owner-1', 'list-1', { email: 'viewer@example.com' }),
      ).resolves.toEqual({ ...share, email: target.email });
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.create('viewer-1', 'list-1', { email: 'x@example.com' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUsersService.findByEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.create('user-1', 'missing-list', { email: 'x@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller has no access to an existing list', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([{ id: 'list-1' }]));

      await expect(
        service.create('stranger-1', 'list-1', { email: 'x@example.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the target email is unknown', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockUsersService.findByEmail.mockResolvedValueOnce(undefined);

      await expect(
        service.create('owner-1', 'list-1', { email: 'nobody@example.com' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when sharing with self', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockUsersService.findByEmail.mockResolvedValueOnce({
        id: 'owner-1',
        email: 'owner@example.com',
        createdAt: new Date(),
      });

      await expect(
        service.create('owner-1', 'list-1', { email: 'owner@example.com' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the list is already shared with the user', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockUsersService.findByEmail.mockResolvedValueOnce(target);
      mockDb.insert.mockReturnValueOnce(rejectingChain({ code: '23505' }));

      await expect(
        service.create('owner-1', 'list-1', { email: 'viewer@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows errors that are not unique violations', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockUsersService.findByEmail.mockResolvedValueOnce(target);
      const err = new Error('connection lost');
      mockDb.insert.mockReturnValueOnce(rejectingChain(err));

      await expect(
        service.create('owner-1', 'list-1', { email: 'viewer@example.com' }),
      ).rejects.toThrow(err);
    });
  });

  describe('findAll', () => {
    it('returns shares with resolved emails for the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(
        chain([{ share, email: target.email }]),
      );

      await expect(service.findAll('owner-1', 'list-1')).resolves.toEqual([
        { ...share, email: target.email },
      ]);
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(service.findAll('viewer-1', 'list-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(service.findAll('user-1', 'missing-list')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('revokes a share when the caller is the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.delete.mockReturnValueOnce(chain([share]));

      await expect(
        service.remove('owner-1', 'list-1', 'target-1'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.remove('viewer-1', 'list-1', 'target-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.remove('user-1', 'missing-list', 'target-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the share does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.delete.mockReturnValueOnce(chain([]));

      await expect(
        service.remove('owner-1', 'list-1', 'not-shared-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
