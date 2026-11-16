import { IsUUID } from 'class-validator';

export class BookDto {
  @IsUUID('all')
  sessionId!: string;
}
