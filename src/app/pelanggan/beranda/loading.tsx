import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-48 sm:rounded-3xl mx-4 sm:mx-0" />
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="px-4 mt-3">
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <div className="px-4 mt-5 space-y-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
