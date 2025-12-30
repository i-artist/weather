/* eslint-disable no-constant-binary-expression */

import { useRequest } from 'ahooks';
import type { EChartsOption, SeriesOption } from 'echarts';
import * as echarts from 'echarts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import centerBg from './assets/center.svg';
import WeatherMap from './components/map';
import { Windy } from './components/windy';

const THEMES = {
  mid: {
    pageBg:
      'radial-gradient(120% 120% at 20% 18%, rgba(99, 167, 229, 0.28) 0%, rgba(220, 238, 250, 0.96) 46%, rgba(236, 245, 251, 0.98) 100%)',
    cardBg: 'rgba(248, 252, 255, 0.9)',
    panelBg: 'rgba(243, 249, 255, 0.94)',
    cardHeaderBg: 'rgba(224, 238, 250, 0.92)',
    cardBorder: '1px solid rgba(61, 139, 253, 0.2)',
    accent: '#2e8df4',
    accentAlt: '#3ac1aa',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    muted: '#7c8fa6',
    radius: 16,
    shadow: '0 18px 42px rgba(15, 23, 42, 0.1)',
  },
  light: {
    pageBg:
      'radial-gradient(120% 120% at 15% 20%, rgba(255, 193, 149, 0.18) 0%, rgba(236, 245, 255, 0.96) 45%, rgba(247, 250, 255, 0.98) 100%)',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    panelBg: 'rgba(255, 255, 255, 0.95)',
    cardHeaderBg: 'rgba(232, 240, 255, 0.9)',
    cardBorder: '1px solid rgba(59, 130, 246, 0.18)',
    accent: '#2d7cf8',
    accentAlt: '#38c4a3',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    muted: '#94a3b8',
    radius: 16,
    shadow: '0 18px 42px rgba(15, 23, 42, 0.1)',
  },
  sky: {
    pageBg:
      'radial-gradient(120% 120% at 18% 16%, rgba(122, 187, 255, 0.34) 0%, rgba(225, 242, 255, 0.96) 48%, rgba(240, 247, 255, 0.99) 100%)',
    cardBg: 'rgba(255, 255, 255, 0.88)',
    panelBg: 'rgba(245, 249, 255, 0.92)',
    cardHeaderBg: 'rgba(220, 234, 255, 0.9)',
    cardBorder: '1px solid rgba(74, 144, 226, 0.22)',
    accent: '#3d8bfd',
    accentAlt: '#4ad2c5',
    textPrimary: '#0f172a',
    textSecondary: '#3c4f63',
    muted: '#7f8ea6',
    radius: 18,
    shadow: '0 20px 46px rgba(15, 23, 42, 0.12)',
  },
  dark: {
    pageBg:
      'radial-gradient(120% 120% at 20% 20%, rgba(38, 63, 108, 0.7) 0%, rgba(14, 23, 38, 0.95) 55%, rgba(7, 12, 20, 0.98) 100%)',
    cardBg: 'rgba(74, 148, 214, 0.16)',
    panelBg: 'rgba(58, 121, 186, 0.14)',
    cardHeaderBg: 'rgba(104, 168, 238, 0.2)',
    cardBorder: '1px solid rgba(108, 184, 255, 0.48)',
    accent: '#4ec8ff',
    accentAlt: '#3bd4b8',
    textPrimary: '#f0f6ff',
    textSecondary: '#c8d7ed',
    muted: '#7f92b1',
    radius: 16,
    shadow: '0 18px 46px rgba(0, 0, 0, 0.45)',
  },
};

function formatNumber(num: string | number, maximumFractionDigits = 2) {
  const number = Number(num);

  // 检查是否为有效数字
  if (isNaN(number)) {
    return num.toString();
  }

  return number.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maximumFractionDigits,
  });
}
function genLeftItems(arr: number[] | string[]) {
  const LEFT_ITEMS = [
    {
      title: '累计发电量',
      unit: '万kWh',
      value: formatNumber(arr[0]),
    },
    {
      title: '日发电量',
      unit: '万kWh',
      value: formatNumber(arr[1]),
    },
    {
      title: '月发电量',
      unit: '万kWh',
      value: formatNumber(arr[2]),
    },
    {
      title: '年发电量',
      unit: '万kWh',
      value: formatNumber(arr[3]),
    },
    {
      title: '年上网电量',
      unit: '万kWh',
      value: formatNumber(arr[4]),
    },
  ];

  return LEFT_ITEMS;
}

