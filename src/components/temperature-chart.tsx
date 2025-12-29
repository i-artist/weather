import React, { useEffect, useRef, useState } from 'react';

interface Props {
  data: number[];
}

const GRADIENT_COLORS = {
  low: 'rgba(255, 255, 255, 0)', // 透明白
  mid: 'rgba(0, 136, 255, 0.35)', // 蓝色
  high: 'rgba(94, 239, 10, 0.45)', // 绿色
};

const TemperatureChart: React.FC<Props> = ({ data }) => {
  console.log(data);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!size.width || !size.height || data.length < 2) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }

  const padding = 20;
  const { width, height } = size;

  const max = Math.max(...data);
  const min = Math.min(...data) - 8;

  const midValue = (min + max) / 2;

  const getOffset = (value: number) => ((value - min) / (max - min)) * 100;

  /** 温度 → 坐标 */
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);

    const y =
      padding + ((max - value) / (max - min || 1)) * (height - padding * 2);

    return { x, y, value };
  });

  /** 温度 → 颜色 */
  const getTempColor = (value: number) => {
    const ratio = (value - min) / (max - min || 1);
    const r = Math.round(ratio * 255);
    const g = Math.round(30 - ratio * 80);
    const b = Math.round(255 - ratio * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  /** 平滑曲线路径 */
  const createLinePath = () => {
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return d;
  };

  /** 填充区域 */
  const createAreaPath = () => {
    const first = points[0];
    const last = points[points.length - 1];

    return `
      ${createLinePath()}
      L ${last.x} ${height - padding}
      L ${first.x} ${height - padding}
      Z
    `;
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg width={width} height={height}>
        <defs>
          {/* 👇 温度驱动的垂直渐变 */}
          <linearGradient id="tempGradient" x1="0" y1="1" x2="0" y2="0">
            {/* 低温：透明白 */}
            <stop
              offset={`${getOffset(min)}%`}
              stopColor={GRADIENT_COLORS.low}
            />

            {/* 中温：蓝色 */}
            <stop
              offset={`${getOffset(midValue)}%`}
              stopColor={GRADIENT_COLORS.mid}
            />

            {/* 高温：绿色 */}
            <stop
              offset={`${getOffset(max)}%`}
              stopColor={GRADIENT_COLORS.high}
            />
          </linearGradient>
        </defs>

        {/* 渐变填充 */}
        <path d={createAreaPath()} fill="url(#tempGradient)" />

        {/* 温度曲线（同样可用渐变） */}
        <path
          d={createLinePath()}
          fill="none"
          stroke="url(#tempGradient)"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
};

export default TemperatureChart;
