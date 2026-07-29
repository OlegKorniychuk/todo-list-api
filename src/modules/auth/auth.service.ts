import { Injectable, NotImplementedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  // TODO: inject UsersService, JwtService, DRIZZLE (refresh_tokens); implement.

  register(_dto: RegisterDto): never {
    throw new NotImplementedException('register not implemented');
  }

  login(_dto: LoginDto): never {
    throw new NotImplementedException('login not implemented');
  }

  refresh(_dto: RefreshDto): never {
    throw new NotImplementedException('refresh not implemented');
  }

  logout(_userId: string): never {
    throw new NotImplementedException('logout not implemented');
  }

  me(_userId: string): never {
    throw new NotImplementedException('me not implemented');
  }
}