function genRightItems(arr: number[] | string[]) {
  const RIGHT_ITEMS = [
    {
      title: '总有功',
      unit: 'MW',
      value: formatNumber(arr[0]),
    },
    {
      title: '等效利用小时',
      unit: 'h',
      value: formatNumber(arr[1]),
    },
    {
      title: '总装机容量',
      unit: 'MW',
      value: formatNumber(arr[2]),
    },
    {
      title: '场站',
      unit: '个',
      value: formatNumber(arr[3]),
    },
    {
      title: '设备',
      unit: '个',
      value: formatNumber(arr[4]),
    },
  ];

  return RIGHT_ITEMS;
}

const createLineOption = (
  theme: (typeof THEMES)[keyof typeof THEMES],
  prev?: EChartsOption,
) => {
  const option = {
    title: {
      text: '经营指标（全口径）',
      left: 'left',
      textStyle: {
        color: theme.accent,
      },
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      textStyle: {
        color: theme.textPrimary,
      },
      data: ['利润', '收入'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLabel: {
        color: theme.textSecondary,
      },
      data: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'],
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.textSecondary,
      },
    },
    series: [
      {
        name: '利润',
        type: 'line',
        stack: 'Total',
        data: [0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: '收入',
        type: 'line',
        stack: 'Total',
        data: [0, 0, 0, 0, 0, 0, 0],
      },
    ],
  } as EChartsOption;

  if (prev) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xAxis = option.xAxis as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevXAxis = prev.xAxis as any;
    if (prevXAxis?.data) xAxis.data = prevXAxis.data;
    const series = option.series as SeriesOption[];
    const prevSeries = prev.series as SeriesOption[];
    if (prevSeries?.[0]?.data) series[0].data = prevSeries[0].data;
    if (prevSeries?.[1]?.data) series[1].data = prevSeries[1].data;
  }

  return option;
};

