import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

describe('TasksService', () => {
  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
  const mockListAccessService = { resolve: jest.fn() };

  let service: TasksService;

  const taskRow = {
    id: 'task-1',
    listId: 'list-1',
    title: 'Buy milk',
    description: null,
    status: 'todo',
    position: 65536,
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
      mockDb.select.mockReturnValueOnce(chain([{ maxPosition: null }]));
      mockDb.insert.mockReturnValueOnce(chain([taskRow]));

      await expect(
        service.create('owner-1', 'list-1', { title: 'Buy milk' }),
      ).resolves.toEqual(taskRow);
    });

    it('assigns position = GAP for the first task in a list', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([{ maxPosition: null }]));
      const insertNode = chain([taskRow]);
      mockDb.insert.mockReturnValueOnce(insertNode);

      await service.create('owner-1', 'list-1', { title: 'Buy milk' });

      expect(insertNode.values).toHaveBeenCalledWith(
        expect.objectContaining({ position: 65536 }),
      );
    });

    it('assigns position = maxPosition + GAP for a subsequent task', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      mockDb.select.mockReturnValueOnce(chain([{ maxPosition: 65536 }]));
      const insertNode = chain([{ ...taskRow, position: 131072 }]);
      mockDb.insert.mockReturnValueOnce(insertNode);

      await service.create('owner-1', 'list-1', { title: 'Buy oat milk' });

      expect(insertNode.values).toHaveBeenCalledWith(
        expect.objectContaining({ position: 131072 }),
      );
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
    it('returns tasks for an owner or viewer, ordered by position', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');
      const selectNode = chain([taskRow]);
      mockDb.select.mockReturnValueOnce(selectNode);

      await expect(service.findAll('viewer-1', 'list-1')).resolves.toEqual([
        taskRow,
      ]);
      expect(selectNode.orderBy).toHaveBeenCalledTimes(1);
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

  describe('reorder', () => {
    const siblingA = {
      id: 'task-2',
      position: 100,
      createdAt: new Date('2026-01-02'),
    };
    const siblingB = {
      id: 'task-3',
      position: 300,
      createdAt: new Date('2026-01-03'),
    };

    function useTx(tx: { select: jest.Mock; update: jest.Mock }) {
      mockDb.transaction.mockImplementationOnce(
        (cb: (tx: unknown) => unknown) => cb(tx),
      );
    }

    it('moves a task to the top when afterTaskId is null', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([taskRow]))
        .mockReturnValueOnce(chain([siblingA, siblingB]));
      const updateNode = chain([{ ...taskRow, position: 50 }]);
      tx.update.mockReturnValueOnce(updateNode);

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', { afterTaskId: null }),
      ).resolves.toEqual({ ...taskRow, position: 50 });
      expect(updateNode.set).toHaveBeenCalledWith(
        expect.objectContaining({ position: 50 }),
      );
    });

    it('moves a task after a mid-list sibling', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([taskRow]))
        .mockReturnValueOnce(chain([siblingA, siblingB]));
      const updateNode = chain([{ ...taskRow, position: 200 }]);
      tx.update.mockReturnValueOnce(updateNode);

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'task-2',
        }),
      ).resolves.toEqual({ ...taskRow, position: 200 });
      expect(updateNode.set).toHaveBeenCalledWith(
        expect.objectContaining({ position: 200 }),
      );
    });

    it('moves a task to the bottom when afterTaskId is the last sibling', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([taskRow]))
        .mockReturnValueOnce(chain([siblingA, siblingB]));
      const updateNode = chain([{ ...taskRow, position: 300 + 65536 }]);
      tx.update.mockReturnValueOnce(updateNode);

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'task-3',
        }),
      ).resolves.toEqual({ ...taskRow, position: 300 + 65536 });
      expect(updateNode.set).toHaveBeenCalledWith(
        expect.objectContaining({ position: 300 + 65536 }),
      );
    });

    it('is idempotent when reordering a task to its current position', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([{ ...taskRow, position: 200 }]))
        .mockReturnValueOnce(chain([siblingA, siblingB]));
      const updateNode = chain([{ ...taskRow, position: 200 }]);
      tx.update.mockReturnValueOnce(updateNode);

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'task-2',
        }),
      ).resolves.toEqual({ ...taskRow, position: 200 });
    });

    it('renumbers the whole list when the midpoint exhausts float precision', async () => {
      const tightA = {
        id: 'task-2',
        position: 1,
        createdAt: new Date('2026-01-02'),
      };
      const tightB = {
        id: 'task-3',
        position: 1 + Number.EPSILON,
        createdAt: new Date('2026-01-03'),
      };
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([taskRow]))
        .mockReturnValueOnce(chain([tightA, tightB]));
      const updateA = chain([{ ...tightA, position: 65536 }]);
      const updateMoved = chain([{ ...taskRow, position: 131072 }]);
      const updateB = chain([{ ...tightB, position: 196608 }]);
      tx.update
        .mockReturnValueOnce(updateA)
        .mockReturnValueOnce(updateMoved)
        .mockReturnValueOnce(updateB);

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'task-2',
        }),
      ).resolves.toEqual({ ...taskRow, position: 131072 });

      expect(updateA.set).toHaveBeenCalledWith({ position: 65536 });
      expect(updateMoved.set).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 131072,
          updatedAt: expect.any(Date) as Date,
        }),
      );
      expect(updateB.set).toHaveBeenCalledWith({ position: 196608 });
    });

    it('throws NotFoundException when afterTaskId is not among the list siblings', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select
        .mockReturnValueOnce(chain([taskRow]))
        .mockReturnValueOnce(chain([siblingA, siblingB]));

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'not-a-sibling',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when afterTaskId references the task itself', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');

      await expect(
        service.reorder('owner-1', 'list-1', 'task-1', {
          afterTaskId: 'task-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is a viewer', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('viewer');

      await expect(
        service.reorder('viewer-1', 'list-1', 'task-1', { afterTaskId: null }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the task does not exist', async () => {
      mockListAccessService.resolve.mockResolvedValueOnce('owner');
      const tx = { select: jest.fn(), update: jest.fn() };
      useTx(tx);
      tx.select.mockReturnValueOnce(chain([]));

      await expect(
        service.reorder('owner-1', 'list-1', 'missing-task', {
          afterTaskId: null,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(tx.update).not.toHaveBeenCalled();
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
