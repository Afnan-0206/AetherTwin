'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  Check,
  Video,
  AlertCircle,
  Crosshair,
  Sparkles,
  Cpu,
  Camera,
  CircleDot,
  RotateCcw
} from 'lucide-react';
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
  initialFile?: File | null;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onProcessVideo,
  isDemoMode,
  initialFile
}) => {
  const [inputTab, setInputTab] = useState<'upload' | 'webcam'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isDropZoneOver, setIsDropZoneOver] = useState<boolean>(false);
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

  // Webcam states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingSecondsRemaining, setRecordingSecondsRemaining] = useState<number>(4);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const webcamRequestIdRef = useRef<number>(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTrackerMode(isDemoMode ? 'local' : 'sam');
  }, [isDemoMode]);

  // Clean up camera stream, timers, and recorder on unmount or tab change
  const stopCameraStream = () => {
    webcamRequestIdRef.current++;

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.ondataavailable = null;
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore interruption
        }
      }
      mediaRecorderRef.current = null;
    }

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsRecording(false);
    setCountdown(null);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen]);

  const startWebcam = async () => {
    stopCameraStream();
    const requestId = ++webcamRequestIdRef.current;
    setUploadError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      // If modal closed, tab changed, or subsequent request was issued while waiting
      if (requestId !== webcamRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: any) {
      if (requestId !== webcamRequestIdRef.current) return;
      console.error('Camera error:', err);
      setUploadError('Camera access denied or unavailable. You can upload a recorded video file instead.');
    }
  };

  const handleStartCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          startRecordingWebcam();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecordingWebcam = () => {
    if (!webcamStreamRef.current) return;
    recordedChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(webcamStreamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], 'webcam_swing.webm', { type: 'video/webm' });
        setSelectedFile(file);
        const url = URL.createObjectURL(blob);
        setVideoPreviewUrl(url);

        stopCameraStream();

        // Switch to video preview
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = url;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingSecondsRemaining(4);

      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }

      recordTimerRef.current = setInterval(() => {
        setRecordingSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (recordTimerRef.current) {
              clearInterval(recordTimerRef.current);
              recordTimerRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setUploadError('Failed to record from webcam: ' + err.message);
    }
  };

  const loadVideoFile = useCallback((file: File) => {
    setUploadError(null);
    if (!file.type.includes('mp4') && !file.type.includes('quicktime') && !file.type.includes('video/')) {
      setUploadError('Invalid format. Please upload an MP4, WEBM, or MOV video file.');
      return;
    }

    if (file.size > 35 * 1024 * 1024) {
      setUploadError('File size exceeds 35MB limit. Please upload a short clip (3-8 seconds recommended).');
      return;
    }

    setVideoPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    setSelectedFile(file);
    setInputTab('upload');
  }, []);

  useEffect(() => {
    if (isOpen && initialFile) {
      loadVideoFile(initialFile);
    }
  }, [isOpen, initialFile, loadVideoFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadVideoFile(file);
    }
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
      setUploadError('Please select or record a video first.');
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
    stopCameraStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-750 rounded-lg max-w-2xl w-full p-5 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-graphite-800">
          <div className="flex items-center gap-2 text-graphite-100 font-mono font-semibold text-sm">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>VIDEO SOURCE // PENDULUM INGEST</span>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="text-graphite-400 hover:text-graphite-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Navigation: File vs Webcam */}
        <div className="mt-3 flex items-center justify-between border-b border-graphite-800 pb-2.5 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                stopCameraStream();
                setInputTab('upload');
              }}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                inputTab === 'upload'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-graphite-800 text-graphite-400 hover:text-graphite-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Upload Video File</span>
            </button>
            <button
              onClick={() => {
                if (videoPreviewUrl) {
                  URL.revokeObjectURL(videoPreviewUrl);
                  setVideoPreviewUrl(null);
                }
                setSelectedFile(null);
                setInputTab('webcam');
                startWebcam();
              }}
              className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                inputTab === 'webcam'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-graphite-800 text-graphite-400 hover:text-graphite-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Record Live Webcam</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-graphite-500">ENGINE:</span>
            <button
              onClick={() => setTrackerMode('local')}
              className={`px-1.5 py-0.5 rounded transition ${
                trackerMode === 'local'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-graphite-400 hover:text-graphite-200'
              }`}
            >
              Local Optical Flow
            </button>
            <button
              onClick={() => setTrackerMode('sam')}
              className={`px-1.5 py-0.5 rounded transition ${
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
          {/* TAB 1: FILE PICKER */}
          {inputTab === 'upload' && !videoPreviewUrl && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDropZoneOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDropZoneOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDropZoneOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  loadVideoFile(file);
                }
              }}
              className={`border border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                isDropZoneOver
                  ? 'border-blue-400 bg-blue-950/40 ring-2 ring-blue-500/40'
                  : 'border-graphite-700 hover:border-blue-500 bg-graphite-950/60'
              }`}
            >
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
                <Video className={`w-8 h-8 mb-2 transition-transform ${isDropZoneOver ? 'text-blue-300 scale-110' : 'text-blue-400'}`} />
                <span className="text-xs font-semibold text-graphite-200">
                  {isDropZoneOver ? 'Drop pendulum video now' : 'Select or drag & drop a pendulum video (MP4 or MOV)'}
                </span>
                <span className="text-[10px] text-graphite-500 mt-1">
                  2-8 seconds recommended • Planar swing • Max 35MB
                </span>
              </label>
            </div>
          )}

          {/* TAB 2: LIVE WEBCAM RECORDING */}
          {inputTab === 'webcam' && !videoPreviewUrl && (
            <div className="space-y-3">
              <div className="relative rounded border border-graphite-800 bg-graphite-950 aspect-video flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  className="max-h-full max-w-full object-contain"
                  autoPlay
                  muted
                  playsInline
                />

                {/* Countdown Overlay */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <span className="text-6xl font-bold text-amber-400 animate-pulse">
                      {countdown}
                    </span>
                    <span className="text-xs text-graphite-300 mt-2">
                      Get ready to swing your object...
                    </span>
                  </div>
                )}

                {/* Recording Progress Badge */}
                {isRecording && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-rose-600/90 text-white font-mono text-[11px] flex items-center gap-2 animate-pulse shadow-md">
                    <CircleDot className="w-3.5 h-3.5 fill-current" />
                    <span>RECORDING... {recordingSecondsRemaining}s</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-graphite-850 border border-graphite-800">
                <span className="text-[11px] text-graphite-300">
                  Hold a dangling headphone cord, lanyard, or weight in camera view.
                </span>
                {!isRecording && countdown === null && (
                  <button
                    onClick={handleStartCountdown}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition"
                  >
                    <CircleDot className="w-3.5 h-3.5 fill-current" />
                    <span>Record 4-Second Clip</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIDEO PREVIEW & BOB/PIVOT MARKER SELECTION */}
          {videoPreviewUrl && (
            <div className="space-y-3">
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

              {/* Selection Controls */}
              <div className="flex items-center justify-between p-2 rounded bg-graphite-850 border border-graphite-800">
                <div className="flex items-center gap-2">
                  <span className="text-graphite-400 text-[11px]">MARKERS:</span>
                  <button
                    onClick={() => setSelectionMode('bob')}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      selectionMode === 'bob'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-graphite-800 border-graphite-700 text-graphite-400'
                    }`}
                  >
                    Bob: ({initialBob.x}, {initialBob.y})
                  </button>
                  <button
                    onClick={() => setSelectionMode('pivot')}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      selectionMode === 'pivot'
                        ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                        : 'bg-graphite-800 border-graphite-700 text-graphite-400'
                    }`}
                  >
                    Pivot: ({pivot.x}, {pivot.y})
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoPreviewUrl(null);
                    if (inputTab === 'webcam') startWebcam();
                  }}
                  className="text-graphite-400 hover:text-graphite-200 text-[10px] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retake</span>
                </button>
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
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
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
