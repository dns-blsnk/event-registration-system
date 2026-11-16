import { BULK_STATUS_MAX_IDS, BULK_TARGET_STATUSES, type BulkTargetStatus } from '@ers/shared';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

export class BulkStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_STATUS_MAX_IDS)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsIn(BULK_TARGET_STATUSES)
  status!: BulkTargetStatus;
}
