import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, Play, Pause, Download, Loader2 } from "lucide-react";
import type { ProjectImage } from "@workspace/api-client-react";

interface VideoPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ProjectImage[];
  globalStory: string;
  audioFile?: File | null;
  audioElRef?: MutableRefObject<HTMLAudioElement | null>;
}

async function exportVideo(
  images: ProjectImage[],
  globalStory: string,
  audioFile: File | null | undefined,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);

  let audioSource: AudioBufferSourceNode | null = null;
  let audioCtx: AudioContext | null = null;

  if (audioFile) {
    audioCtx = new AudioContext();
    await audioCtx.resume();
    const buf = await audioFile.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buf);
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = decoded;
    const dest = audioCtx.createMediaStreamDestination();
    audioSource.connect(dest);
    audioSource.start(0);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(100);

  const totalMs = images.reduce((s, img) => s + (img.durationMs || 3000), 0);
  let elapsedMs = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const duration = img.durationMs || 3000;

    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = img.url;
    });

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.filter = "blur(20px)";
    ctx.globalAlpha = 0.5;
    const bgRatio = Math.max(W / (image.width || 1), H / (image.height || 1));
    const bgW = (image.width || W) * bgRatio;
    const bgH = (image.height || H) * bgRatio;
    ctx.drawImage(image, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH);
    ctx.restore();

    const ratio = Math.min(W / (image.width || W), H / (image.height || H));
    const iW = (image.width || W) * ratio;
    const iH = (image.height || H) * ratio;
    ctx.drawImage(image, (W - iW) / 2, (H - iH) / 2, iW, iH);


    const FPS = 30;
    const frames = Math.round((duration / 1000) * FPS);
    for (let f = 0; f < frames; f++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    elapsedMs += duration;
    onProgress(Math.round((elapsedMs / totalMs) * 100));
  }

  recorder.stop();
  audioSource?.stop();
  audioCtx?.close();

  return new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
}

export function VideoPreview({
  open,
  onOpenChange,
  images,
  globalStory,
  audioFile,
  audioElRef,
}: VideoPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // When dialog closes, pause the audio (which lives in the parent)
  useEffect(() => {
    if (!open) {
      const audio = audioElRef?.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentIndex(0);
    } else {
      setCurrentIndex(0);
      setIsPlaying(true);
      // Audio was already started synchronously in the parent's click handler
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Advance slides
  useEffect(() => {
    if (!open || !isPlaying || images.length === 0) return;
    const duration = images[currentIndex]?.durationMs || 3000;
    const timer = setTimeout(() => {
      if (currentIndex < images.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        setCurrentIndex(0);
        const audio = audioElRef?.current;
        if (audio) { audio.pause(); audio.currentTime = 0; }
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [open, isPlaying, currentIndex, images]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const audio = audioElRef?.current;
    if (isPlaying) {
      setIsPlaying(false);
      audio?.pause();
    } else {
      setIsPlaying(true);
      if (audio && audio.src) {
        audio.play().catch(() => {});
      }
    }
  };

  const handleDownload = useCallback(async () => {
    if (isExporting || images.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportVideo(images, globalStory, audioFile, setExportProgress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "story-video.webm";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [images, globalStory, audioFile, isExporting]);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none h-[80vh] flex flex-col justify-center items-center rounded-xl">
        <DialogTitle className="sr-only">Video Preview</DialogTitle>

        {/* Top-right controls */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Top-left: Download */}
        <div className="absolute top-4 left-4 z-50">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full gap-2 px-4"
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Exporting {exportProgress}%</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="text-sm">Download Video</span>
              </>
            )}
          </Button>
        </div>

        {/* Slides */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {images.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex items-center justify-center ${
                i === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              <div
                className="absolute inset-0 bg-center bg-cover bg-no-repeat blur-xl opacity-40 scale-110"
                style={{ backgroundImage: `url(${img.url})` }}
              />
              <img
                src={img.url}
                alt={img.title || "Story frame"}
                className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl"
              />
            </div>
          ))}

          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/10 z-20">
            <div
              className="h-full bg-primary transition-all ease-linear"
              style={{
                width: `${(currentIndex / Math.max(1, images.length - 1)) * 100}%`,
                transitionDuration: isPlaying ? `${currentImage?.durationMs || 3000}ms` : "0ms",
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
