import { useDropzone } from 'react-dropzone';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/shared/config';
import { useUploadInvoice } from './api';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

/** Each file is its own request: one bad file doesn't fail the batch, and each gets its own feedback. */
export const UploadDropzone = () => {
  const upload = useUploadInvoice();

  const onDrop = (files: File[]) => {
    for (const file of files) {
      upload.mutate(file, {
        onSuccess: ({ duplicateOf }) => {
          if (duplicateOf) {
            toast.warning(`${file.name} uploaded`, {
              description: `Looks like a duplicate of “${duplicateOf.originalName}”.`,
            });
          } else {
            toast.success(`${file.name} uploaded`, { description: 'Queued for processing.' });
          }
        },
        onError: (err) => toast.error(`${file.name}: ${err.message}`),
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    onDropRejected: (rejections) =>
      rejections.forEach((r) => toast.error(`${r.file.name}: ${r.errors[0]?.message ?? 'rejected'}`)),
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-6 text-center transition-colors hover:border-primary hover:bg-lightprimary',
        isDragActive && 'border-primary bg-lightprimary',
      )}
    >
      <input {...getInputProps()} aria-label="Upload invoices" />
      <div className="flex size-12 items-center justify-center rounded-full bg-lightprimary text-primary">
        <CloudUpload className="size-6" />
      </div>
      <p className="font-medium text-dark dark:text-white">
        {isDragActive ? 'Drop to upload' : 'Drop invoices here or click to browse'}
      </p>
      <p className="text-sm text-muted-foreground">PDF, PNG, JPEG or WEBP · up to {MAX_UPLOAD_LABEL} each</p>
    </div>
  );
};
