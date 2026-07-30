import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { ListAccessService } from '../lists/list-access.service';
import { TasksService } from './tasks.service';

// Mimics drizzle's query builder: chainable, and awaitable (thenable) at any
// point in the chain, so both `.limit(1)`-terminated and bare `.where(...)`
// queries resolve to the same fixture without needing a real query builder.
function chain(result: unknown) {
  const node: Record<string, unknown> = {
    from: jest.fn(() => node),
    where: jest.fn(() => node),
    limit: jest.fn(() => node),
    values: jest.fn(() => node),
    set: jest.fn(() => node),
    returning: jest.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected as never),
  };
  return node;
}

describe('TasksService', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockListAccessService = { resolve: jest.fn() };

  let service: TasksService;

  const taskRow = {
    id: 'task-1',
    listId: 'list-1',
    title: 'Buy milk',
    description: null,
    status: 'todo',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ListAccessService, useValue: mockListAccessService },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  describe('create', () => {
    it('creates a task when the caller is the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.insert.mockReturnValueOnce(chain([taskRow]));

      await expect(
        service.create('owner-1', 'list-1', { title: 'Buy milk' }),
      ).resolves.toEqual(taskRow);
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.create('viewer-1', 'list-1', { title: 'Buy milk' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.create('user-1', 'missing-list', { title: 'Buy milk' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the list exists but the caller has no access', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([{ id: 'list-1' }]));

      await expect(
        service.create('stranger-1', 'list-1', { title: 'Buy milk' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('returns tasks for an owner or viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');
      mockDb.select.mockReturnValueOnce(chain([taskRow]));

      await expect(service.findAll('viewer-1', 'list-1')).resolves.toEqual([
        taskRow,
      ]);
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(service.findAll('user-1', 'missing-list')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the caller has no access to an existing list', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([{ id: 'list-1' }]));

      await expect(service.findAll('stranger-1', 'list-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the task for an owner or viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([taskRow]));

      await expect(
        service.findOne('owner-1', 'list-1', 'task-1'),
      ).resolves.toEqual(taskRow);
    });

    it('throws NotFoundException when the task does not exist in the list', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.findOne('owner-1', 'list-1', 'missing-task'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the list does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.findOne('user-1', 'missing-list', 'task-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller has no access to an existing list', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce(null);
      mockDb.select.mockReturnValueOnce(chain([{ id: 'list-1' }]));

      await expect(
        service.findOne('stranger-1', 'list-1', 'task-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates title/description when the caller is the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([taskRow]));
      const updated = { ...taskRow, title: 'Buy oat milk' };
      mockDb.update.mockReturnValueOnce(chain([updated]));

      await expect(
        service.update('owner-1', 'list-1', 'task-1', {
          title: 'Buy oat milk',
        }),
      ).resolves.toEqual(updated);
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.update('viewer-1', 'list-1', 'task-1', { title: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the task does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.update('owner-1', 'list-1', 'missing-task', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('updates the status when the caller is the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([taskRow]));
      const updated = { ...taskRow, status: 'done' };
      mockDb.update.mockReturnValueOnce(chain([updated]));

      await expect(
        service.updateStatus('owner-1', 'list-1', 'task-1', {
          status: 'done',
        }),
      ).resolves.toEqual(updated);
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.updateStatus('viewer-1', 'list-1', 'task-1', {
          status: 'done',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the task does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.updateStatus('owner-1', 'list-1', 'missing-task', {
          status: 'done',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the task when the caller is the owner', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([taskRow]));
      mockDb.delete.mockReturnValueOnce(chain(undefined));

      await expect(
        service.remove('owner-1', 'list-1', 'task-1'),
      ).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.remove('viewer-1', 'list-1', 'task-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the task does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([]));

      await expect(
        service.remove('owner-1', 'list-1', 'missing-task'),
      ).rejects.toThrow(NotFoundException);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
