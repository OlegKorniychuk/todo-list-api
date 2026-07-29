import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE } from './drizzle.constants';
import { Database } from './drizzle.types';
import * as schema from './schema';

/**
 * Global module providing a Drizzle database handle under the `DRIZZLE` token.
 *
 * The `pg.Pool` is lazy — it opens no connection until the first query — so the
 * application boots without a running PostgreSQL instance.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Database => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>('database.url'),
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleDestroy(): Promise<void> {
    const db = this.moduleRef.get<Database>(DRIZZLE, { strict: false });
    // drizzle(node-postgres) exposes the underlying pool via `$client`.
    const pool = (db as unknown as { $client?: Pool }).$client;
    if (pool) {
      await pool.end();
      this.logger.log('PostgreSQL pool closed');
    }
  }
}
