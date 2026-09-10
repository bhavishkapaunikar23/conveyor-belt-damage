import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
  durationMs?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 1,
  className = '',
  durationMs = 400,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();

    const updateVal = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateVal);
      } else {
        setDisplayValue(endVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateVal);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, durationMs]);

  return (
    <span className={`font-mono transition-colors duration-300 ${className}`}>
      {displayValue.toFixed(decimals)}
    </span>
  );
};
