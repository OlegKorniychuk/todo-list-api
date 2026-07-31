import request from 'supertest';
import { createE2eApp, closeE2eApp, E2eContext } from './utils/e2e-app';
import { createList, registerUser, shareList } from './utils/fixtures';

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Shares (e2e)', () => {
  let ctx: E2eContext;

  beforeEach(async () => {
    ctx = await createE2eApp();
  });

  afterEach(async () => {
    await closeE2eApp(ctx);
  });

  describe('POST /lists/:listId/shares', () => {
    it('201 shares the list with an existing user by email', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      const response = await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: viewer.email })
        .expect(201);

      const body = response.body as { userId: string; email: string };
      expect(body.userId).toBe(viewer.userId);
      expect(body.email).toBe(viewer.email);
    });

    it('400 rejects an invalid email', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('403 rejects a non-owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const stranger = await registerUser(ctx.server, 'stranger@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ email: stranger.email })
        .expect(403);
    });

    it('404 rejects an unknown email', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'nobody@example.com' })
        .expect(404);
    });

    it('404 rejects a nonexistent list', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');

      await request(ctx.server)
        .post(`/api/v1/lists/${NONEXISTENT_ID}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: viewer.email })
        .expect(404);
    });

    it('409 rejects a duplicate share', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: viewer.email })
        .expect(409);
    });

    it('422 rejects sharing with self', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: owner.email })
        .expect(422);
    });
  });

  describe('GET /lists/:listId/shares', () => {
    it('200 lists shares with resolved emails for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { data: { email: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ email: viewer.email });
    });

    it('403 rejects a non-owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/shares`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });
  });

  describe('DELETE /lists/:listId/shares/:userId', () => {
    it('204 revokes access, and the viewer immediately loses list access', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/shares/${viewer.userId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(204);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('403 rejects a non-owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/shares/${viewer.userId}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('404 rejects a share that does not exist', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/shares/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    });
  });
});
