import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '7d';

  @IsOptional()
  @IsString()
  CORS_ORIGIN: string = '';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validated;
}
