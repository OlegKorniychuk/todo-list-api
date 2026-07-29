import { IsString, Length } from 'class-validator';

export class CreateListDto {
  @IsString()
  @Length(1, 255)
  name!: string;
}
