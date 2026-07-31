import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { ListAccessService } from './list-access.service';

describe('ListAccessService', () => {
  const mockDb = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };

  let service: ListAccessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListAccessService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get(ListAccessService);
  });

  it('returns null when the list does not exist', async () => {
    mockDb.limit.mockResolvedValueOnce([]);

    await expect(service.resolve('user-1', 'list-1')).resolves.toBeNull();
    expect(mockDb.limit).toHaveBeenCalledTimes(1);
  });

  it('returns "owner" when the caller owns the list', async () => {
    mockDb.limit.mockResolvedValueOnce([{ ownerId: 'user-1' }]);

    await expect(service.resolve('user-1', 'list-1')).resolves.toBe('owner');
    expect(mockDb.limit).toHaveBeenCalledTimes(1);
  });

  it('returns "viewer" when the caller has a share on the list', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ ownerId: 'owner-1' }])
      .mockResolvedValueOnce([{ id: 'share-1' }]);

    await expect(service.resolve('user-1', 'list-1')).resolves.toBe('viewer');
    expect(mockDb.limit).toHaveBeenCalledTimes(2);
  });

  it('returns null when the caller has neither ownership nor a share', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ ownerId: 'owner-1' }])
      .mockResolvedValueOnce([]);

    await expect(service.resolve('user-1', 'list-1')).resolves.toBeNull();
    expect(mockDb.limit).toHaveBeenCalledTimes(2);
  });
});
