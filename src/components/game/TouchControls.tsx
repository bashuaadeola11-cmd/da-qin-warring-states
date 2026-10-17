import { useRef, useState, useCallback } from "react";
import type { GameEngine } from "@/game/engine";

// Virtual touch controls: left joystick to move, right half drag to look,
// fire / aim / jump / weapon buttons. All targets >= 44px.

export function TouchControls({ engine }: { engine: () => GameEngine | null }) {
  const joyRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const [joy, setJoy] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const joyTouch = useRef<number | null>(null);
  const lookTouch = useRef<{ id: number; x: number; y: number } | null>(null);
  const [aimOn, setAimOn] = useState(false);

  const handleJoy = useCallback(
    (e: React.TouchEvent) => {
      const eng = engine();
      if (!eng) return;
      for (const t of Array.from(e.changedTouches)) {
        if (e.type === "touchstart" && joyTouch.current === null) {
          joyTouch.current = t.identifier;
        }
        if (t.identifier === joyTouch.current) {
          if (e.type === "touchend" || e.type === "touchcancel") {
            joyTouch.current = null;
            setJoy({ x: 0, y: 0, active: false });
            eng.setTouchMove(0, 0);
          } else {
            const rect = joyRef.current!.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = (t.clientX - cx) / (rect.width / 2);
            let dy = (t.clientY - cy) / (rect.height / 2);
            const len = Math.hypot(dx, dy);
            if (len > 1) {
              dx /= len;
              dy /= len;
            }
            setJoy({ x: dx, y: dy, active: true });
            eng.setTouchMove(dx, -dy);
          }
        }
      }
      e.preventDefault();
    },
    [engine]
  );

  const handleLook = useCallback(
    (e: React.TouchEvent) => {
      const eng = engine();
      if (!eng) return;
      for (const t of Array.from(e.changedTouches)) {
        if (e.type === "touchstart" && lookTouch.current === null) {
          lookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else if (lookTouch.current && t.identifier === lookTouch.current.id) {
          if (e.type === "touchend" || e.type === "touchcancel") {
            lookTouch.current = null;
          } else {
            eng.addTouchLook(t.clientX - lookTouch.current.x, t.clientY - lookTouch.current.y);
            lookTouch.current = { id: t.identifier, x: t.clientX, y: t.clientY };
          }
        }
      }
      e.preventDefault();
    },
    [engine]
  );

  const btn =
    "pointer-events-auto flex items-center justify-center rounded-full border border-[#ece4d0]/30 bg-black/45 text-[#ece4d0] active:bg-[#c53a24]/60 transition-colors";

  return (
    <div className="absolute inset-0 z-30" style={{ pointerEvents: "none" }}>
      {/* look area: right 60% */}
      <div
        ref={lookRef}
        className="absolute bottom-0 right-0 top-0 w-[62%]"
        style={{ pointerEvents: "auto", touchAction: "none" }}
        onTouchStart={handleLook}
        onTouchMove={handleLook}
        onTouchEnd={handleLook}
        onTouchCancel={handleLook}
      />
      {/* movement joystick */}
      <div
        ref={joyRef}
        className="absolute bottom-24 left-4 h-32 w-32 rounded-full border border-[#ece4d0]/25 bg-black/30"
        style={{ pointerEvents: "auto", touchAction: "none" }}
        onTouchStart={handleJoy}
        onTouchMove={handleJoy}
        onTouchEnd={handleJoy}
        onTouchCancel={handleJoy}
      >
        <div
          className="absolute h-14 w-14 rounded-full border border-[#ece4d0]/50 bg-[#ece4d0]/20"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${joy.x * 34}px), calc(-50% + ${joy.y * 34}px))`,
          }}
        />
      </div>

      {/* fire */}
      <button
        aria-label="Fire"
        className={`${btn} absolute bottom-24 right-5 h-20 w-20 text-sm font-bold tracking-widest`}
        style={{ touchAction: "none" }}
        onTouchStart={(e) => {
          e.preventDefault();
          engine()?.touchFire();
        }}
      >
        FIRE
      </button>
      {/* aim toggle */}
      <button
        aria-label="Aim"
        className={`${btn} absolute bottom-[188px] right-8 h-12 w-12 text-[11px] font-semibold ${
          aimOn ? "!bg-[#c53a24]/60" : ""
        }`}
        style={{ touchAction: "none" }}
        onTouchStart={(e) => {
          e.preventDefault();
          const next = !aimOn;
          setAimOn(next);
          engine()?.touchAim(next);
        }}
      >
        AIM
      </button>
      {/* jump */}
      <button
        aria-label="Jump"
        className={`${btn} absolute bottom-[120px] right-[116px] h-12 w-12 text-[11px] font-semibold`}
        style={{ touchAction: "none" }}
        onTouchStart={(e) => {
          e.preventDefault();
          engine()?.touchJump();
        }}
      >
        JUMP
      </button>
      {/* weapon switch */}
      <button
        aria-label="Switch weapon"
        className={`${btn} absolute bottom-[52px] right-[128px] h-12 w-12 text-[11px] font-semibold`}
        style={{ touchAction: "none" }}
        onTouchStart={(e) => {
          e.preventDefault();
          engine()?.touchSwitch();
        }}
      >
        劍/弩
      </button>
    </div>
  );
}
