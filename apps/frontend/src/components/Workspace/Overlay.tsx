import type React from 'react';

export interface OverlayProps {
  width: number;
  height: number;
  zoom: number;
  offsetX?: number;
  offsetY?: number;
  className?: string;
  children?: React.ReactNode;
}

export const Overlay: React.FC<OverlayProps> = ({
  width,
  height,
  zoom,
  offsetX = 0,
  offsetY = 0,
  className,
  children,
}) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      <title>Drawing overlay</title>
      <g transform={`translate(${offsetX}, ${offsetY}) scale(${zoom})`}>
        {children}
      </g>
    </svg>
  );
};

export default Overlay;