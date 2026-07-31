import request from 'supertest';
import { Server } from 'http';

export interface RegisteredUser {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(
  server: Server,
  email: string,
  password = 'P@ssw0rd123',
): Promise<RegisteredUser> {
  const response = await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201);

  const body = response.body as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
  return {
    userId: body.user.id,
    email: body.user.email,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}

export interface CreatedList {
  id: string;
  name: string;
  ownerId: string;
}

export async function createList(
  server: Server,
  accessToken: string,
  name = 'Groceries',
): Promise<CreatedList> {
  const response = await request(server)
    .post('/api/v1/lists')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name })
    .expect(201);

  return response.body as CreatedList;
}

export async function shareList(
  server: Server,
  ownerToken: string,
  listId: string,
  email: string,
): Promise<void> {
  await request(server)
    .post(`/api/v1/lists/${listId}/shares`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ email })
    .expect(201);
}

export interface CreatedTask {
  id: string;
  listId: string;
  title: string;
  status: string;
}

export async function createTask(
  server: Server,
  accessToken: string,
  listId: string,
  title = 'Buy milk',
): Promise<CreatedTask> {
  const response = await request(server)
    .post(`/api/v1/lists/${listId}/tasks`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title })
    .expect(201);

  return response.body as CreatedTask;
}
