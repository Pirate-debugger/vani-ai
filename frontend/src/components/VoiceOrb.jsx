import React, { useEffect, useRef } from 'react';

const SINE_TABLE = Array.from({ length: 1000 }, (_, i) => Math.sin((i / 1000) * Math.PI * 2));
const fastSin = (angle) => SINE_TABLE[Math.floor(((angle % (Math.PI * 2)) / (Math.PI * 2)) * 1000 + 1000) % 1000];

const TARGET_FPS = { idle: 10, thinking: 20, listening: 60, speaking: 30 };

const VoiceOrb = ({ 
  state, 
  voiceState, 
  isListening, 
  isRecording, 
  audioAnalyser, 
  analyserNode,
  size
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameTime = useRef(0);

  const activeState = (voiceState || state || 'idle').toLowerCase();
  const listeningActive = isListening ?? isRecording ?? (activeState === 'listening');
  const activeAnalyser = audioAnalyser || analyserNode;

  // Colors based on state
  const colors = {
    idle: {
      primary: 'rgba(99, 102, 241, 0.45)', // Indigo
      secondary: 'rgba(6, 182, 212, 0.35)', // Cyan
      glow: 'rgba(139, 92, 246, 0.2)'
    },
    listening: {
      primary: 'rgba(16, 185, 129, 0.6)', // Bright Emerald
      secondary: 'rgba(5, 150, 105, 0.45)', // Darker Emerald
      glow: 'rgba(16, 185, 129, 0.35)'
    },
    processing: {
      primary: 'rgba(245, 158, 11, 0.55)', // Amber
      secondary: 'rgba(217, 119, 6, 0.4)',
      glow: 'rgba(245, 158, 11, 0.3)'
    },
    thinking: {
      primary: 'rgba(59, 130, 246, 0.5)', // Blue
      secondary: 'rgba(6, 182, 212, 0.4)', // Cyan
      glow: 'rgba(59, 130, 246, 0.3)'
    },
    researching: {
      primary: 'rgba(139, 92, 246, 0.55)', // Purple
      secondary: 'rgba(6, 182, 212, 0.45)', // Cyan
      glow: 'rgba(139, 92, 246, 0.35)'
    },
    speaking: {
      primary: 'rgba(99, 102, 241, 0.6)', // Indigo
      secondary: 'rgba(168, 85, 247, 0.5)', // Purple
      glow: 'rgba(99, 102, 241, 0.4)'
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let phase = 0;
    
    // Make sure we have proper pixel ratio for high DPI displays
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    // Audio Analysis buffer
    const dataArray = activeAnalyser ? new Uint8Array(activeAnalyser.frequencyBinCount) : null;
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      const fpsInterval = 1000 / (TARGET_FPS[activeState] || 30);
      const now = performance.now();
      if (now - lastFrameTime.current < fpsInterval) {
        animationRef.current = requestAnimationFrame(render);
        return; // skip this frame
      }
      lastFrameTime.current = now;

      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const xc = w / 2;
      const yc = h / 2;
      
      // Clear with radial overlay for glowing shadows
      ctx.clearRect(0, 0, w, h);
      
      // Calculate dynamic radius based on state and microphone amplitude
      let amplitude = 0;
      if (listeningActive && activeAnalyser) {
        activeAnalyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        amplitude = sum / dataArray.length; // Normalized average amplitude
      }

      // Base radius calculation
      let baseRadius = Math.min(w, h) * 0.28;
      
      if (activeState === 'listening') {
        baseRadius += amplitude * 0.6; // React to real voice volume
      } else if (activeState === 'speaking') {
        baseRadius += fastSin(phase * 4) * 8 + 4; // Simulated speech pulse
      } else if (activeState === 'thinking' || activeState === 'researching') {
        baseRadius += fastSin(phase * 1.5) * 3;
      } else {
        baseRadius += fastSin(phase * 0.5) * 5; // Gentle breath in idle
      }

      // Draw Orb Gloom Shadows
      const activeColors = colors[activeState] || colors.idle;
      const glowGrad = ctx.createRadialGradient(xc, yc, baseRadius * 0.2, xc, yc, baseRadius * 2);
      glowGrad.addColorStop(0, activeColors.primary);
      glowGrad.addColorStop(0.3, activeColors.secondary);
      glowGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(xc, yc, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Render morphing organic layers (skip distortion if reduced motion is requested)
      const layersCount = prefersReducedMotion ? 1 : 3;
      for (let layer = 0; layer < layersCount; layer++) {
        ctx.beginPath();
        const points = (activeState === 'listening') ? 80 : 40;
        
        // Vary rotation phase per layer
        const angleOffset = (layer * Math.PI * 2) / layersCount + (prefersReducedMotion ? 0 : phase * (activeState === 'thinking' ? 1.5 : 0.4));
        
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2 + angleOffset;
          
          let offset = 0;
          if (!prefersReducedMotion) {
            if (activeState === 'listening') {
              const freq = 3 + layer * 2;
              offset = fastSin(angle * freq + phase * 6) * (15 + amplitude * 0.4);
            } else if (activeState === 'thinking' || activeState === 'researching') {
              offset = fastSin(angle * 6 + phase * 10) * 12;
            } else if (activeState === 'speaking') {
              offset = fastSin(angle * 4 + phase * 8) * (18 + Math.cos(phase) * 6);
            } else {
              offset = fastSin(angle * (2 + layer) + phase * 1.8) * 8;
            }
          }

          const r = baseRadius + offset;
          const x = xc + Math.cos(angle) * r;
          const y = yc + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        ctx.closePath();

        // High premium gradient styles
        const layerGrad = ctx.createLinearGradient(0, yc - baseRadius, w, yc + baseRadius);
        if (layer === 0) {
          layerGrad.addColorStop(0, activeColors.primary);
          layerGrad.addColorStop(1, activeColors.secondary);
          ctx.fillStyle = layerGrad;
        } else if (layer === 1) {
          layerGrad.addColorStop(0, activeColors.secondary);
          layerGrad.addColorStop(1, activeColors.glow);
          ctx.fillStyle = layerGrad;
        } else {
          layerGrad.addColorStop(0, activeColors.glow);
          layerGrad.addColorStop(1, activeColors.primary);
          ctx.fillStyle = layerGrad;
        }
        
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.55 - (layer * 0.12);
        ctx.fill();
      }

      // Draw standard inner glassy core
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(xc - baseRadius * 0.25, yc - baseRadius * 0.25, baseRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      // Update Phase
      phase += 0.05;
      
      // Request next frame
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(animationRef.current);
      else render(); // restart
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [activeState, listeningActive, activeAnalyser]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Decorative Outer Rings */}
      <div className={`
        absolute inset-0 rounded-full border border-white/5 pointer-events-none transition-all duration-1000
        ${activeState === 'listening' ? 'scale-110 opacity-40 border-emerald-400/30' : 'scale-100 opacity-20'}
      `} />
      <div className={`
        absolute inset-8 rounded-full border border-white/10 pointer-events-none transition-all duration-700
        ${activeState === 'thinking' || activeState === 'researching' ? 'animate-spin border-cyan-400/30' : 'opacity-10'}
      `} />

      <canvas 
        ref={canvasRef} 
        style={{ width: size ? `${size}px` : '100%', height: size ? `${size}px` : '100%' }}
        className="max-w-[420px] max-[400px]:max-h-48 max-h-[420px] filter drop-shadow-[0_0_50px_rgba(99,102,241,0.15)]"
      />
    </div>
  );
};

export default VoiceOrb;
