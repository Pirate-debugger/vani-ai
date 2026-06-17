import React, { useEffect, useRef } from 'react';

const SINE_TABLE = Array.from({ length: 1000 }, (_, i) => Math.sin((i / 1000) * Math.PI * 2));
const fastSin = (angle) => SINE_TABLE[Math.floor(((angle % (Math.PI * 2)) / (Math.PI * 2)) * 1000 + 1000) % 1000];

const TARGET_FPS = { idle: 10, thinking: 20, listening: 60, speaking: 30 };

const VoiceOrb = ({ state, isListening, audioAnalyser }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameTime = useRef(0);

  // Colors based on state
  const colors = {
    idle: {
      primary: 'rgba(138, 43, 226, 0.45)', // Purple
      secondary: 'rgba(0, 240, 255, 0.35)', // Cyan
      glow: 'rgba(189, 0, 255, 0.2)'
    },
    listening: {
      primary: 'rgba(0, 255, 128, 0.6)', // Bright Green
      secondary: 'rgba(0, 200, 100, 0.45)', // Darker Green
      glow: 'rgba(0, 255, 128, 0.35)'
    },
    thinking: {
      primary: 'rgba(0, 100, 255, 0.5)', // Deep Blue
      secondary: 'rgba(0, 200, 255, 0.4)', // Light Blue/Cyan
      glow: 'rgba(0, 100, 255, 0.3)'
    },
    speaking: {
      primary: 'rgba(138, 43, 226, 0.6)', // Deep Purple
      secondary: 'rgba(189, 0, 255, 0.5)', // Neon Purple
      glow: 'rgba(138, 43, 226, 0.4)'
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
    const dataArray = audioAnalyser ? new Uint8Array(audioAnalyser.frequencyBinCount) : null;

    const render = () => {
      const fpsInterval = 1000 / (TARGET_FPS[state] || 30);
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
      if (isListening && audioAnalyser) {
        audioAnalyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        amplitude = sum / dataArray.length; // Normalized average amplitude
      }

      // Base radius calculation
      let baseRadius = Math.min(w, h) * 0.28;
      
      if (state === 'listening') {
        baseRadius += amplitude * 0.6; // React to real voice volume
      } else if (state === 'speaking') {
        baseRadius += fastSin(phase * 4) * 8 + 4; // Simulated speech pulse
      } else if (state === 'thinking') {
        baseRadius += fastSin(phase * 1.5) * 3;
      } else {
        baseRadius += fastSin(phase * 0.5) * 5; // Gentle breath in idle
      }

      // Draw Orb Gloom Shadows
      const activeColors = colors[state] || colors.idle;
      const glowGrad = ctx.createRadialGradient(xc, yc, baseRadius * 0.2, xc, yc, baseRadius * 2);
      glowGrad.addColorStop(0, activeColors.primary);
      glowGrad.addColorStop(0.3, activeColors.secondary);
      glowGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(xc, yc, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Render 3 overlapping morphing organic layers
      const layersCount = 3;
      for (let layer = 0; layer < layersCount; layer++) {
        ctx.beginPath();
        const points = (state === 'listening') ? 80 : 40;
        
        // Vary rotation phase per layer
        const angleOffset = (layer * Math.PI * 2) / layersCount + phase * (state === 'thinking' ? 1.5 : 0.4);
        
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2 + angleOffset;
          
          // Organic shape distortion factor using layered sines
          let offset = 0;
          if (state === 'listening') {
            const freq = 3 + layer * 2;
            offset = fastSin(angle * freq + phase * 6) * (15 + amplitude * 0.4);
          } else if (state === 'thinking') {
            offset = fastSin(angle * 6 + phase * 10) * 12;
          } else if (state === 'speaking') {
            offset = fastSin(angle * 4 + phase * 8) * (18 + Math.cos(phase) * 6);
          } else {
            // Idle gentle waves
            offset = fastSin(angle * (2 + layer) + phase * 1.8) * 8;
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
  }, [state, isListening, audioAnalyser]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Decorative Outer Rings */}
      <div className={`
        absolute inset-0 rounded-full border border-white/5 pointer-events-none transition-all duration-1000
        ${state === 'listening' ? 'scale-110 opacity-40 border-green-400/30' : 'scale-100 opacity-20'}
      `} />
      <div className={`
        absolute inset-8 rounded-full border border-white/10 pointer-events-none transition-all duration-700
        ${state === 'thinking' ? 'animate-spin border-blue-400/30' : 'opacity-10'}
      `} />

      <canvas 
        ref={canvasRef} 
        className="w-full h-full max-w-[420px] max-[400px]:max-h-48 max-h-[420px] filter drop-shadow-[0_0_50px_rgba(138,43,226,0.15)]"
      />
    </div>
  );
};

export default VoiceOrb;
