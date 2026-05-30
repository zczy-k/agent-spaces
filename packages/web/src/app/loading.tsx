import { MorphingSpinner } from "@/components/ui/morphing-spinner";

export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <MorphingSpinner size="lg" />
    </div>
  );
}
