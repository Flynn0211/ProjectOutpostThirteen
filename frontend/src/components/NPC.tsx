import { useState } from "react";
import type { CSSProperties } from "react";
import type { NPC as NPCType } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { SpriteSheet } from "./SpriteSheet";

interface NPCProps {
  npc: NPCType;
  position: { x: number; y: number };
  isWalking: boolean;
  scale?: number;
  patrolDistance?: number;
  patrolDurationSeconds?: number;
  patrolDelaySeconds?: number;
}

export function NPCComponent({
  npc,
  position,
  isWalking,
  scale = 0.75,
  patrolDistance = 0,
  patrolDurationSeconds = 3.2,
  patrolDelaySeconds = 0,
}: NPCProps) {
  const spriteUrl = getNPCSpriteUrl(npc.rarity, npc.profession);

  // Support sprite naming conventions:
  // - "idle*" => never moves
  // - "walk*" => allowed to move when isWalking=true
  // This makes behavior deterministic when assets are split into idle/walk sheets.
  const spriteMode = (() => {
    const raw = String(spriteUrl ?? "");
    const last = raw.split(/[/?#]/).filter(Boolean).pop() ?? "";
    const name = decodeURIComponent(last).toLowerCase();
    if (name.startsWith("idle")) return "idle" as const;
    if (name.startsWith("walk")) return "walk" as const;
    return "unknown" as const;
  })();

  const effectiveWalking = isWalking && spriteMode !== "idle" && (spriteMode === "walk" || spriteMode === "unknown");
  const frameWidth = 128;
  const frameHeight = 128;

  const [sheetFrameCount, setSheetFrameCount] = useState<number | undefined>(undefined);

  const outerStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${frameWidth * scale}px`,
    height: `${frameHeight * scale}px`,
    animationName: effectiveWalking ? "npcPatrol" : "none",
    animationDuration: `${Math.max(1, patrolDurationSeconds)}s`,
    animationTimingFunction: "linear",
    animationIterationCount: effectiveWalking ? "infinite" : "1",
    animationDelay: `${Math.max(0, patrolDelaySeconds)}s`,
    ["--npc-patrol-distance" as any]: `${effectiveWalking ? Math.max(0, patrolDistance) : 0}px`,
  };

  const innerStyle: CSSProperties = {
    width: `${frameWidth}px`,
    height: `${frameHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  const has8Frames = (sheetFrameCount ?? 8) >= 8;
  const idleStartFrame = 0;
  const walkStartFrame = has8Frames ? 4 : 0;

  const startFrame = effectiveWalking ? walkStartFrame : idleStartFrame;
  const rangeFrameCount = effectiveWalking
    ? Math.max(1, Math.min(4, sheetFrameCount ?? 4))
    : has8Frames
      ? 4
      : 1;

  const shouldAnimate = effectiveWalking ? true : has8Frames;

  return (
    <div className="absolute pointer-events-auto" style={outerStyle}>
      <div style={innerStyle}>
        <SpriteSheet
          src={spriteUrl}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          fps={12}
          startFrame={startFrame}
          frameCount={rangeFrameCount}
          playing={shouldAnimate}
          onMeta={(m) => setSheetFrameCount(m.frameCount)}
        />
      </div>
    </div>
  );
}


