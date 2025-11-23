import React, { useState, useEffect, useRef } from 'react';

class SawtoothGeneratorCore {
    audioContext: AudioContext | null = null;
    oscillator: OscillatorNode | null = null;
    masterGain: GainNode | null = null;
    analyser: AnalyserNode | null = null;
    waveformBuffer: Uint8Array | null = null;
    isRunning = false;

    // Current parameters
    pitch = 120;
    volume = 0.5;

    start() {
        if (this.isRunning) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Create oscillator (sawtooth)
            this.oscillator = this.audioContext.createOscillator();
            this.oscillator.type = 'sawtooth';
            this.oscillator.frequency.value = this.pitch;

            // Create master gain (volume control)
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volume;

            // Create analyser for waveform visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;

            // Connect: oscillator → gain → analyser → output
            this.oscillator.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            this.oscillator.start();
            this.isRunning = true;
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            this.isRunning = false;
            throw error;
        }
    }

    stop() {
        if (!this.isRunning) return;

        this.oscillator?.stop();
        this.audioContext?.close();
        this.isRunning = false;
    }

    setPitch(f0: number) {
        this.pitch = f0;
        if (this.isRunning && this.oscillator && this.audioContext) {
            const now = this.audioContext.currentTime;
            this.oscillator.frequency.setTargetAtTime(f0, now, 0.02);
        }
    }

    setVolume(vol: number) {
        this.volume = vol;
        if (this.isRunning && this.masterGain && this.audioContext) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.setValueAtTime(vol, now);
        }
    }
}

export default function SawtoothGenerator() {
    const [isRunning, setIsRunning] = useState(false);
    const [pitch, setPitch] = useState(120);
    const [volume, setVolume] = useState(50);

    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const synthRef = useRef<SawtoothGeneratorCore>(new SawtoothGeneratorCore());

    useEffect(() => {
        const synth = synthRef.current;

        return () => {
            if (synth.isRunning) {
                synth.stop();
            }
            stopWaveformAnimation();
        };
    }, []);

    // Initialize waveform canvas with instruction text on mount
    useEffect(() => {
        stopWaveformAnimation();
    }, []);

    const toggleAudio = () => {
        const synth = synthRef.current;

        if (!synth.isRunning) {
            try {
                synth.start();
                // Ensure parameters are synced
                synth.setPitch(pitch);
                synth.setVolume(volume / 100);

                setIsRunning(true);
                startWaveformAnimation();
            } catch (error) {
                console.error('Failed to start audio:', error);
                alert('Could not start audio. Please check your browser settings and try again.');
            }
        } else {
            synth.stop();
            setIsRunning(false);
            stopWaveformAnimation();
        }
    };

    const drawWaveform = () => {
        const canvas = waveformCanvasRef.current;
        const synth = synthRef.current;

        if (!canvas || !synth.analyser || !synth.isRunning) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reuse the same buffer to avoid garbage collection
        if (!synth.waveformBuffer) {
            synth.waveformBuffer = new Uint8Array(synth.analyser.frequencyBinCount);
        }

        synth.analyser.getByteTimeDomainData(synth.waveformBuffer as any);

        // Clear canvas
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath();

        const sliceWidth = canvas.width / synth.waveformBuffer.length;
        let x = 0;

        for (let i = 0; i < synth.waveformBuffer.length; i++) {
            // Proper centering: map 0-255 to -1 to 1, then to canvas height
            const v = (synth.waveformBuffer[i] - 128) / 128.0;
            // Apply 2x zoom around center point for better visibility
            const y = canvas.height / 2 + (v * canvas.height / 2 * 2.0);

            // Clamp to canvas bounds to prevent drawing outside
            const clampedY = Math.max(0, Math.min(canvas.height, y));

            if (i === 0) {
                ctx.moveTo(x, clampedY);
            } else {
                ctx.lineTo(x, clampedY);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    const startWaveformAnimation = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        drawWaveform();
    };

    const stopWaveformAnimation = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Clear waveform canvas and show instruction
        const canvas = waveformCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#f9fafb';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Show instruction text when stopped
                ctx.fillStyle = '#9ca3af';
                ctx.font = '14px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Start audio to see sawtooth wave', canvas.width / 2, canvas.height / 2);
            }
        }
    };

    const handlePitchChange = (value: number) => {
        setPitch(value);
        synthRef.current.setPitch(value);
    };

    const handleVolumeChange = (value: number) => {
        setVolume(value);
        synthRef.current.setVolume(value / 100);
    };

    return (
        <div className="w-full max-w-full mx-auto p-6 bg-white rounded-none border border-gray-200 my-8">
            <h3 className="text-xl font-bold text-black mb-4">Sawtooth Wave Generator</h3>
            <p className="text-gray-600 mb-4">
                This tool generates a raw sawtooth wave. Notice how it sounds "buzzy" and rich compared to a pure sine wave.
                This rich harmonic content is what allows us to sculpt vowels using filters later.
            </p>

            {/* Waveform visualization */}
            <canvas
                ref={waveformCanvasRef}
                width={600}
                height={120}
                className="border border-gray-300 rounded-lg bg-gray-50 mb-6 w-full"
            />

            {/* Sliders */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center">
                    <input
                        type="range"
                        min="50"
                        max="300"
                        value={pitch}
                        onChange={(e) => handlePitchChange(Number(e.target.value))}
                        className="vowel-slider flex-1 h-2 bg-gray-200 rounded-none appearance-none cursor-pointer mr-6"
                    />
                    <span className="text-sm font-medium text-gray-900 mr-4 w-16"> Pitch </span>
                    <span className="text-xs text-gray-600 w-12">
                        {pitch} Hz
                    </span>
                </div>

                <div className="flex items-center">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="vowel-slider flex-1 h-2 bg-gray-200 rounded-none appearance-none cursor-pointer mr-6"
                    />
                    <span className="text-sm font-medium text-gray-900 mr-4 w-16"> Volume </span>
                    <span className="text-xs text-gray-600 w-12">
                        {volume}%
                    </span>
                </div>
            </div>

            {/* Start/Stop button */}
            <button
                onClick={toggleAudio}
                className="w-full font-medium hover:underline transition-colors"
                style={{
                    color: isRunning ? '#ef4444' : '#1a1a1a',
                    borderRadius: '0',
                    padding: '16px 32px',
                    fontSize: '18px',
                    border: '0.5px solid #1a1a1a',
                    backgroundColor: isRunning ? '#fef2f2' : 'transparent'
                }}
            >
                {isRunning ? 'Stop Sawtooth Wave' : 'Start Sawtooth Wave'}
            </button>

        </div>
    );
}
