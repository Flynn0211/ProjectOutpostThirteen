import { useEffect, useMemo, useState } from "react";

type SpriteSheetProps = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  playing?: boolean;
  startFrame?: number;
  frameCount?: number;
  onMeta?: (meta: { loaded: boolean; frameCount: number }) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function SpriteSheet({
  src,
  frameWidth,
  frameHeight,
  fps = 12,
  playing = true,
  startFrame = 0,
  frameCount,
  onMeta,
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
      const next = { loaded: true, frameCount: count };
      setMeta(next);
      onMeta?.(next);
    };

    img.onerror = () => {
      if (cancelled) return;
      const next = { loaded: false, frameCount: 1 };
      setMeta(next);
      onMeta?.(next);
    };

    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, frameWidth, onMeta]);

  const safeFps = Math.max(1, Math.min(60, fps));
  const safeStartFrame = Math.max(0, Math.min(startFrame, Math.max(0, meta.frameCount - 1)));
  const playableFrameCount = useMemo(() => {
    if (!meta.loaded) return 1;
    const remaining = Math.max(1, meta.frameCount - safeStartFrame);
    if (typeof frameCount === "number") {
      return Math.max(1, Math.min(frameCount, remaining));
    }
    return remaining;
  }, [frameCount, meta.frameCount, meta.loaded, safeStartFrame]);

  const durationSeconds = useMemo(
    () => playableFrameCount / safeFps,
    [playableFrameCount, safeFps]
  );

  const shouldPlay = playing && meta.loaded && playableFrameCount > 1;
  const spriteFromX = `-${frameWidth * safeStartFrame}px`;
  const spriteToX = `-${frameWidth * (safeStartFrame + playableFrameCount)}px`;

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
        backgroundPosition: `${spriteFromX} 0px`,
        backgroundSize: `${frameWidth * meta.frameCount}px ${frameHeight}px`,
        imageRendering: "pixelated",
        animationDuration: `${durationSeconds}s`,
        animationTimingFunction: `steps(${playableFrameCount})`,
        ...(style || {}),
        ...(meta.loaded
          ? {
              ["--sprite-from-x" as any]: spriteFromX,
              ["--sprite-to-x" as any]: spriteToX,
            }
          : {}),
      }}
    />
  );
}
