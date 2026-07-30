import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const mockDb = {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    insert: jest.fn(),
    values: jest.fn(),
    returning: jest.fn(),
  };

  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = { id: '1', email: 'a@b.com' };
      mockDb.limit.mockResolvedValueOnce([user]);

      await expect(service.findById('1')).resolves.toEqual(user);
    });

    it('returns undefined when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findById('missing')).resolves.toBeUndefined();
    });
  });

  describe('findByEmail', () => {
    it('finds a user case-insensitively', async () => {
      const user = { id: '1', email: 'foo@bar.com' };
      mockDb.limit.mockResolvedValueOnce([user]);

      await expect(service.findByEmail('Foo@Bar.com')).resolves.toEqual(user);
    });

    it('returns undefined when not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.findByEmail('nobody@x.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('inserts and returns the new user', async () => {
      const user = { id: '1', email: 'new@x.com' };
      mockDb.returning.mockResolvedValueOnce([user]);

      await expect(service.create('new@x.com', 'hash')).resolves.toEqual(user);
    });

    it('lowercases the email before insert', async () => {
      const user = { id: '1', email: 'mixed@x.com' };
      mockDb.returning.mockResolvedValueOnce([user]);

      await service.create('Mixed@X.com', 'hash');

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'mixed@x.com' }),
      );
    });

    it('throws ConflictException on duplicate email', async () => {
      mockDb.returning.mockRejectedValueOnce({ code: '23505' });

      await expect(service.create('dup@x.com', 'hash')).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows errors that are not unique violations', async () => {
      const err = new Error('connection lost');
      mockDb.returning.mockRejectedValueOnce(err);

      await expect(service.create('x@x.com', 'hash')).rejects.toThrow(err);
    });
  });
});
