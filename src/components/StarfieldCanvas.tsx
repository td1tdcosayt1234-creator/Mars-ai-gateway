import React, { useEffect, useRef } from 'react';

interface StarfieldCanvasProps {
  stormDensity?: number; // 0 to 1
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({ stormDensity = 0.3 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Generate stars
    const starCount = 80;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.65), // mostly in space upper half
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
    }));

    // Generate Mars dust motes
    const dustCount = Math.floor(40 * (1 + stormDensity * 1.5));
    const dustParticles = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() * 1.2 + 0.3) * (0.8 + stormDensity),
      speedY: (Math.random() * 0.4 - 0.2),
      alpha: Math.random() * 0.4 + 0.1,
      hue: Math.random() > 0.4 ? 'rgba(255, 120, 60,' : 'rgba(255, 180, 100,',
    }));

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Render twinkling stars
      stars.forEach((star) => {
        const flicker = Math.sin(tick * star.twinkleSpeed) * 0.3;
        const currentAlpha = Math.max(0.1, Math.min(1, star.alpha + flicker));
        ctx.fillStyle = `rgba(235, 245, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render drifting Martian dust particles
      dustParticles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x > width + 10) particle.x = -10;
        if (particle.y > height + 10) particle.y = -10;
        if (particle.y < -10) particle.y = height + 10;

        ctx.fillStyle = `${particle.hue} ${particle.alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [stormDensity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      style={{ opacity: 0.85 }}
    />
  );
};
