import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoicesService } from '../invoices.service';
import { toInvoiceModel } from './invoice.model';

/**
 * File transfer only. GraphQL has no file type in the spec and Apollo advises against the
 * multipart extension (CSRF), so bytes go through plain REST; everything else is GraphQL.
 */
@Controller('api/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  // Hard memory cap while buffering; the configurable business limit is checked in the service.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!file) throw new BadRequestException('Send the invoice as multipart field "file"');
    if (idempotencyKey !== undefined && !/^[\w-]{8,100}$/.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be 8–100 letters, digits, "-" or "_"');
    }
    // Multer decodes the multipart filename as latin1; browsers send UTF-8.
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const { invoice, duplicateOf } = await this.invoices.upload({ buffer: file.buffer, originalName, idempotencyKey });
    return {
      invoice: toInvoiceModel(invoice),
      duplicateOf: duplicateOf && { id: duplicateOf.id, originalName: duplicateOf.originalName },
    };
  }

  @Get(':id/file')
  @Header('Cache-Control', 'private, max-age=3600')
  async file(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { invoice, body } = await this.invoices.getFile(id);
    return new StreamableFile(body, {
      type: invoice.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(invoice.originalName)}`,
    });
  }
}
