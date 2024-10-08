import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import locales from '@/locales';

const LogsTableSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-[4.875rem] w-full"></Skeleton>
      ))}
    </div>
  );
};

export default LogsTableSkeleton;
