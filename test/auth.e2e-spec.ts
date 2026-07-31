import request from 'supertest';
import { createE2eApp, closeE2eApp, E2eContext } from './utils/e2e-app';
import { registerUser } from './utils/fixtures';

describe('Auth (e2e)', () => {
  let ctx: E2eContext;

  beforeEach(async () => {
    ctx = await createE2eApp();
  });

  afterEach(async () => {
    await closeE2eApp(ctx);
  });

  describe('POST /auth/register', () => {
    it('201 creates a user and returns a token pair', async () => {
      const response = await request(ctx.server)
        .post('/api/v1/auth/register')
        .send({ email: 'owner@example.com', password: 'P@ssw0rd123' })
        .expect(201);

      const body = response.body as {
        user: { email: string };
        accessToken: string;
        refreshToken: string;
      };
      expect(body.user.email).toBe('owner@example.com');
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
    });

    it('400 rejects an invalid email', async () => {
      await request(ctx.server)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'P@ssw0rd123' })
        .expect(400);
    });

    it('400 rejects a password under the minimum length', async () => {
      await request(ctx.server)
        .post('/api/v1/auth/register')
        .send({ email: 'owner@example.com', password: 'short1' })
        .expect(400);
    });

    it('409 rejects a duplicate email', async () => {
      await registerUser(ctx.server, 'dup@example.com');

      await request(ctx.server)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@example.com', password: 'P@ssw0rd123' })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('200 returns a token pair for correct credentials', async () => {
      await registerUser(ctx.server, 'owner@example.com', 'P@ssw0rd123');

      const response = await request(ctx.server)
        .post('/api/v1/auth/login')
        .send({ email: 'owner@example.com', password: 'P@ssw0rd123' })
        .expect(200);

      const body = response.body as { accessToken: string };
      expect(body.accessToken).toEqual(expect.any(String));
    });

    it('400 rejects a missing password', async () => {
      await request(ctx.server)
        .post('/api/v1/auth/login')
        .send({ email: 'owner@example.com' })
        .expect(400);
    });

    it('401 rejects an unknown email', async () => {
      await request(ctx.server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'P@ssw0rd123' })
        .expect(401);
    });

    it('401 rejects the wrong password', async () => {
      await registerUser(ctx.server, 'owner@example.com', 'P@ssw0rd123');

      await request(ctx.server)
        .post('/api/v1/auth/login')
        .send({ email: 'owner@example.com', password: 'wrong-password' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('200 rotates the refresh token and returns a new pair', async () => {
      const { refreshToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      const response = await request(ctx.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const body = response.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
    });

    it('400 rejects a malformed token', async () => {
      await request(ctx.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-jwt' })
        .expect(400);
    });

    it('401 rejects a well-formed but invalid token', async () => {
      const fakeJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIn0.invalidsignature';

      await request(ctx.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: fakeJwt })
        .expect(401);
    });

    it('401 rejects a refresh token already used once (rotation)', async () => {
      const { refreshToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      await request(ctx.server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('204 revokes the caller refresh token', async () => {
      const { accessToken } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      await request(ctx.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('401 rejects a missing token', async () => {
      await request(ctx.server).post('/api/v1/auth/logout').expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('200 returns the authenticated user', async () => {
      const { accessToken, email } = await registerUser(
        ctx.server,
        'owner@example.com',
      );

      const response = await request(ctx.server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as { email: string };
      expect(body.email).toBe(email);
    });

    it('401 rejects a missing token', async () => {
      await request(ctx.server).get('/api/v1/auth/me').expect(401);
    });
  });
});
