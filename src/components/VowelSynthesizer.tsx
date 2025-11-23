import React, { useState, useEffect, useRef } from 'react';

// Vowel data with formants and positions
const VOWELS = {
  'i': { formants: [270, 2290, 3010], pos: [0.9, 0.9] },   // "beet"
  'I': { formants: [390, 1990, 2550], pos: [0.85, 0.75] },  // "bit"
  'e': { formants: [530, 1840, 2480], pos: [0.8, 0.6] },    // "bait"
  'ɛ': { formants: [660, 1720, 2410], pos: [0.7, 0.4] },    // "bet"
  'æ': { formants: [860, 1550, 2410], pos: [0.7, 0.2] },    // "bat"
  'ə': { formants: [490, 1350, 1690], pos: [0.5, 0.5] },    // "about"
  'ɑ': { formants: [730, 1090, 2440], pos: [0.4, 0.15] },   // "bot"
  'ɔ': { formants: [570, 840, 2410], pos: [0.3, 0.35] },    // "bought"
  'o': { formants: [450, 870, 2410], pos: [0.2, 0.55] },    // "boat"
  'u': { formants: [300, 870, 2240], pos: [0.1, 0.9] },     // "boot"
  'ʊ': { formants: [440, 1020, 2240], pos: [0.15, 0.75] },  // "book"
};

class VowelSynthesizerCore {
  audioContext: AudioContext | null = null;
  oscillator: OscillatorNode | null = null;
  preGain: GainNode | null = null;
  filters: BiquadFilterNode[] = [];
  masterGain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  waveformBuffer: Uint8Array | null = null;
  isRunning = false;

  // Current parameters
  vowelX = 0.5;
  vowelY = 0.5;
  genderFactor = 0.0;
  qualityFactor = 0.0;
  volume = 25; // Match 50% slider default (50/20 = 2.5)

  start() {
    if (this.isRunning) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create oscillator (sawtooth = rich harmonics)
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.value = 120;

      // Create pre-gain to boost signal before filters
      this.preGain = this.audioContext.createGain();
      this.preGain.gain.value = 2.0; // 2x boost before filtering (reduced to prevent saturation)

      // Create 3 bandpass filters (formants F1, F2, F3)
      this.filters = [];
      for (let i = 0; i < 3; i++) {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 5.0; // Wider passband to reduce attenuation
        this.filters.push(filter);
      }

      // Create master gain (volume control)
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;

      // Create analyser for waveform visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Connect: oscillator → preGain → filter1 → filter2 → filter3 → gain → analyser → output
      let node: AudioNode = this.oscillator;
      node.connect(this.preGain);
      node = this.preGain;
      for (const filter of this.filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.oscillator.start();
      this.isRunning = true;

      this.updateVowel();
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

  interpolateFormants(x: number, y: number): number[] {
    const distances = [];

    for (const [name, data] of Object.entries(VOWELS)) {
      const dx = data.pos[0] - x;
      const dy = data.pos[1] - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      distances.push({ name, data, dist });
    }

    distances.sort((a, b) => a.dist - b.dist);
    const nearest = distances.slice(0, 3);

    let totalWeight = 0;
    const weights = nearest.map(v => {
      const w = 1.0 / (v.dist + 0.01);
      totalWeight += w;
      return w;
    });

    const normalizedWeights = weights.map(w => w / totalWeight);

    const formants = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        formants[i] += nearest[j].data.formants[i] * normalizedWeights[j];
      }
    }

    return formants;
  }

  scaleFormantsForGender(formants: number[], genderFactor: number): number[] {
    let scale: number;
    if (genderFactor <= 1.0) {
      scale = 1.0 + 0.18 * genderFactor;
    } else {
      scale = 1.18 + 0.25 * (genderFactor - 1.0);
    }

    return formants.map(f => f * scale);
  }

  calculateBandwidth(formantFreq: number, qualityFactor: number): number {
    const baseBW = formantFreq * 0.08;
    const mult = qualityFactor >= 0
      ? 1.0 + 0.5 * qualityFactor
      : 1.0 + 0.3 * qualityFactor;

    return baseBW * mult;
  }

  updateVowel() {
    if (!this.isRunning || !this.audioContext) return;

    let formants = this.interpolateFormants(this.vowelX, this.vowelY);
    formants = this.scaleFormantsForGender(formants, this.genderFactor);

    const now = this.audioContext.currentTime;

    for (let i = 0; i < 3; i++) {
      const freq = formants[i];
      const bw = this.calculateBandwidth(freq, this.qualityFactor);
      const Q = freq / bw;

      this.filters[i].frequency.setTargetAtTime(freq, now, 0.02);
      this.filters[i].Q.setTargetAtTime(Q, now, 0.02);
    }
  }

  setPitch(f0: number) {
    if (this.isRunning && this.oscillator && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.oscillator.frequency.setTargetAtTime(f0, now, 0.02);
    }
  }

  setVowelPosition(x: number, y: number) {
    this.vowelX = x;
    this.vowelY = y;
    this.updateVowel();
  }

  setGender(factor: number) {
    this.genderFactor = factor;
    this.updateVowel();
  }

  setQuality(factor: number) {
    this.qualityFactor = factor;
    this.updateVowel();
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.isRunning && this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.setValueAtTime(vol, now);
    }
  }
}

