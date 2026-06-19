import { useEffect, useRef } from "react";
import { useCameraStore } from "@/store/camera";

interface DragState {
  active: boolean;
  lastX: number;
  lastY: number;
  pointerId: number;
}

const ROTATE_SPEED = 0.25;
const ELEVATION_SPEED = 0.2;

export function useOrbitControl(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const dragRef = useRef<DragState>({ active: false, lastX: 0, lastY: 0, pointerId: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragRef.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      const cam = useCameraStore.getState();
      cam.rotate(dx * ROTATE_SPEED, -dy * ELEVATION_SPEED);
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      canvas.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = useCameraStore.getState();
      const delta = Math.sign(e.deltaY) * 2.5;
      cam.zoom(delta);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canvasRef]);
}
