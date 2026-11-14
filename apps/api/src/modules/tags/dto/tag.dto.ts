import { TAG_NAME_MAX_LENGTH } from '@ers/shared';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

import { normalizeLabel } from '../../../common/validation/transforms.js';

/** Create and rename take the same body: a tag is just its name. */
export class TagDto {
  @Transform(normalizeLabel)
  @IsString()
  @Length(1, TAG_NAME_MAX_LENGTH)
  name!: string;
}