export default function VowelSynthesizer() {
  const [isRunning, setIsRunning] = useState(false);
  const [vowelX, setVowelX] = useState(50);
  const [vowelY, setVowelY] = useState(50);
  const [gender, setGender] = useState(0);
  const [quality, setQuality] = useState(50);
  const [pitch, setPitch] = useState(120);
  const [volume, setVolume] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const synthRef = useRef<VowelSynthesizerCore>(new VowelSynthesizerCore());

  useEffect(() => {
    const synth = synthRef.current;

    return () => {
      if (synth.isRunning) {
        synth.stop();
      }
      stopWaveformAnimation();
    };
  }, []);

  useEffect(() => {
    drawVowelChart();
  }, [vowelX, vowelY]);

  // Initialize waveform canvas with instruction text on mount
  useEffect(() => {
    stopWaveformAnimation();
  }, []);

  const toggleAudio = () => {
    const synth = synthRef.current;

    if (!synth.isRunning) {
      try {
        synth.start();
        // Set volume to match slider position
        synth.setVolume(volume / 2);
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

  const drawVowelChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw vowel positions
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';

    for (const [name, data] of Object.entries(VOWELS)) {
      const x = data.pos[0] * canvas.width;
      const y = (1 - data.pos[1]) * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.fillText(name, x + 10, y + 5);
      ctx.fillStyle = '#6b7280';
    }

    // Draw current position
    const currentX = (vowelX / 100) * canvas.width;
    const currentY = (1 - vowelY / 100) * canvas.height;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const updateVowelPosition = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = ((clientX - rect.left) * scaleX / canvas.width) * 100;
    const y = ((1 - (clientY - rect.top) * scaleY / canvas.height)) * 100;

    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setVowelX(Math.round(clampedX));
    setVowelY(Math.round(clampedY));

    synthRef.current.setVowelPosition(clampedX / 100, clampedY / 100);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updateVowelPosition(e.clientX, e.clientY);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateVowelPosition(e.clientX, e.clientY);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      updateVowelPosition(e.clientX, e.clientY);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
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
        ctx.fillText('Start audio to see waveform', canvas.width / 2, canvas.height / 2);
      }
    }
  };

  const handleVowelXChange = (value: number) => {
    setVowelX(value);
    synthRef.current.setVowelPosition(value / 100, vowelY / 100);
  };

  const handleVowelYChange = (value: number) => {
    setVowelY(value);
    synthRef.current.setVowelPosition(vowelX / 100, value / 100);
  };

  const handleGenderChange = (value: number) => {
    setGender(value);
    synthRef.current.setGender(value / 100);
  };

  const handleQualityChange = (value: number) => {
    setQuality(value);
    const qualityFactor = (value - 50) / 50;
    synthRef.current.setQuality(qualityFactor);
  };

  const handlePitchChange = (value: number) => {
    setPitch(value);
    synthRef.current.setPitch(value);
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    synthRef.current.setVolume(value / 2); // Scale 0-100 to 0-25 for much louder range
  };

  const getGenderLabel = (value: number) => {
    if (value < 50) return 'Male';
    if (value < 150) return 'Female';
    return 'Child';
  };

  const getQualityLabel = (value: number) => {
    const qualityFactor = (value - 50) / 50;
    if (qualityFactor < -0.3) return 'Tense';
    if (qualityFactor > 0.3) return 'Breathy';
    return 'Normal';
  };

  return (
    <div className="w-full max-w-full mx-auto p-6 bg-white rounded-none border border-gray-200">
      <h2 className="text-2xl font-bold text-black mb-6">Interactive Vowel Synthesizer</h2>

      {/* Waveform visualization */}
      <canvas
        ref={waveformCanvasRef}
        width={600}
        height={120}
        className="border border-gray-300 rounded-lg bg-gray-50 mb-6"
      />

      {/* Vowel chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Vowel Chart</h3>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          className="border border-gray-300 rounded-lg cursor-crosshair bg-gray-50"
        />
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="range"
            min="0"
            max="200"
            value={gender}
            onChange={(e) => handleGenderChange(Number(e.target.value))}
            className="vowel-slider flex-1 h-2 bg-gray-200 rounded-none appearance-none cursor-pointer mr-6"
          />
          <span className="text-sm font-medium text-gray-900 mr-16"> Vocal Tract Length: </span>
          <span className="text-xs text-gray-600">
            {getGenderLabel(gender)}
          </span>
        </div>

        <div className="flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={quality}
            onChange={(e) => handleQualityChange(Number(e.target.value))}
            className="vowel-slider flex-1 h-2 bg-gray-200 rounded-none appearance-none cursor-pointer mr-6"
          />
          <span className="text-sm font-medium text-gray-900 mr-16"> Voice Quality: </span>
          <span className="text-xs text-gray-600">
            {getQualityLabel(quality)}
          </span>
        </div>

        <div className="flex items-center">
          <input
            type="range"
            min="50"
            max="300"
            value={pitch}
            onChange={(e) => handlePitchChange(Number(e.target.value))}
            className="vowel-slider flex-1 h-2 bg-gray-200 rounded-none appearance-none cursor-pointer mr-6"
          />
          <span className="text-sm font-medium text-gray-900 mr-16"> Pitch: </span>
          <span className="text-xs text-gray-600">
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
          <span className="text-sm font-medium text-gray-900 mr-16"> Volume: </span>
          <span className="text-xs text-gray-600">
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
        {isRunning ? 'Stop Audio' : 'Start Audio'}
      </button>

    </div>
  );
}