export default function Dashboard() {
  const [themeKey, setThemeKey] = useState<'mid' | 'light' | 'sky' | 'dark'>(
    'sky',
  );
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [clock, setClock] = useState({ time: '', date: '' });

  // const logoSrc = themeKey === 'dark' ? '/logo.png' : logoLight;
  const THEME = THEMES[themeKey];
  const [isWindy] = useState(true);
  const [leftItems, setLeftItems] = useState<
    {
      title: string;
      unit: string;
      value: string;
    }[]
  >(genLeftItems([0, 0, 0, 0, 0]));

  const [rightItems, setRightItems] = useState<
    {
      title: string;
      unit: string;
      value: string;
    }[]
  >(genRightItems([0, 0, 0, 0, 0]));

  const [pieOption, setPieOption] = useState(() => createPieOption(THEME));
  const [lineOption, setLineOption] = useState(() => createLineOption(THEME));
  const [barOption, setBarOption] = useState(() => createBarOption(THEME));

  const [info, setInfo] = useState({ saveCoal: '0', co2: '0' });

  const handleThemeChange = (key: 'mid' | 'light' | 'sky' | 'dark') => {
    const nextTheme = THEMES[key];
    setThemeKey(key);
    setPieOption((op) => createPieOption(nextTheme, op));
    setLineOption((op) => createLineOption(nextTheme, op));
    setBarOption((op) => createBarOption(nextTheme, op));
  };


  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const date = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
      });
      setClock({ time, date });
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setInterval(() => {
      window.location.reload();
    }, 1000 * 60 * 120)
  }, []);

  useRequest(
    async () => {
      const res = await fetch('https://demo.theonly.vip:16666/api/baseinfo');
      const json = await res.json();
      // const json = await res.json();
      const data = json?.data?.cli?.dps?.ModelData?.['00'];
      // 年上网电量 sn_top_YearPwr   总有功 sn_top_CurrentPower
      const deviceNum = data.sn_top_DeviceNum; // 设备数量
      const fieldNum = data?.sn_top_FieldNum; // 场站数量
      const saveCoal = data.sn_top_SaveCoal; // 节约煤量
      const co2 = data.sn_top_CO2 / 1000; // 减少co2
      const yearPwrRate = data.sn_top_YearPwrRate; // 年发电率
      const capacity = data.sn_top_Capacity / 1000; // 装机容量
      const equUtilHours = data.sn_top_EquUtilHours; // 等效利用小时
      const totalPower = data.sn_top_TotalPower / 10000; // 等效发电量
      // const annualPower = data.sn_top_AnnualPower; // 年度发电量
      const yearPwr = data.sn_top_AnnualPower / 10000; // 年发电量
      const monthPwr = data.sn_top_MonthPower / 10000; // 月发电量
      const dayPwr = data.sn_top_DayPower / 10000; // 日发电量
      const sn_top_YearPwr = data.sn_top_YearPwr / 10000; // 年上网电量
      const sn_top_CurrentPower = data.sn_top_CurrentPower / 1000; // 总有功
      setLeftItems(
        genLeftItems([totalPower, dayPwr, monthPwr, yearPwr, sn_top_YearPwr]),
      );
      setRightItems(
        genRightItems([
          sn_top_CurrentPower,
          equUtilHours,
          capacity,
          fieldNum,
          deviceNum,
        ]),
      );

      setInfo({ saveCoal: saveCoal, co2: co2 as unknown as string });
      setPieOption((op) => {
        const newOption = createPieOption(THEME, op);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = (newOption.series as any[]) || [];
        const dataArr = series[0]?.data || [];
        if (dataArr[0]) dataArr[0].value = Number(yearPwrRate);
        if (dataArr[1]) dataArr[1].value = 100 - Number(yearPwrRate);
        return newOption;
      });
    },
    {
      pollingInterval: 3000,
      // ready: false,
    },
  );

  useRequest(
    async () => {
      // const res = await Promise.resolve(electric);
      const res = await fetch('https://demo.theonly.vip:16666/api/electric');
      const json = await res.json();
      const data = json?.data?.cli?.dps?.Model?.data;
      const dates: string[] = [];
      const plans: number[] = [];
      const actuals: number[] = [];
      const powerRates: number[] = [];
      for (const item of data) {
        dates.push(`${item.month}月`);
        plans.push(item.hg_any_PlannedPower);
        actuals.push(item.hg_any_ActualPower);
        powerRates.push(Number(item.hg_any_PowerRate));
      }
      setBarOption((op) => {
        const newOption = createBarOption(THEME, op);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xAxis = (newOption as any).xAxis || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = (newOption.series as any[]) || [];
        if (xAxis[0]) xAxis[0].data = dates;
        if (series[0]) series[0].data = plans;
        if (series[1]) series[1].data = actuals;
        if (series[2]) series[2].data = powerRates;
        return newOption;
      });
    },
    {
      // pollingInterval: 3000,
      ready: false,
    },
  );

  useRequest(
    async () => {
      // const res = await Promise.resolve(business);
      const res = await fetch('https://demo.theonly.vip:16666/api/business');
      const json = await res.json();
      const data = json?.data?.cli?.dps?.Model?.data;
      const dates: string[] = [];
      const profits: number[] = [];
      const revenues: number[] = [];
      for (const item of data) {
        dates.push(`${item.month}月`);
        profits.push(item.hg_any_Profit);
        revenues.push(item.hg_any_Income);
      }
      setLineOption((op) => {
        const newOption = createLineOption(THEME, op);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xAxis = (newOption as any).xAxis;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series = (newOption.series as any[]) || [];
        if (xAxis) xAxis.data = dates;
        if (series[0]) series[0].data = profits;
        if (series[1]) series[1].data = revenues;
        return newOption;
      });
    },
    {
      // pollingInterval: 3000,
      ready: false,
    },
  );

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: THEME.pageBg,
      }}
    >
      <div
        style={{
          height: '100%',
          minHeight: 400,
          minWidth: 1200,
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          gap: 0,
          paddingBottom: 12,
        }}
      >
        {/* 顶部头部区域 */}
        <div
          style={{
            flex: '0 0 80px',
            padding: '0px 32px 0px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            backgroundImage: `url(${centerBg})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '700px',
            backgroundPosition: 'center',
          }}
        >
          {/* 左侧天气信息 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 180,
              justifySelf: 'start',
              padding: 0,
            }}
          >
            {/* <img src={logoSrc} alt="" style={{ height: 32 }} />
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: THEME.textPrimary,
              }}
            >
              上海申能新能源
            </span> */}
          </div>

          {/* 中间标题 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
              minWidth: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                padding: '10px 96px',
                borderRadius: 999,
                background: 'none',
                boxShadow: 'none',
                overflow: 'visible',
                top: -10
              }}
            >
              <span
                style={{
                  position: 'relative',
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: 6,
                  color: THEME.textPrimary,
                  textAlign: 'center',
                }}
              >
                天气资源预报系统
              </span>
            </div>
          </div>

          {/* 右侧时间 + 折叠主题切换 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 16,
              minWidth: 260,
              justifySelf: 'end',
            }}
          >
            <div
              style={{
                textAlign: 'right',
                fontSize: 24,
                color: THEME.textSecondary,
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: THEME.textPrimary,
                }}
              >
                {clock.time || '--:--:--'}
              </div>
              <div>{clock.date || '----/--/--'}</div>
            </div>

            {/* 折叠主题按钮 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setThemePanelOpen((v) => !v)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `1px solid ${THEME.cardBorder}`,
                  background:
                    'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.22) 0, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0) 70%)',
                  boxShadow: THEME.shadow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: THEME.textPrimary,
                }}
              >
                ≡
              </button>
              {themePanelOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 48,
                    right: 0,
                    padding: 8,
                    borderRadius: 12,
                    background: THEME.cardBg,
                    boxShadow: THEME.shadow,
                    border: THEME.cardBorder,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minWidth: 120,
                    zIndex: 10,
                  }}
                >
                  {[
                    { key: 'mid', label: '地图风格' },
                    { key: 'light', label: '浅色风格' },
                    { key: 'sky', label: '蓝白风格' },
                    { key: 'dark', label: '深色风格' },
                  ].map((item) => {
                    const active = themeKey === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() =>
                          handleThemeChange(
                            item.key as 'mid' | 'light' | 'sky' | 'dark',
                          )
                        }
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: active
                            ? `1px solid ${THEME.accent}`
                            : `1px solid transparent`,
                          background: active
                            ? THEME.accent
                            : 'rgba(255,255,255,0.04)',
                          color: active ? '#fff' : THEME.textSecondary,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 13,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <Windy></Windy>


        {false && (
          <>
            <div style={{ flex: 8, display: 'flex' }}>
              <div
                style={{
                  flex: '0 0 240px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0 16px 0 16px',
                  width: 260,
                  overflow: 'hidden',
                  gap: 12,
                }}
              >
                {leftItems.map((item) => (
                  <Card key={item.title} theme={THEME} {...item}></Card>
                ))}
              </div>
              <div
                style={{
                  flex: 14,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 0',
                  minHeight: 520,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 12,
                    borderRadius: THEME.radius * 2,
                    background:
                      'radial-gradient(circle at 50% 45%, rgba(61, 139, 253, 0.12) 0%, rgba(61, 139, 253, 0.06) 45%, rgba(61, 139, 253, 0) 60%), radial-gradient(circle at 50% 50%, rgba(58, 193, 170, 0.12) 0%, rgba(58, 193, 170, 0.02) 55%, rgba(58, 193, 170, 0) 75%)',
                    boxShadow:
                      '0 30px 68px rgba(15, 23, 42, 0.14), inset 0 0 0 1px rgba(61, 139, 253, 0.16)',
                    pointerEvents: 'none',
                  }}
                ></div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 12,
                    borderRadius: '50%',
                    background:
                      'repeating-radial-gradient(circle at 50% 50%, rgba(61, 139, 253, 0.12) 0, rgba(61, 139, 253, 0.12) 1px, rgba(61, 139, 253, 0) 9px)',
                    pointerEvents: 'none',
                    opacity: 0.5,
                  }}
                ></div>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: THEME.radius * 1.4,
                    overflow: 'hidden',
                    boxShadow: THEME.shadow,
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241, 248, 255, 0.9) 60%, rgba(230, 242, 252, 0.84) 100%)',
                  }}
                >
                  {isWindy ? <Windy></Windy> : <WeatherMap></WeatherMap>}
                </div>
              </div>
              <div
                style={{
                  flex: '0 0 240px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0px 16px 0 16px',
                  overflow: 'hidden',
                  width: 260,
                  gap: 12,
                }}
              >
                {rightItems.map((item) => (
                  <Card key={item.title} theme={THEME} {...item}></Card>
                ))}
              </div>
            </div>
            <div
              style={{
                flex: '1 0 140px',
                display: 'flex',
              }}
            >
              <div
                style={{
                  height: '100%',
                  flex: '0 0 200px',
                  padding: '0 16px',
                  display: 'flex',
                  width: 180,
                }}
              >
                <Card
                  theme={THEME}
                  title="年完成率"
                  value={<Chart theme={THEME} option={pieOption} />}
                  unit="发电量"
                  style={{ margin: 0, width: '180px' }}
                ></Card>
              </div>
              <div
                style={{
                  flex: 11,
                  display: 'flex',
                  gap: 12,
                  padding: '0 12px',
                }}
              >
                <div style={{ flex: 5, minWidth: 0 }}>
                  <Chart theme={THEME} option={barOption}></Chart>
                </div>
                <div style={{ flex: 5, minWidth: 0 }}>
                  <Chart theme={THEME} option={lineOption}></Chart>
                </div>
                <div
                  style={{
                    flex: '0 0 180px',
                    width: 180,
                    minWidth: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    background: THEME.panelBg,
                    padding: '0 16px',
                    textAlign: 'left',
                    borderRadius: THEME.radius + 4,
                    boxShadow: THEME.shadow,
                  }}
                >
                  <div style={{ flex: 1 }}></div>
                  <div
                    style={{
                      flex: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 16,
                        fontWeight: 'bold',
                      }}
                    >
                      节约标准煤
                    </div>
                    <div style={{ color: THEME.accent, fontSize: 24 }}>
                      {formatNumber(info.saveCoal)}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 16,
                        fontWeight: 'bold',
                      }}
                    >
                      CO2减排量
                    </div>
                    <div style={{ color: THEME.accent, fontSize: 24 }}>
                      {formatNumber(info.co2)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}></div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card(props: {
  title: string;
  unit: string;
  value: ReactNode;
  style?: React.CSSProperties;
  theme: (typeof THEMES)[keyof typeof THEMES];
}) {
  const { title, unit, value, style, theme } = props;
  return (
    <div
      style={{
        background: theme.cardBg,
        display: 'flex',
        minHeight: 100,
        flexDirection: 'column',
        marginBottom: 16,
        flex: 1,
        borderRadius: theme.radius,
        overflow: 'hidden',
        boxShadow: theme.shadow,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 16,
          padding: '4px 16px',
          background: theme.cardHeaderBg,
          borderBottom: theme.cardBorder,
        }}
      >
        <span style={{ color: theme.textPrimary, fontWeight: 'bold' }}>
          {title}
        </span>
        &nbsp;&nbsp;
        <span style={{ color: theme.muted }}>{unit}</span>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '4px 16px',
          color: theme.accent,
          height: 0,
          // background: "rgba(255,255,255,0.6)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const createBarOption = (
  theme: (typeof THEMES)[keyof typeof THEMES],
  prev?: EChartsOption,
) => {
  const option = {
    title: {
      text: '年发电量',
      left: 'left',
      textStyle: {
        color: theme.accent,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: theme.textPrimary,
        },
      },
    },
    legend: {
      textStyle: {
        color: theme.textPrimary,
      },
      data: ['计划发电量', '实际发电量', '完成率'],
    },
    xAxis: [
      {
        type: 'category',
        data: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'],
        axisPointer: {
          type: 'shadow',
        },
        axisLabel: {
          color: theme.textSecondary,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '',
        min: 0,
        max: 1250,
        axisLabel: {
          color: theme.textSecondary,
          formatter: '{value}',
        },
      },
      {
        type: 'value',
        name: '完成率',
        min: 60,
        max: 100,
        axisLabel: {
          color: theme.textSecondary,
          formatter: '{value} %',
        },
        splitLine: {
          show: false,
        },
        nameTextStyle: {
          color: theme.textPrimary,
        },
      },
    ],
    series: [
      {
        name: '计划发电量',
        type: 'bar',
        itemStyle: {
          color: theme.accent,
        },
        tooltip: {
          valueFormatter: function (value: number) {
            return value + ' 万kWh';
          },
        },
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: '实际发电量',
        type: 'bar',
        itemStyle: {
          color: theme.accentAlt,
        },
        tooltip: {
          valueFormatter: function (value: number) {
            return value + ' 万kWh';
          },
        },
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        name: '完成率',
        type: 'line',
        yAxisIndex: 1,
        tooltip: {
          valueFormatter: function (value: number) {
            return value + ' %';
          },
        },
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  } as EChartsOption;

  if (prev) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xAxis = option.xAxis as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevXAxis = prev.xAxis as any[];
    if (prevXAxis?.[0]?.data) xAxis[0].data = prevXAxis[0].data;
    const series = option.series as SeriesOption[];
    const prevSeries = prev.series as SeriesOption[];
    if (prevSeries?.[0]?.data) series[0].data = prevSeries[0].data;
    if (prevSeries?.[1]?.data) series[1].data = prevSeries[1].data;
    if (prevSeries?.[2]?.data) series[2].data = prevSeries[2].data;
  }

  return option;
};

const createPieOption = (
  theme: (typeof THEMES)[keyof typeof THEMES],
  prev?: EChartsOption,
) => {
  const option = {
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        name: '年完成率',
        type: 'pie',
        radius: ['60%', '90%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          fontSize: 24,
          fontWeight: 'bold',
          color: theme.accent,
          formatter: function (params: { percent: number }) {
            return params.percent + '%';
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          { value: 0, name: '完成率', itemStyle: { color: theme.accent } },
          { value: 0, name: '未完成率', itemStyle: { color: theme.accentAlt } },
        ],
      },
    ],
  } as EChartsOption;

  if (prev) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = option.series as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevSeries = prev.series as any[];
    if (prevSeries?.[0]?.data?.[0]) {
      series[0].data[0].value = prevSeries[0].data[0].value;
    }
    if (prevSeries?.[0]?.data?.[1]) {
      series[0].data[1].value = prevSeries[0].data[1].value;
    }
  }

  return option;
};

function Chart(props: {
  option: EChartsOption;
  theme: (typeof THEMES)[keyof typeof THEMES];
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(container.current as HTMLElement);
    chart.setOption(props.option);
  }, [props.option]);
  return (
    <div
      ref={container}
      style={{
        background: props.theme.cardBg,
        height: '100%',
        width: '100%',
        borderRadius: props.theme.radius,
        overflow: 'hidden',
        boxShadow: props.theme.shadow,
      }}
    ></div>
  );
}

// function PieChart() {
//   const container = useRef<HTMLDivElement>(null);
//   useEffect(() => {
//     const chart = echarts.init(container.current as HTMLElement);
//     chart.setOption(PIE_OPTION);
//   }, []);
//   return <div ref={container} style={{ height: "100%", width: "100%" }}></div>;
// }
