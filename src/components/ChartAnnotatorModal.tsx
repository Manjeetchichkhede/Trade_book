import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Minus,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';

interface ChartAnnotatorModalProps {
  open: boolean;
  title: string;
  imageUrl: string | null;
  onSave: (annotatedDataUrl: string) => void;
  onClose: () => void;
}

type ToolType = 'pen' | 'line' | 'arrow' | 'box' | 'hline' | 'text';

interface StrokeShape {
  tool: ToolType;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
}

const COLOR_SWATCHES = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#a855f7', '#ffffff'];
const STROKE_WIDTHS = [2, 4, 6];

export const ChartAnnotatorModal: React.FC<ChartAnnotatorModalProps> = ({
  open,
  title,
  imageUrl,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<ToolType>('arrow');
  const [color, setColor] = useState<string>('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [shapes, setShapes] = useState<StrokeShape[]>([]);
  const [redoStack, setRedoStack] = useState<StrokeShape[]>([]);
  const [draftShape, setDraftShape] = useState<StrokeShape | null>(null);
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number }>({ w: 960, h: 540 });
  const [imageReady, setImageReady] = useState(false);

  // Text callout placement state
  const [pendingTextPt, setPendingTextPt] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    if (!open || !imageUrl) return;
    setShapes([]);
    setRedoStack([]);
    setDraftShape(null);
    setPendingTextPt(null);
    setTextInput('');
    setImageReady(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
      const maxW = 1280;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      const w = Math.max(400, Math.round(img.naturalWidth * scale));
      const h = Math.max(240, Math.round(img.naturalHeight * scale));
      setCanvasDims({ w, h });
      setImageReady(true);
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, s: StrokeShape, canvasW: number) => {
      if (s.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const start = s.points[0];
      const end = s.points[s.points.length - 1];

      if (s.tool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (s.tool === 'hline') {
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, end.y);
        ctx.lineTo(canvasW, end.y);
        ctx.stroke();
      } else if (s.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(12, s.width * 4);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (s.tool === 'box') {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        ctx.strokeRect(x, y, w, h);
      } else if (s.tool === 'text' && s.text) {
        const fontSize = Math.max(16, s.width * 4 + 8);
        ctx.font = `700 ${fontSize}px Inter, sans-serif`;
        const metrics = ctx.measureText(s.text);
        const padX = 8;
        const padY = 5;
        ctx.fillStyle = 'rgba(6, 10, 20, 0.82)';
        ctx.fillRect(
          start.x - padX,
          start.y - fontSize - padY + 4,
          metrics.width + padX * 2,
          fontSize + padY * 2
        );
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          start.x - padX,
          start.y - fontSize - padY + 4,
          metrics.width + padX * 2,
          fontSize + padY * 2
        );
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, start.x, start.y);
      }

      ctx.restore();
    },
    []
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = bgImageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const s of shapes) {
      drawShape(ctx, s, canvas.width);
    }
    if (draftShape) {
      drawShape(ctx, draftShape, canvas.width);
    }
  }, [shapes, draftShape, drawShape]);

  useEffect(() => {
    if (imageReady) redraw();
  }, [imageReady, redraw, canvasDims]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (tool === 'text') {
      setPendingTextPt(pt);
      setTextInput('');
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraftShape({
      tool,
      color,
      width: strokeWidth,
      points: [pt],
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftShape) return;
    const pt = getCanvasPoint(e);
    setDraftShape((prev) => {
      if (!prev) return null;
      if (prev.tool === 'pen') {
        return { ...prev, points: [...prev.points, pt] };
      }
      return { ...prev, points: [prev.points[0], pt] };
    });
  };

  const handlePointerUp = () => {
    if (!draftShape) return;
    setShapes((prev) => [...prev, draftShape]);
    setRedoStack([]);
    setDraftShape(null);
  };

  const handleCommitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTextPt || !textInput.trim()) {
      setPendingTextPt(null);
      return;
    }
    setShapes((prev) => [
      ...prev,
      {
        tool: 'text',
        color,
        width: strokeWidth,
        points: [pendingTextPt],
        text: textInput.trim(),
      },
    ]);
    setRedoStack([]);
    setPendingTextPt(null);
    setTextInput('');
  };

  const handleUndo = () => {
    if (shapes.length === 0) return;
    const last = shapes[shapes.length - 1];
    setShapes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setShapes((prev) => [...prev, restored]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  if (!open || !imageUrl) return null;

  const TOOLS: { id: ToolType; label: string; Icon: React.ComponentType<{ className?: string }> }[] =
    [
      { id: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
      { id: 'box', label: 'Zone / BB', Icon: Square },
      { id: 'hline', label: 'Liq Level', Icon: Minus },
      { id: 'line', label: 'Line', Icon: Minus },
      { id: 'pen', label: 'Pen', Icon: Pencil },
      { id: 'text', label: 'Label', Icon: Type },
    ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="tb-glass w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl p-4 sm:p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Chart Annotation Studio · {title}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Mark Liquidity Sweeps, CISD levels, Breaker Blocks, arrows, and callout text directly
              on your screenshot.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="tb-btn-ghost rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Annotated Chart
            </button>
          </div>
        </div>

        {/* Drawing Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-2.5">
          {/* Tool Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            {TOOLS.map(({ id, label, Icon }) => {
              const active = tool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--nav-pill)' : 'transparent',
                    color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Colors & Stroke Width */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Color ${swatch}`}
                  className="h-6 w-6 rounded-full cursor-pointer transition-transform"
                  style={{
                    backgroundColor: swatch,
                    transform: color === swatch ? 'scale(1.18)' : 'scale(1)',
                    border:
                      color === swatch
                        ? '2px solid var(--text-primary)'
                        : '1px solid rgba(255,255,255,0.28)',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-3">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidth(w)}
                  className="rounded-lg px-2 py-1 font-mono-num text-[11px] font-semibold cursor-pointer"
                  style={{
                    backgroundColor: strokeWidth === w ? 'var(--accent-soft)' : 'transparent',
                    color: strokeWidth === w ? 'var(--accent-text)' : 'var(--text-muted)',
                  }}
                >
                  {w}px
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-3">
              <button
                type="button"
                onClick={handleUndo}
                disabled={shapes.length === 0}
                title="Undo"
                className="tb-btn-ghost p-1.5 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo"
                className="tb-btn-ghost p-1.5 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShapes([]);
                  setRedoStack([]);
                }}
                disabled={shapes.length === 0}
                title="Clear all drawings"
                className="tb-btn-ghost p-1.5 rounded-lg text-rose-400 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Text Callout Inline Input when Text Tool Clicked */}
        {pendingTextPt && (
          <form
            onSubmit={handleCommitText}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 py-2"
          >
            <span className="text-xs font-semibold text-[var(--accent-text)]">
              Place Chart Label:
            </span>
            <input
              type="text"
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="e.g. BSL Sweep, CISD, Breaker Block"
              className="tb-input flex-1 min-w-[200px] rounded-lg px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="tb-btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Add Label
            </button>
            <button
              type="button"
              onClick={() => setPendingTextPt(null)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Canvas Viewport */}
        <div className="flex-1 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[#050912] flex items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            width={canvasDims.w}
            height={canvasDims.h}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-w-full max-h-[62vh] h-auto w-auto touch-none cursor-crosshair rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};
