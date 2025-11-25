import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  showText?: boolean;
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({ 
  value, 
  width = 1.5, 
  height = 40, 
  fontSize = 14,
  showText = true 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: "CODE128",
          width: width,
          height: height,
          displayValue: showText,
          fontSize: fontSize,
          margin: 0,
          textMargin: 2,
          fontOptions: "bold"
        });
      } catch (e) {
        console.error("Barcode generation failed", e);
      }
    }
  }, [value, width, height, fontSize, showText]);

  return <canvas ref={canvasRef} className="max-w-full" />;
};


