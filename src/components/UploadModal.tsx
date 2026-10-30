'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Check, Video, AlertCircle, Crosshair, Sparkles, Cpu } from 'lucide-react';
import { Point2D, BoundingBox } from '@/lib/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessVideo: (data: {
    videoFile: File;
    videoUrl: string;
    width: number;
    height: number;
    fps: number;
    initialBobPoint: Point2D;
    initialBobBox?: BoundingBox;
    pivot: Point2D;
    knownLengthMeters: number | null;
    useLocalTracker?: boolean;
  }) => void;
  isDemoMode: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onProcessVideo,
  isDemoMode
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480
  });
  const [durationSec, setDurationSec] = useState<number>(0);
  const [fps, setFps] = useState<number>(30);
  const [pivot, setPivot] = useState<Point2D>({ x: 320, y: 80 });
  const [initialBob, setInitialBob] = useState<Point2D>({ x: 420, y: 320 });
  const [knownLength, setKnownLength] = useState<string>('0.50');
  const [selectionMode, setSelectionMode] = useState<'pivot' | 'bob'>('bob');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [trackerMode, setTrackerMode] = useState<'local' | 'sam'>(isDemoMode ? 'local' : 'sam');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setTrackerMode(isDemoMode ? 'local' : 'sam');
  }, [isDemoMode]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('mp4') && !file.type.includes('quicktime') && !file.type.includes('video/')) {
      setUploadError('Invalid format. Please upload an MP4 or MOV video file.');
      return;
    }

    if (file.size > 35 * 1024 * 1024) {
      setUploadError('File size exceeds 35MB limit. Please upload a short clip (3-8 seconds recommended).');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const dur = video.duration || 4.0;

    setVideoDimensions({ width: w, height: h });
    setDurationSec(dur);
    setPivot({ x: Math.round(w / 2), y: Math.round(h * 0.15) });
    setInitialBob({ x: Math.round(w * 0.65), y: Math.round(h * 0.7) });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = videoDimensions.width / rect.width;
    const scaleY = videoDimensions.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (selectionMode === 'pivot') {
      setPivot({ x, y });
    } else {
      setInitialBob({ x, y });
    }
  };

  const handleSubmit = () => {
    if (!selectedFile || !videoPreviewUrl) {
      setUploadError('Please choose a video file first.');
      return;
    }

    const parsedLen = parseFloat(knownLength);
    onProcessVideo({
      videoFile: selectedFile,
      videoUrl: videoPreviewUrl,
      width: videoDimensions.width,
      height: videoDimensions.height,
      fps: fps > 0 ? fps : 30,
      pivot,
      initialBobPoint: initialBob,
      knownLengthMeters: !isNaN(parsedLen) && parsedLen > 0 ? parsedLen : null,
      useLocalTracker: trackerMode === 'local'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-750 rounded-lg max-w-2xl w-full p-5 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-graphite-800">
          <div className="flex items-center gap-2 text-graphite-100 font-mono font-semibold text-sm">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>UPLOAD PENDULUM FOOTAGE</span>
          </div>
          <button
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine mode selector */}
        <div className="mt-3 p-2.5 rounded bg-graphite-850 border border-graphite-800 text-[11px] font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-graphite-300">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Tracking Engine:</span>
            {trackerMode === 'local' ? (
              <span className="text-emerald-300 font-semibold">
                In-Browser Optical Tracker (Zero API Keys Required)
              </span>
            ) : (
              <span className="text-blue-300 font-semibold">
                Meta SAM 3.1 Cloud Responses Stream
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTrackerMode('local')}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                trackerMode === 'local'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-graphite-400 hover:text-graphite-200'
              }`}
            >
              Client-Side (Local)
            </button>
            <button
              onClick={() => setTrackerMode('sam')}
              className={`px-2 py-0.5 rounded text-[10px] transition ${
                trackerMode === 'sam'
                  ? 'bg-blue-950/60 text-blue-300 border border-blue-500/40 font-semibold'
                  : 'text-graphite-400 hover:text-graphite-200'
              }`}
            >
              Meta SAM 3.1
            </button>
          </div>
        </div>

        <div className="py-3.5 space-y-3.5 font-mono text-xs">
          {/* File Picker */}
          {!videoPreviewUrl ? (
            <div className="border border-dashed border-graphite-700 hover:border-blue-500 rounded-lg p-8 text-center transition cursor-pointer bg-graphite-950/60">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload-input"
              />
              <label
                htmlFor="video-upload-input"
                className="cursor-pointer flex flex-col items-center"
              >
                <Video className="w-8 h-8 text-blue-400 mb-2" />
                <span className="text-xs font-semibold text-graphite-200">
                  Select a pendulum video recording (MP4 or MOV)
                </span>
                <span className="text-[10px] text-graphite-500 mt-1">
                  2-8 seconds recommended • Planar swing • Max 35MB
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Video Preview and Click Setup */}
              <div
                onClick={handleCanvasClick}
                className="relative rounded border border-graphite-800 bg-graphite-950 aspect-video flex items-center justify-center overflow-hidden cursor-crosshair group"
              >
                <video
                  ref={videoRef}
                  src={videoPreviewUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  className="max-h-full max-w-full object-contain pointer-events-none"
                  muted
                />

                {/* Overlaid markers */}
                {videoDimensions.width > 0 && (
                  <>
                    {/* Pivot Crosshair */}
                    <div
                      className="absolute w-4 h-4 -ml-2 -mt-2 border-2 border-blue-400 rounded-full flex items-center justify-center pointer-events-none shadow"
                      style={{
                        left: `${(pivot.x / videoDimensions.width) * 100}%`,
                        top: `${(pivot.y / videoDimensions.height) * 100}%`
                      }}
                    >
                      <div className="w-1 h-1 bg-blue-400 rounded-full" />
                    </div>

                    {/* Bob Marker */}
                    <div
                      className="absolute w-6 h-6 -ml-3 -mt-3 border-2 border-emerald-400 rounded-full flex items-center justify-center pointer-events-none shadow animate-pulse"
                      style={{
                        left: `${(initialBob.x / videoDimensions.width) * 100}%`,
                        top: `${(initialBob.y / videoDimensions.height) * 100}%`
                      }}
                    >
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    </div>
                  </>
                )}

                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] text-graphite-300 pointer-events-none font-mono">
                  Click video to set {selectionMode.toUpperCase()} position
                </div>
              </div>

              {/* Selection Guide */}
              <div className="flex items-center justify-between p-2 rounded bg-graphite-850 border border-graphite-800">
                <div className="flex items-center gap-2">
                  <span className="text-graphite-400 text-[11px]">POSITION MARKERS:</span>
                  <button
                    onClick={() => setSelectionMode('bob')}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      selectionMode === 'bob'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-graphite-800 border-graphite-700 text-graphite-400'
                    }`}
                  >
                    Bob Point: ({initialBob.x}, {initialBob.y})
                  </button>
                  <button
                    onClick={() => setSelectionMode('pivot')}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      selectionMode === 'pivot'
                        ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                        : 'bg-graphite-800 border-graphite-700 text-graphite-400'
                    }`}
                  >
                    Pivot Point: ({pivot.x}, {pivot.y})
                  </button>
                </div>

                <div className="text-[10px] text-graphite-400 tabular-nums">
                  {videoDimensions.width}x{videoDimensions.height} px • {durationSec.toFixed(1)}s
                </div>
              </div>

              {/* Calibration Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-graphite-400 mb-1 text-[11px]">
                    Known Length L (Meters)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={knownLength}
                    onChange={(e) => setKnownLength(e.target.value)}
                    placeholder="0.50 (optional)"
                    className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-graphite-400 mb-1 text-[11px]">
                    Frame Rate (FPS)
                  </label>
                  <input
                    type="number"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-2.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[11px]">
              {uploadError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-graphite-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-graphite-800 text-graphite-300 hover:bg-graphite-750 text-xs font-mono transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFile}
            className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs font-mono transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Analyze Video
          </button>
        </div>
      </div>
    </div>
  );
};
