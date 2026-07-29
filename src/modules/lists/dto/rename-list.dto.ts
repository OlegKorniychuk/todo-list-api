import { IsString, Length } from 'class-validator';

export class RenameListDto {
  @IsString()
  @Length(1, 255)
  name!: string;
}
