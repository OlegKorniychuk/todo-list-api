import request from 'supertest';
import { createE2eApp, closeE2eApp, E2eContext } from './utils/e2e-app';
import { createList, registerUser, shareList } from './utils/fixtures';

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Lists (e2e)', () => {
  let ctx: E2eContext;

  beforeEach(async () => {
    ctx = await createE2eApp();
  });

  afterEach(async () => {
    await closeE2eApp(ctx);
  });

  describe('POST /lists', () => {
    it('201 creates a list owned by the caller', async () => {
      const { accessToken, userId } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      const response = await request(ctx.server)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Groceries' })
        .expect(201);

      const body = response.body as {
        name: string;
        ownerId: string;
        role: string;
      };
      expect(body.name).toBe('Groceries');
      expect(body.ownerId).toBe(userId);
      expect(body.role).toBe('owner');
    });

    it('400 rejects an empty name', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('401 rejects a missing token', async () => {
      await request(ctx.server)
        .post('/api/v1/lists')
        .send({ name: 'Groceries' })
        .expect(401);
    });
  });

  describe('GET /lists', () => {
    it('200 returns owned and shared lists', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      const response = await request(ctx.server)
        .get('/api/v1/lists')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);

      const body = response.body as { data: { id: string; role: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ id: list.id, role: 'viewer' });
    });

    it('401 rejects a missing token', async () => {
      await request(ctx.server).get('/api/v1/lists').expect(401);
    });
  });

  describe('GET /lists/:listId', () => {
    it('200 returns the list for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { role: string };
      expect(body.role).toBe('owner');
    });

    it('200 returns the list for a shared viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);

      const body = response.body as { role: string };
      expect(body.role).toBe('viewer');
    });

    it('403 rejects a stranger with no access', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const stranger = await registerUser(ctx.server, 'stranger@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(403);
    });

    it('404 rejects a nonexistent list', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .get(`/api/v1/lists/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('401 rejects a missing token', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server).get(`/api/v1/lists/${list.id}`).expect(401);
    });
  });

  describe('PATCH /lists/:listId', () => {
    it('200 renames the list for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      const response = await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Weekly groceries' })
        .expect(200);

      const body = response.body as { name: string };
      expect(body.name).toBe('Weekly groceries');
    });

    it('400 rejects an empty name', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('404 rejects a nonexistent list', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .patch(`/api/v1/lists/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /lists/:listId', () => {
    it('204 deletes the list for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(204);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('404 rejects a nonexistent list', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .delete(`/api/v1/lists/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
