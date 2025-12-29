/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AntCloudOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { Button, Segmented, Spin } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import 'qweather-icons/font/qweather-icons.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import ArrowsIcon from '../assets/arrows.svg';
import './future-weather.css';
import TemperatureChart from './temperature-chart';
// const renderData = groupByDateToArray({
//     timestamp: data.data.timestamp,
//     values: data.data.data[0].values,
//     mete_var: data.data.mete_var,
// });

// const key =
// 'eyJhbGciOiJFZERTQSIsImtpZCI6Iks0V01LOU1VQUYifQ.eyJzdWIiOiI0R0tSRVVOSDU1IiwiaWF0IjoxNzY2MzE1MTQwLCJleHAiOjE3NjY0MDE1NDB9.QWDtbVq_huZZVrhk_VMQfe-Gg_fB-vhVUvIEFw8JKynsSlHGF-7IGJTRbhRzqMLt22tCQdMapFj9j5F-_RzQAg';
// skt 地表温度
// ssrd 平均辐照度
// u10m 地面10米风U分量
// v10m 地面10米风V分量
// ws10m 地面10米风速
// wd10m 地面10米风向
// tp 一小时内总降水

interface IProps {
  onClose: () => void;
  location: string;
  datasource?: { name: string; value: number }[];
  source?: string;
  onScrollRef?: (ref: React.RefObject<HTMLDivElement | null>) => void;
  syncScroll?: (
    scrollLeft: number,
    sourceRef: React.RefObject<HTMLDivElement | null>,
  ) => void;
}
export function FutureWeather({
  location,
  source = 'aifs_surface',
  onScrollRef,
  syncScroll,
}: IProps) {
  const [weathers, setWeathers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(0);

  const getData = useCallback(() => {
    // axios.get(`https://pb4nmtv3tm.re.qweatherapi.com/v7/weather/72h?location=${location}`, {
    //     headers: {
    //         Authorization: 'Bearer ' + key,
    //     }
    // }).then((res) => {
    //     console.log('res', res);
    //     const hourly = res.data.hourly;
    //     const grouped = groupHourlyByDate(hourly);
    //     setWeathers(grouped);
    // }).catch((err) => {
    //     console.log('err', err);
    // });

    setLoading(true);
    const lon = location.split(',')[0];
    const lat = location.split(',')[1];
    let params = {};
    if (source === 'aifs_surface') {
      params = {
        mete_vars: ['skt', 'ssrd', 'ws100m', 'wd100m', 'tp', 'u10m', 'v10m'],
      };
    }
    if (source === 'gfs_surface') {
      params = {
        mete_vars: ['skt', 'ws100m', 'wd100m', 'tp', 'u10m', 'v10m'],
      };
    }
    if (source === 'gdas_surface') {
      params = {
        start_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        end_time: dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
        mete_vars: ['skt', 'ws100m', 'tp', 'u10m', 'v10m'],
      };
    }
    axios
      .post(
        `https://api-pro-openet.terraqt.com/v1/${source}/point`,
        {
          lon,
          lat,
          mete_vars: ['skt', 'ssrd', 'ws100m', 'wd100m', 'tp', 'u10m', 'v10m'],
          ...params,
          // time: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
          // time: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 08:00:00',
        },
        {
          headers: {
            token: 'jBDMwETZyMzNhBDMwEGMwM2YwkzNzYWN',
          },
        },
      )
      .then((res) => {
        console.log('res', res);
        if (!res.data.data) {
          setWeathers([]);
          return;
        }
        const grouped = groupByDateToArray({
          timestamp: res.data.data.timestamp,
          values: res.data.data.data[0].values,
          mete_var: res.data.data.mete_var,
        });
        setWeathers(grouped);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [location, source]);

  useEffect(() => {
    if (location === '') {
      setWeathers([]);
      return;
    }
    getData();
  }, [location, source, getData]);

  // 注册滚动容器引用
  useEffect(() => {
    if (onScrollRef && scrollRef.current) {
      onScrollRef(scrollRef);
    }
  }, [onScrollRef]);

  // 处理滚动同步
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || !scrollRef.current) return;

    // 如果正在同步滚动，跳过（避免循环）
    const element = e.currentTarget;
    if ((element as any).__isScrolling) return;

    const scrollLeft = element.scrollLeft;
    syncScroll(scrollLeft, scrollRef);
  };

  useEffect(() => {
    const width = scrollRef.current?.scrollWidth;
    setScrollWidth(width || 0);
  }, [weathers]);
  return (
    <Spin spinning={loading} className="future-weather-spin">
      <div className="future-weather-th">
        <div className="future-weather-row"></div>
        <div className="future-weather-body">
          <div
            className="future-weather-row future-weather-item-category"
            onClick={getData}
          >
            小时
            <span className="future-weather-row-symbol">
              <ClockCircleOutlined />
            </span>
          </div>
          {/* <div className="future-weather-row future-weather-item-category"></div> */}
          <div className="future-weather-row future-weather-item-category">
            温度 <span className="future-weather-row-symbol">°C</span>
          </div>
          <div className="future-weather-row future-weather-item-category">
            雨 <span className="future-weather-row-symbol">mm</span>
          </div>
          <div className="future-weather-row future-weather-item-category">
            风 <span className="future-weather-row-symbol">m/s</span>
          </div>
          <div className="future-weather-row future-weather-item-category">
            风力等级{' '}
            <span className="future-weather-row-symbol">
              <CloudOutlined />
            </span>
          </div>
          <div className="future-weather-row future-weather-item-category">
            风向
            <span className="future-weather-row-symbol">
              <AntCloudOutlined />
            </span>
          </div>
        </div>
      </div>
      <div
        className="future-weather-scrollable"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="future-weather-chart" style={{ width: scrollWidth }}>
          <TemperatureChart
            data={weathers
              .map((item) => item.weather)
              .flat()
              .map((item) => item.celsius)}
          ></TemperatureChart>
        </div>
        {weathers.map((item) => (
          <div className="future-weather-content" key={item.date}>
            <div className="future-weather-row future-weather-item-weekday">
              {item.week} {item.day}
            </div>
            <div className="future-weather-cbody">
              {item.weather.map((timeItem: any) => (
                <div className="future-weather-column" key={timeItem.time}>
                  {/* <div className="future-weather-row">{timeItem.hour}</div>
                  <div className="future-weather-row">
                    <i className={`qi-${timeItem.icon}`}></i>
                  </div>
                  <div className="future-weather-row">{timeItem.temp}°</div>
                  <div className="future-weather-row">{timeItem.precip}</div>
                  <div className="future-weather-row">{timeItem.windSpeed}</div>

                  <div className="future-weather-row">
                    {timeItem.windScale.split('-')[1]}
                  </div>
                  <div className="future-weather-row">
                    <div
                      style={{
                        transform: `rotate(${timeItem.wind360 - 90}deg)`,
                        transition: 'transform 0.3s ease',
                      }}
                    >
                      ➡️
                    </div>
                  </div> */}

                  <div className="future-weather-row future-weather-hour">
                    {timeItem.hour.toString().padStart(2, '0')}
                  </div>
                  <div className="future-weather-row future-weather-temp">
                    <span
                      className={`temp-value  ${getTempClass(
                        timeItem.celsius,
                      )}`}
                    >
                      {timeItem.celsius}°
                    </span>
                  </div>
                  <div className="future-weather-row future-weather-precip">
                    {timeItem.tp && timeItem.tp > 0 ? (
                      <span className="precip-value has-precip">
                        {timeItem.tp?.toFixed(1)}
                      </span>
                    ) : (
                      <span className="precip-value no-precip">-</span>
                    )}
                  </div>
                  <div className="future-weather-row future-weather-wind-speed">
                    <span
                      className={`wind-speed-value ${getWindSpeedClass(
                        timeItem.ws100m,
                      )}`}
                    >
                      {timeItem.ws100m?.toFixed(1)}
                    </span>
                  </div>
                  <div className="future-weather-row future-weather-wind-level">
                    <span
                      className={`wind-level-badge level-${timeItem.speed}`}
                    >
                      {timeItem.speed}
                    </span>
                  </div>
                  <div className="future-weather-row future-weather-wind-dir">
                    <div
                      className="wind-direction-arrow"
                      style={{
                        transform: `rotate(${timeItem.wd100m}deg)`,
                        transition: 'transform 0.3s ease',
                      }}
                      title={`${Math.round(timeItem.wd100m)}°`}
                    >
                      <img
                        style={{ width: '20px', height: '20px' }}
                        src={ArrowsIcon}
                        alt="arrow"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Spin>
  );
}

const WEATHER_OPTIONS = [
  { label: 'ECMWF', value: 'aifs_surface' },
  { label: 'GFS', value: 'gfs_surface' },
];

export function FutureWeatherModal(props: IProps) {
  const { onClose, location } = props;
  const [diffVisible, setDiffVisible] = useState(false);
  const [selectValue, setSelectValue] = useState('aifs_surface');
  return (
    <div className={`future-weather ${location ? '' : 'hidden'}`}>
      <Button
        icon={<CloseOutlined />}
        shape="circle"
        className="future-weather-close"
        onClick={onClose}
      ></Button>
      <FutureWeather {...props} source={selectValue}></FutureWeather>
      <div className="future-weather-segmented">
        <Segmented<{ label: string; value: string }>
          size="small"
          options={WEATHER_OPTIONS}
          onChange={(value) => {
            setSelectValue(value as unknown as string);
          }}
        />

        <Button
          onClick={() => setDiffVisible(true)}
          type="primary"
          className="future-weather-diff-btn"
          size="small"
        >
          对比
        </Button>
      </div>
      {diffVisible && (
        <FutureWeatherDiff
          {...props}
          onClose={() => setDiffVisible(false)}
        ></FutureWeatherDiff>
      )}
    </div>
  );
}

function FutureWeatherDiff(props: IProps) {
  const scrollRefs = useRef<React.RefObject<HTMLDivElement | null>[]>([]);

  // 同步滚动函数
  const syncScroll = (
    scrollLeft: number,
    sourceRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    scrollRefs.current.forEach((ref) => {
      if (
        ref &&
        ref.current &&
        ref !== (sourceRef as React.RefObject<HTMLDivElement | null>)
      ) {
        // 标记正在同步，避免触发滚动事件
        const element = ref.current;
        const isScrolling = (element as any).__isScrolling;
        if (!isScrolling) {
          (element as any).__isScrolling = true;
          element.scrollLeft = scrollLeft;
          // 使用 requestAnimationFrame 确保在下一帧重置标志
          requestAnimationFrame(() => {
            (element as any).__isScrolling = false;
          });
        }
      }
    });
  };

  // 注册滚动容器引用
  const registerScrollRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (
      ref &&
      !scrollRefs.current.includes(
        ref as React.RefObject<HTMLDivElement | null>,
      )
    ) {
      scrollRefs.current.push(ref as React.RefObject<HTMLDivElement | null>);
    }
  };

  return (
    <div className={`future-weather ${props.location ? '' : 'hidden'}`}>
      <Button
        icon={<CloseOutlined />}
        shape="circle"
        className="future-weather-close"
        onClick={props.onClose}
      ></Button>
      {WEATHER_OPTIONS.map((item) => (
        <div key={item.value} className="future-weather-diff">
          <div className="future-weather-diff-title">{item.label}</div>
          <FutureWeather
            {...props}
            source={item.value}
            onScrollRef={registerScrollRef}
            syncScroll={syncScroll}
          ></FutureWeather>
        </div>
      ))}
    </div>
  );
}

function groupByDateToArray(data: {
  timestamp: string[];
  values: number[][];
  mete_var: string[];
}) {
  const { timestamp, values, mete_var } = data;

  const map = new Map<string, any[]>();

  timestamp.forEach((ts, index) => {
    const [date, time] = ts.split(' ');

    if (!map.has(date)) {
      map.set(date, []);
    }

    const valueArr = values[index];
    const valueObj: Record<string, number> = {};

    mete_var.forEach((key, i) => {
      valueObj[key] = valueArr[i];
    });

    map.get(date)!.push({
      datetime: ts,
      time,
      hour: dayjs(ts).hour(),
      speed: windSpeedToLevel(valueObj?.ws100m || valueObj?.ws10m || 0),
      celsius: Math.round(kelvinToCelsius(valueObj?.skt || valueObj?.t2m || 0)),
      ...valueObj,
    });
  });
  let i = 0;
  return Array.from(map.entries())
    .map(([date, list]) => {
      i++;
      const weather = list.filter((item) => [2, 8, 14, 20].includes(item.hour));
      if (i === 1 && weather.length === 4) {
        weather.shift();
      }
      return {
        date,
        week: dayjs(date).format('ddd'),
        day: dayjs(date).format('DD'),
        weather,
      };
    })
    .slice(0, 14);
}

// eslint-disable-next-line react-refresh/only-export-components
export function groupHourlyByDate(hourly: any[]) {
  const map = new Map();

  for (const item of hourly) {
    // 取日期部分：2025-12-21
    const date = item.fxTime.slice(0, 10);

    if (!map.has(date)) {
      map.set(date, {
        date,
        week: dayjs(date).format('ddd'),
        day: dayjs(date).format('DD'),
        weather: [],
      });
    }

    map.get(date).weather.push({ ...item, hour: dayjs(item.fxTime).hour() });
  }

  return Array.from(map.values());
}

function windSpeedToLevel(speed: number): number {
  if (speed < 0.3) return 0;
  if (speed < 1.6) return 1;
  if (speed < 3.4) return 2;
  if (speed < 5.5) return 3;
  if (speed < 8.0) return 4;
  if (speed < 10.8) return 5;
  if (speed < 13.9) return 6;
  if (speed < 17.2) return 7;
  if (speed < 20.8) return 8;
  if (speed < 24.5) return 9;
  if (speed < 28.5) return 10;
  if (speed < 32.7) return 11;
  return 12;
}

function kelvinToCelsius(k: number): number {
  return k - 273.15;
}

function getTempClass(temp: number): string {
  if (temp >= 30) return 'temp-hot';
  if (temp >= 20) return 'temp-warm';
  if (temp >= 10) return 'temp-mild';
  if (temp >= 0) return 'temp-cool';
  return 'temp-cold';
}

function getWindSpeedClass(speed: number): string {
  if (speed >= 10.8) return 'wind-strong';
  if (speed >= 5.5) return 'wind-moderate';
  if (speed >= 1.6) return 'wind-light';
  return 'wind-calm';
}
