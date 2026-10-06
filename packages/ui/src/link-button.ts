/** Shared action appearance for framework links, preserving their router behaviour. */
export function dmLinkButtonProps({ appearance = "secondary", density = "default", className = "" }: {
  appearance?: "primary" | "secondary" | "subtle";
  density?: "default" | "compact";
  className?: string;
} = {}) {
  return {
    className: `dm-link-button ${className}`.trim(),
    "data-dm-appearance": appearance,
    "data-dm-density": density,
  };
}
