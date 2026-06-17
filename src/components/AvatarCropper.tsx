import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { ZoomIn } from "lucide-react";

interface Props {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string, file: File) => void;
}

const VIEW = 280; // tamanho do círculo de recorte na tela
const OUT = 512; // resolução de saída

// Recorte de foto estilo Instagram/WhatsApp: arrastar para posicionar + zoom.
export function AvatarCropper({ open, imageSrc, onCancel, onConfirm }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const base = Math.max(VIEW / img.width, VIEW / img.height);
      setNatural({ w: img.width, h: img.height });
      setBaseScale(base);
      setZoom(1);
      const dispW = img.width * base;
      const dispH = img.height * base;
      setOffset({ x: (VIEW - dispW) / 2, y: (VIEW - dispH) / 2 });
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  const dispW = natural.w * baseScale * zoom;
  const dispH = natural.h * baseScale * zoom;

  const clampOffset = (o: { x: number; y: number }, dW: number, dH: number) => ({
    x: Math.min(0, Math.max(VIEW - dW, o.x)),
    y: Math.min(0, Math.max(VIEW - dH, o.y)),
  });

  const onZoom = (z: number) => {
    const center = VIEW / 2;
    const ix = (center - offset.x) / (baseScale * zoom);
    const iy = (center - offset.y) / (baseScale * zoom);
    const newOffX = center - ix * baseScale * z;
    const newOffY = center - iy * baseScale * z;
    const ndW = natural.w * baseScale * z;
    const ndH = natural.h * baseScale * z;
    setZoom(z);
    setOffset(clampOffset({ x: newOffX, y: newOffY }, ndW, ndH));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }, dispW, dispH));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = baseScale * zoom;
    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    const srcSize = VIEW / scale;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(dataUrl, new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pt-2">
          <div
            className="relative overflow-hidden bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW, borderRadius: "9999px" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {imageSrc && (
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                style={{ position: "absolute", left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: "none" }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/70" />
          </div>
          <div className="flex items-center gap-2 w-full px-2">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">Arraste para posicionar · use o controle para dar zoom</p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={confirm}>
              Usar foto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
