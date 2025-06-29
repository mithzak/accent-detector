import React, { useState, useRef, useCallback } from 'react';
import { type RecordingState, type AnalysisResult } from './types';
import { analyzeAudio } from './services/geminiService';
import { MicrophoneIcon, StopIcon, LoaderIcon, RefreshIcon } from './components/Icons';
import ResultDisplay from './components/ResultDisplay';

// --- Voice Visualizer Component ---
const NUM_BARS = 32;
const VoiceVisualizer: React.FC<{ dataArray: Uint8Array | null }> = ({ dataArray }) => {
  const bars = Array.from({ length: NUM_BARS }).map((_, i) => {
    const dataIndex = Math.floor((dataArray?.length ?? 0) / NUM_BARS * i);
    const barHeight = dataArray ? (dataArray[dataIndex] / 255) * 100 : 0;
    
    return (
      <div
        key={i}
        className="w-2 bg-indigo-400 rounded-full"
        style={{
          height: `${Math.max(barHeight, 5)}%`, // min height of 5%
          transition: 'height 0.075s ease-out'
        }}
      />
    );
  });

  return (
    <div className="flex items-end justify-center space-x-2 h-24 w-full mb-4">
      {bars}
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const handleReset = () => {
    setRecordingState('idle');
    setAnalysisResult(null);
    setError(null);
    audioChunksRef.current = [];
  };

  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
        setError("No audio was recorded. Please try again.");
        setRecordingState('error');
        return;
    }
    setRecordingState('processing');
    setError(null);

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
        try {
            const base64Audio = (reader.result as string).split(',')[1];
            const result = await analyzeAudio(base64Audio);
            setAnalysisResult(result);
            setRecordingState('result');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            console.error("Analysis failed:", errorMessage);
            setError(`Failed to analyze audio. ${errorMessage}`);
            setRecordingState('error');
        }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.addEventListener("dataavailable", event => {
            audioChunksRef.current.push(event.data);
        });
        mediaRecorderRef.current.addEventListener("stop", processAudio);
        mediaRecorderRef.current.start();
        setRecordingState('recording');
        setError(null);

        // Setup Visualizer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        analyser.fftSize = 256;
        
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            setAnalyserData(new Uint8Array(dataArray));
            animationFrameIdRef.current = requestAnimationFrame(draw);
        };
        draw();

    } catch (err) {
        console.error("Failed to get microphone access:", err);
        setError("Microphone access was denied. Please allow microphone access in your browser settings to use this app.");
        setRecordingState('error');
    }
  }, [processAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();

        // Clean up visualizer and stream resources immediately for better UX
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        sourceRef.current?.disconnect();
        audioContextRef.current?.close().catch(console.error);

        // Reset refs and state
        animationFrameIdRef.current = null;
        streamRef.current = null;
        sourceRef.current = null;
        audioContextRef.current = null;
        analyserRef.current = null;
        setAnalyserData(null);
    }
  }, []);

  const renderContent = () => {
    switch (recordingState) {
      case 'recording':
        return (
          <div className="text-center flex flex-col items-center">
            <h2 className="text-2xl font-semibold text-white mb-2">Recording...</h2>
            <VoiceVisualizer dataArray={analyserData} />
            <p className="text-gray-400 mb-8">Speak clearly into your microphone.</p>
            <button
              onClick={stopRecording}
              className="w-24 h-24 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg"
              aria-label="Stop recording"
            >
              <StopIcon className="w-10 h-10" />
            </button>
          </div>
        );
      case 'processing':
        return (
          <div className="text-center flex flex-col items-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Analyzing your voice...</h2>
            <p className="text-gray-400 mb-8">This may take a few moments.</p>
            <LoaderIcon className="w-16 h-16 text-indigo-400" />
          </div>
        );
      case 'result':
        return (
            analysisResult && (
                <div className="w-full">
                    <h2 className="text-3xl font-bold text-center text-white mb-6">Analysis Complete</h2>
                    <ResultDisplay result={analysisResult} />
                    <div className="text-center mt-8">
                        <button onClick={handleReset} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center justify-center mx-auto">
                            <RefreshIcon className="w-5 h-5 mr-2"/>
                            Try Again
                        </button>
                    </div>
                </div>
            )
        );
      case 'error':
        return (
            <div className="text-center flex flex-col items-center">
                <h2 className="text-2xl font-semibold text-red-500 mb-4">An Error Occurred</h2>
                <p className="text-gray-300 mb-8 max-w-md">{error}</p>
                <button onClick={handleReset} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center justify-center mx-auto">
                    <RefreshIcon className="w-5 h-5 mr-2"/>
                    Try Again
                </button>
            </div>
        );
      case 'idle':
      default:
        return (
          <div className="text-center flex flex-col items-center">
            <h1 className="text-4xl font-bold text-white mb-2">Accent & Language Detector</h1>
            <p className="text-lg text-gray-400 mb-8">Click the button and speak to analyze your voice.</p>
            <button
              onClick={startRecording}
              className="w-32 h-32 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-2xl transform hover:scale-105"
              aria-label="Start recording"
            >
              <MicrophoneIcon className="w-14 h-14" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-700">
        {renderContent()}
      </main>
      <footer className="text-center text-gray-500 mt-8 text-sm">
        <p>© 2008 - 2025 <a href="//zakirul.com">Md Zakirul Islam. All rights reserved.</a></p>
      </footer>
    </div>
  );
};

export default App;
