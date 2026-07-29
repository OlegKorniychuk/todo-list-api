import { IsEmail } from 'class-validator';

export class CreateShareDto {
  @IsEmail()
  email!: string;
}
