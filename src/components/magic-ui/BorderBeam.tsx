"use client";

/**
 * Magic UI Border Beam — animated gradient light yang jalan di sekeliling border.
 * License: MIT
 * Ref: https://magicui.design/docs/components/border-beam
 *
 * Parent butuh: relative + overflow-hidden + rounded (radius match).
 */
export function BorderBeam({
  size = 200,
  duration = 15,
  colorFrom = "#00b7e4",
  colorTo = "#0284c7",
  delay = 0,
}: {
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`,
        } as React.CSSProperties
      }
      className="pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--size)*1px)_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor,90)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]"
    />
  );
}
