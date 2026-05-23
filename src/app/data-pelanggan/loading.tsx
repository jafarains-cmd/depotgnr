import { Skeleton, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 md:p-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
