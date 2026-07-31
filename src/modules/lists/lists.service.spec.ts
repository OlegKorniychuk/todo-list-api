import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { ListAccessService } from './list-access.service';
import { ListsService } from './lists.service';

// Mimics drizzle's query builder: chainable, and awaitable (thenable) at any
// point in the chain, so both `.limit(1)`-terminated and bare `.where(...)`
// queries resolve to the same fixture without needing a real query builder.
function chain(result: unknown) {
  const node: Record<string, unknown> = {
    from: jest.fn(() => node),
    where: jest.fn(() => node),
    innerJoin: jest.fn(() => node),
    orderBy: jest.fn(() => node),
    limit: jest.fn(() => node),
    values: jest.fn(() => node),
    set: jest.fn(() => node),
    returning: jest.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected as never),
  };
  return node;
}

describe('ListsService', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockListAccessService = { resolve: jest.fn() };

  let service: ListsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ListAccessService, useValue: mockListAccessService },
      ],
    }).compile();

    service = module.get(ListsService);
  });

  describe('create', () => {
    it('inserts a list owned by the caller and returns it with role "owner"', async () => {
      const row = {
        id: 'list-1',
        ownerId: 'user-1',
        name: 'Groceries',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      mockDb.insert.mockReturnValueOnce(chain([row]));

      await expect(
        service.create('user-1', { name: 'Groceries' }),
      ).resolves.toEqual({ ...row, role: 'owner' });
    });
  });

  describe('findAllForUser', () => {
    const ownedRow = {
      id: 'list-1',
      ownerId: 'user-1',
      name: 'Owned',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    const sharedRow = {
      id: 'list-2',
      ownerId: 'user-2',
      name: 'Shared',
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
    };

    it('returns owned and shared lists when no role filter is given', async () => {
      mockDb.select
        .mockReturnValueOnce(chain([ownedRow]))
        .mockReturnValueOnce(chain([{ list: sharedRow }]));

      await expect(service.findAllForUser('user-1')).resolves.toEqual([
        { ...ownedRow, role: 'owner' },
        { ...sharedRow, role: 'viewer' },
      ]);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('only queries owned lists when role=owner', async () => {
      mockDb.select.mockReturnValueOnce(chain([ownedRow]));

      await expect(service.findAllForUser('user-1', 'owner')).resolves.toEqual([
        { ...ownedRow, role: 'owner' },
      ]);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('only queries shared lists when role=viewer', async () => {
      mockDb.select.mockReturnValueOnce(chain([{ list: sharedRow }]));

      await expect(service.findAllForUser('user-1', 'viewer')).resolves.toEqual(
        [{ ...sharedRow, role: 'viewer' }],
      );
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('re-sorts owned and shared lists together by createdAt when a newer owned list would otherwise print before an older shared one', async () => {
      const olderShared = { ...sharedRow, createdAt: new Date('2025-06-01') };
      const newerOwned = { ...ownedRow, createdAt: new Date('2026-06-01') };
      mockDb.select
        .mockReturnValueOnce(chain([newerOwned]))
        .mockReturnValueOnce(chain([{ list: olderShared }]));

      await expect(service.findAllForUser('user-1')).resolves.toEqual([
        { ...olderShared, role: 'viewer' },
        { ...newerOwned, role: 'owner' },
      ]);
    });
  });

  describe('findOne', () => {
    const row = {
      id: 'list-1',
      ownerId: 'owner-1',
      name: 'Groceries',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('throws NotFoundException when the list does not exist', async () => {
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(service.findOne('user-1', 'missing-list')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockListAccessService.resolve).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller has no access', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));
      mockListAccessService.resolve.mockResolvedValueOnce(null);

      await expect(service.findOne('user-2', 'list-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the list with role "owner" for the owner', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));
      mockListAccessService.resolve.mockResolvedValueOnce('owner');

      await expect(service.findOne('owner-1', 'list-1')).resolves.toEqual({
        ...row,
        role: 'owner',
      });
    });

    it('returns the list with role "viewer" for a shared user', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(service.findOne('viewer-1', 'list-1')).resolves.toEqual({
        ...row,
        role: 'viewer',
      });
    });
  });

  describe('rename', () => {
    const row = {
      id: 'list-1',
      ownerId: 'owner-1',
      name: 'Old name',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('throws NotFoundException when the list does not exist', async () => {
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.rename('owner-1', 'missing-list', { name: 'New name' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));

      await expect(
        service.rename('viewer-1', 'list-1', { name: 'New name' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('updates the name and returns the resource with role "owner"', async () => {
      const updated = { ...row, name: 'New name', updatedAt: new Date() };
      mockDb.select.mockReturnValueOnce(chain([row]));
      mockDb.update.mockReturnValueOnce(chain([updated]));

      await expect(
        service.rename('owner-1', 'list-1', { name: 'New name' }),
      ).resolves.toEqual({ ...updated, role: 'owner' });
    });
  });

  describe('remove', () => {
    const row = {
      id: 'list-1',
      ownerId: 'owner-1',
      name: 'Groceries',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('throws NotFoundException when the list does not exist', async () => {
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(service.remove('owner-1', 'missing-list')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));

      await expect(service.remove('viewer-1', 'list-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('deletes the list when the caller is the owner', async () => {
      mockDb.select.mockReturnValueOnce(chain([row]));
      mockDb.delete.mockReturnValueOnce(chain(undefined));

      await expect(
        service.remove('owner-1', 'list-1'),
      ).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });
});
