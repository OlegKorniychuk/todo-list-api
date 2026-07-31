import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { Server } from 'http';
import { AppModule } from '../../src/app.module';

export interface E2eContext {
  app: INestApplication;
  server: Server;
  container: StartedPostgreSqlContainer;
}

/**
 * Boots a fresh Postgres container + migrated schema + Nest app per call, so
 * every test gets a fully isolated database with no shared state to reset
 * between tests.
 */
export async function createE2eApp(): Promise<E2eContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();

  const migrationPool = new Pool({ connectionString: connectionUri });
  await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' });
  await migrationPool.end();

  process.env.DATABASE_URL = connectionUri;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, server: app.getHttpServer() as Server, container };
}

export async function closeE2eApp(ctx: E2eContext): Promise<void> {
  await ctx.app.close();
  await ctx.container.stop();
}
