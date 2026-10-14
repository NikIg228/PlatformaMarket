/** Shared action appearance for framework links, preserving their router behaviour. */
export function dmLinkButtonProps({ appearance = "secondary", density = "default", className = "", fullWidth = false }: {
  appearance?: "primary" | "secondary" | "subtle";
  density?: "default" | "compact";
  className?: string;
  fullWidth?: boolean;
} = {}) {
  return {
    className: `dm-link-button ${className}`.trim(),
    "data-dm-appearance": appearance,
    "data-dm-density": density,
    "data-dm-full-width": fullWidth || undefined,
  };
}
