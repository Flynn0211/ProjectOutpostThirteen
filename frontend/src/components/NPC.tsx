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
  const frameWidth = 128;
  const frameHeight = 128;

  const [sheetFrameCount, setSheetFrameCount] = useState<number | undefined>(undefined);

  const outerStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${frameWidth * scale}px`,
    height: `${frameHeight * scale}px`,
    animationName: isWalking ? "npcPatrol" : "none",
    animationDuration: `${Math.max(1, patrolDurationSeconds)}s`,
    animationTimingFunction: "linear",
    animationIterationCount: isWalking ? "infinite" : "1",
    animationDelay: `${Math.max(0, patrolDelaySeconds)}s`,
    ["--npc-patrol-distance" as any]: `${isWalking ? Math.max(0, patrolDistance) : 0}px`,
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

  const startFrame = isWalking ? walkStartFrame : idleStartFrame;
  const rangeFrameCount = isWalking
    ? Math.max(1, Math.min(4, sheetFrameCount ?? 4))
    : has8Frames
      ? 4
      : 1;

  const shouldAnimate = isWalking ? true : has8Frames;

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


