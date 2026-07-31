import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ListsModule } from './modules/lists/lists.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SharesModule } from './modules/shares/shares.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.accessToken',
          ],
          censor: '**redacted**',
        },
      },
    }),
    DrizzleModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ListsModule,
    TasksModule,
    SharesModule,
  ],
})
export class AppModule {}
