import request from 'supertest';
import { createE2eApp, closeE2eApp, E2eContext } from './utils/e2e-app';
import {
  createList,
  createTask,
  registerUser,
  shareList,
} from './utils/fixtures';

const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Tasks (e2e)', () => {
  let ctx: E2eContext;

  beforeEach(async () => {
    ctx = await createE2eApp();
  });

  afterEach(async () => {
    await closeE2eApp(ctx);
  });

  describe('POST /lists/:listId/tasks', () => {
    it('201 creates a task defaulting to status todo', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      const response = await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Buy milk' })
        .expect(201);

      const body = response.body as { title: string; status: string };
      expect(body.title).toBe('Buy milk');
      expect(body.status).toBe('todo');
    });

    it('400 rejects an empty title', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: '' })
        .expect(400);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ title: 'Sneaky task' })
        .expect(403);
    });

    it('404 rejects a nonexistent list', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .post(`/api/v1/lists/${NONEXISTENT_ID}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Buy milk' })
        .expect(404);
    });

    it('401 rejects a missing token', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .post(`/api/v1/lists/${list.id}/tasks`)
        .send({ title: 'Buy milk' })
        .expect(401);
    });
  });

  describe('GET /lists/:listId/tasks', () => {
    it('200 returns tasks for the owner, filterable by status', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'done' })
        .expect(200);
      await createTask(ctx.server, owner.accessToken, list.id, 'Second task');

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks`)
        .query({ status: 'done' })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { data: { id: string; status: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ id: task.id, status: 'done' });
    });

    it('403 rejects a stranger with no access', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const stranger = await registerUser(ctx.server, 'stranger@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(403);
    });

    it('404 rejects a nonexistent list', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .get(`/api/v1/lists/${NONEXISTENT_ID}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('200 returns tasks ordered by position, reflecting a manual reorder', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const taskA = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'A',
      );
      const taskB = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'B',
      );
      const taskC = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'C',
      );

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${taskC.id}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: null })
        .expect(200);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { data: { id: string }[] };
      expect(body.data.map((t) => t.id)).toEqual([
        taskC.id,
        taskA.id,
        taskB.id,
      ]);
    });
  });

  describe('GET /lists/:listId/tasks/:taskId', () => {
    it('200 returns the task for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { id: string };
      expect(body.id).toBe(task.id);
    });

    it('404 rejects a nonexistent task in an existing list', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    });

    it('403 rejects a stranger with no access', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const stranger = await registerUser(ctx.server, 'stranger@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${stranger.accessToken}`)
        .expect(403);
    });
  });

  describe('PATCH /lists/:listId/tasks/:taskId', () => {
    it('200 edits the task for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      const response = await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Buy oat milk' })
        .expect(200);

      const body = response.body as { title: string };
      expect(body.title).toBe('Buy oat milk');
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ title: 'Hijacked' })
        .expect(403);
    });

    it('404 rejects a nonexistent task', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'x' })
        .expect(404);
    });
  });

  describe('PATCH /lists/:listId/tasks/:taskId/status', () => {
    it('200 updates the status for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      const response = await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      const body = response.body as { status: string };
      expect(body.status).toBe('in_progress');
    });

    it('400 rejects an invalid status value', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'archived' })
        .expect(400);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ status: 'done' })
        .expect(403);
    });

    it('404 rejects a nonexistent task', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${NONEXISTENT_ID}/status`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'done' })
        .expect(404);
    });
  });

  describe('PATCH /lists/:listId/tasks/:taskId/position', () => {
    it('200 moves a task to the top when afterTaskId is null', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const taskA = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'A',
      );
      const taskB = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'B',
      );

      const response = await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${taskB.id}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: null })
        .expect(200);

      const body = response.body as { id: string; position: number };
      expect(body.id).toBe(taskB.id);
      expect(body.position).toBeLessThan(taskA.position);
    });

    it('200 moves a task after a sibling', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const taskA = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'A',
      );
      const taskB = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'B',
      );
      const taskC = await createTask(
        ctx.server,
        owner.accessToken,
        list.id,
        'C',
      );

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${taskA.id}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: taskB.id })
        .expect(200);

      const response = await request(ctx.server)
        .get(`/api/v1/lists/${list.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as { data: { id: string }[] };
      expect(body.data.map((t) => t.id)).toEqual([
        taskB.id,
        taskA.id,
        taskC.id,
      ]);
    });

    it('400 rejects afterTaskId referencing the task itself', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: task.id })
        .expect(400);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${task.id}/position`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .send({ afterTaskId: null })
        .expect(403);
    });

    it('404 rejects a nonexistent task', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .patch(`/api/v1/lists/${list.id}/tasks/${NONEXISTENT_ID}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: null })
        .expect(404);
    });

    it('404 rejects an afterTaskId belonging to a different list', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const listOne = await createList(ctx.server, owner.accessToken, 'One');
      const listTwo = await createList(ctx.server, owner.accessToken, 'Two');
      const taskInListOne = await createTask(
        ctx.server,
        owner.accessToken,
        listOne.id,
      );
      const taskInListTwo = await createTask(
        ctx.server,
        owner.accessToken,
        listTwo.id,
      );

      await request(ctx.server)
        .patch(`/api/v1/lists/${listOne.id}/tasks/${taskInListOne.id}/position`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ afterTaskId: taskInListTwo.id })
        .expect(404);
    });
  });

  describe('DELETE /lists/:listId/tasks/:taskId', () => {
    it('204 deletes the task for the owner', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(204);
    });

    it('403 rejects a viewer', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const viewer = await registerUser(ctx.server, 'viewer@example.com');
      const list = await createList(ctx.server, owner.accessToken);
      await shareList(ctx.server, owner.accessToken, list.id, viewer.email);
      const task = await createTask(ctx.server, owner.accessToken, list.id);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(403);
    });

    it('404 rejects a nonexistent task', async () => {
      const owner = await registerUser(ctx.server, 'owner@example.com');
      const list = await createList(ctx.server, owner.accessToken);

      await request(ctx.server)
        .delete(`/api/v1/lists/${list.id}/tasks/${NONEXISTENT_ID}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    });
  });
});
