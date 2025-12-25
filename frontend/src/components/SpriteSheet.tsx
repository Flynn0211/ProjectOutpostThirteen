import { useEffect, useMemo, useState } from "react";

type SpriteSheetProps = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  playing?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function SpriteSheet({
  src,
  frameWidth,
  frameHeight,
  fps = 12,
  playing = true,
  className,
  style,
}: SpriteSheetProps) {
  const [meta, setMeta] = useState<{ loaded: boolean; frameCount: number }>({
    loaded: false,
    frameCount: 1,
  });

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      const count = Math.max(1, Math.floor((img.naturalWidth || 0) / frameWidth));
      setMeta({ loaded: true, frameCount: count });
    };

    img.onerror = () => {
      if (cancelled) return;
      setMeta({ loaded: false, frameCount: 1 });
    };

    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, frameWidth]);

  const safeFps = Math.max(1, Math.min(60, fps));
  const durationSeconds = useMemo(() => meta.frameCount / safeFps, [meta.frameCount, safeFps]);
  const shouldPlay = playing && meta.loaded && meta.frameCount > 1;
  const spriteToX = `-${frameWidth * meta.frameCount}px`;

  return (
    <div
      className={["spriteSheet", shouldPlay ? "spriteSheet--play" : "", className || ""]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0px 0px",
        backgroundSize: `${frameWidth * meta.frameCount}px ${frameHeight}px`,
        imageRendering: "pixelated",
        animationDuration: `${durationSeconds}s`,
        animationTimingFunction: `steps(${meta.frameCount})`,
        ...(style || {}),
        ...(meta.loaded ? { ["--sprite-to-x" as any]: spriteToX } : {}),
      }}
    />
  );
}
