import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSign: (data: string, type: "drawn" | "typed") => void;
  width?: number;
  height?: number;
}

export default function SignaturePad({ onSign, width = 500, height = 200 }: SignaturePadProps) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }, []);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e);
      lastPointRef.current = pos;
      const ctx = getContext();
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    },
    [getContext, getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = getContext();
      if (!ctx) return;
      const pos = getPos(e);
      const last = lastPointRef.current;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      lastPointRef.current = pos;
      setHasDrawn(true);
    },
    [getContext, getPos]
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // Initialize canvas with white background
  useEffect(() => {
    if (mode === "draw") {
      clearCanvas();
    }
  }, [mode, clearCanvas]);

  const handleSubmit = () => {
    if (mode === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const dataUrl = canvas.toDataURL("image/png");
      onSign(dataUrl, "drawn");
    } else {
      if (!typedName.trim()) return;
      onSign(typedName.trim(), "typed");
    }
  };

  const isValid = mode === "draw" ? hasDrawn : typedName.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setMode("draw")}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            mode === "draw"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          חתימה ידנית
        </button>
        <button
          onClick={() => setMode("type")}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            mode === "type"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          הקלדה
        </button>
      </div>

      {/* Draw Mode */}
      {mode === "draw" && (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">חתום באמצעות העכבר או מסך מגע</p>
            <button
              onClick={clearCanvas}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              נקה
            </button>
          </div>
        </div>
      )}

      {/* Type Mode */}
      {mode === "type" && (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-border rounded-lg p-6 bg-white">
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="הקלד את שמך המלא"
              className="w-full text-center text-3xl bg-transparent border-0 border-b-2 border-gray-300 focus:border-primary focus:outline-none pb-2 text-black"
              style={{ fontFamily: "cursive" }}
              dir="rtl"
            />
          </div>
          {typedName && (
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl text-black" style={{ fontFamily: "cursive" }}>
                {typedName}
              </p>
              <p className="text-xs text-muted-foreground mt-2">תצוגה מקדימה של החתימה</p>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        חתום על החוזה
      </button>
    </div>
  );
}
