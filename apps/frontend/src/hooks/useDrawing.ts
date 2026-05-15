import { useState, useCallback } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface UseDrawingOptions {
  zoom: number;
  onPointsChange?: (points: Point[]) => void;
}

export interface UseDrawingReturn {
  points: Point[];
  addPoint: (viewportPoint: Point) => void;
  clearPoints: () => void;
  setPoints: (points: Point[]) => void;
  viewportToPdf: (point: Point) => Point;
}

export const useDrawing = ({ zoom, onPointsChange }: UseDrawingOptions): UseDrawingReturn => {
  const [points, setPointsState] = useState<Point[]>([]);

  const viewportToPdf = useCallback(
    (point: Point): Point => ({
      x: point.x / zoom,
      y: point.y / zoom,
    }),
    [zoom]
  );

  const addPoint = useCallback(
    (viewportPoint: Point) => {
      const pdfPoint = viewportToPdf(viewportPoint);
      const newPoints = [...points, pdfPoint];
      setPointsState(newPoints);
      onPointsChange?.(newPoints);
    },
    [points, viewportToPdf, onPointsChange]
  );

  const clearPoints = useCallback(() => {
    setPointsState([]);
    onPointsChange?.([]);
  }, [onPointsChange]);

  const setPoints = useCallback(
    (newPoints: Point[]) => {
      setPointsState(newPoints);
      onPointsChange?.(newPoints);
    },
    [onPointsChange]
  );

  return {
    points,
    addPoint,
    clearPoints,
    setPoints,
    viewportToPdf,
  };
};

export default useDrawing;