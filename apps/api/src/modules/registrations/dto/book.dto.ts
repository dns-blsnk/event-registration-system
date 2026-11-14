import { IsUUID } from 'class-validator';

export class BookDto {
  @IsUUID('4')
  sessionId!: string;
}
