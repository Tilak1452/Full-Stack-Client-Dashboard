// frontend/src/components/artifact/skeletons/Shimmer.tsx
interface ShimmerProps { width?: string; height?: string; className?: string; rounded?: string; }

export function Shimmer({ width = "100%", height = "12px", className = "", rounded = "rounded" }: ShimmerProps) {
  return (
    <div
      className={`shimmer-animate ${rounded} ${className}`}
      style={{ width, height, background: "linear-gradient(90deg,#27272a 25%,#3f3f46 50%,#27272a 75%)", backgroundSize: "400px 100%" }}
    />
  );
}
