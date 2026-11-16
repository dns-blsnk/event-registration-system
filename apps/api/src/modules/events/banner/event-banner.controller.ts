import { Action, BANNER_FILE_FIELD, BANNER_MAX_BYTES, Resource } from '@ers/shared';
import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { RequirePermission } from '../../../common/auth/access.decorator.js';
import { CurrentAuth } from '../../../common/auth/current-user.decorator.js';
import { fieldError } from '../../../common/errors/field-error.js';

import { EventBannerService } from './event-banner.service.js';

import type { AuthContext } from '../../../common/auth/auth-context.js';

/** The part of Multer's in-memory file this endpoint reads. */
interface UploadedImage {
  buffer: Buffer;
}

/**
 * Banner upload. Multer keeps the file in memory (never on disk) and stops reading past the size
 * limit; the real type is checked from the bytes before anything is stored.
 */
@Controller(`${Resource.EVENTS}/:id/banner`)
export class EventBannerController {
  constructor(private readonly banners: EventBannerService) {}

  @RequirePermission(Resource.EVENTS, Action.EDIT)
  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor(BANNER_FILE_FIELD, {
      limits: { fileSize: BANNER_MAX_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    if (file === undefined) {
      throw fieldError(BANNER_FILE_FIELD, `Attach the image as the "${BANNER_FILE_FIELD}" field`);
    }
    await this.banners.replace(id, file.buffer, auth.user);
  }

  @RequirePermission(Resource.EVENTS, Action.EDIT)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    await this.banners.remove(id, auth.user);
  }
}
