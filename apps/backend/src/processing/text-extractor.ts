import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Worker as OcrWorker } from 'tesseract.js';
import type { SupportedMimeType } from '../invoices/domain/file-type';
import { PermanentProcessingError, errorMessage } from '../invoices/domain/processing-errors';

// Below this, a "PDF" has no real text layer (e.g. a scan).
const MIN_TEXT_LENGTH = 20;

/**
 * Step 1 of the pipeline: get plain text out of the file, deterministically and for free.
 * PDFs with a text layer → unpdf; images → tesseract.js OCR (WASM, no system install).
 */
@Injectable()
export class TextExtractor implements OnModuleDestroy {
  private ocr?: Promise<OcrWorker>;

  async extract(file: Buffer, mimeType: SupportedMimeType | string): Promise<string> {
    const text = mimeType === 'application/pdf' ? await this.fromPdf(file) : await this.fromImage(file);
    const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (clean.length < MIN_TEXT_LENGTH) {
      throw new PermanentProcessingError(
        mimeType === 'application/pdf'
          ? 'This PDF has no text layer (scanned document). Scanned PDFs are not supported yet — upload a photo/PNG of the page instead.'
          : 'No readable text was found in the image.',
      );
    }
    return clean;
  }

  private async fromPdf(file: Buffer): Promise<string> {
    const { extractText, getDocumentProxy } = await import('unpdf');
    try {
      const pdf = await getDocumentProxy(new Uint8Array(file));
      const { text } = await extractText(pdf, { mergePages: false });
      return text.join('\n\n');
    } catch (err) {
      throw new PermanentProcessingError(`Could not read the PDF: ${errorMessage(err)}`);
    }
  }

  private async fromImage(file: Buffer): Promise<string> {
    const worker = await this.ocrWorker();
    try {
      const { data } = await worker.recognize(file);
      return data.text;
    } catch (err) {
      throw new PermanentProcessingError(`Could not read the image: ${errorMessage(err)}`);
    }
  }

  /** One OCR worker per process, created lazily; it queues concurrent jobs internally. */
  private ocrWorker(): Promise<OcrWorker> {
    this.ocr ??= (async () => {
      const { createWorker } = await import('tesseract.js');
      // Bundled English model (npm package) — no download at runtime.
      const { langPath, gzip } = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
      // cacheMethod none: the model is already local, don't write a copy into the working dir.
      return createWorker('eng', 1, { langPath, gzip, cacheMethod: 'none' });
    })();
    return this.ocr;
  }

  async onModuleDestroy() {
    if (this.ocr) await (await this.ocr).terminate();
  }
}
