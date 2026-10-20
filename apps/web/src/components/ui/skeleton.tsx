import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-md bg-lightprimary dark:bg-neutral-50/40', className)} {...props} />
);

export { Skeleton };
