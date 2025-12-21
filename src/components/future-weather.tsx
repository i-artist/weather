import dayjs from "dayjs";
import { AntCloudOutlined, ClockCircleOutlined, CloseCircleOutlined, CloseOutlined, CloudOutlined } from "@ant-design/icons";
import "./future-weather.css";
import axios from "axios";
import { useEffect, useState } from "react";
import 'qweather-icons/font/qweather-icons.css';
import { Button } from "antd";
// const renderData = groupByDateToArray({
//     timestamp: data.data.timestamp,
//     values: data.data.data[0].values,
//     mete_var: data.data.mete_var,
// });

const key = 'eyJhbGciOiJFZERTQSIsImtpZCI6Iks0V01LOU1VQUYifQ.eyJzdWIiOiI0R0tSRVVOSDU1IiwiaWF0IjoxNzY2MzE1MTQwLCJleHAiOjE3NjY0MDE1NDB9.QWDtbVq_huZZVrhk_VMQfe-Gg_fB-vhVUvIEFw8JKynsSlHGF-7IGJTRbhRzqMLt22tCQdMapFj9j5F-_RzQAg'
// skt 地表温度
// ssrd 平均辐照度
// u10m 地面10米风U分量
// v10m 地面10米风V分量


export function FutureWeather({ onClose, location }: { onClose: () => void, location: string }) {

    const [weathers, setWeathers] = useState<any[]>([]);

    const getData = () => {
        axios.get(`https://pb4nmtv3tm.re.qweatherapi.com/v7/weather/72h?location=${location}`, {
            headers: {
                Authorization: 'Bearer ' + key,
            }
        }).then((res) => {
            console.log('res', res);
            const hourly = res.data.hourly;
            const grouped = groupHourlyByDate(hourly);
            setWeathers(grouped);
        }).catch((err) => {
            console.log('err', err);
        });
        // axios
        //     .post(
        //         'https://api-pro-openet.terraqt.com/v1/aifs_surface/point',
        //         {
        //             lon: 121,
        //             lat: 31.442222,
        //             mete_vars: ['skt', 'ssrd', 'u10m', 'v10m'],
        //             // time: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
        //             // time: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 08:00:00',
        //         },
        //         {
        //             headers: {
        //                 token: 'jBDMwETZyMzNhBDMwEGMwM2YwkzNzYWN',
        //             },
        //         },
        //     )
    }

    useEffect(() => {
        if (location === '') return;
        getData();
    }, [location]);
    return (
        <div className={`future-weather ${location ? '' : 'hidden'}`}>
            <Button icon={<CloseOutlined />} shape="circle" className="future-weather-close" onClick={onClose}></Button>
            <div className="future-weather-th">
                <div className="future-weather-row"></div>
                <div className="future-weather-body">
                    <div className="future-weather-row future-weather-item-category" onClick={getData}>
                        小时
                        <span className="future-weather-row-symbol">
                            <ClockCircleOutlined />
                        </span>
                    </div>
                    <div className="future-weather-row future-weather-item-category"></div>
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
                        风力等级 <span className="future-weather-row-symbol">
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
            <div className="future-weather-scrollable ">

                {
                    weathers.map((item) => (
                        <div className="future-weather-content" key={item.date}>
                            <div className="future-weather-row future-weather-item-weekday">
                                {item.week} {item.day}
                            </div>
                            <div className="future-weather-cbody">
                                {item.weather.map((timeItem: any) => (
                                    <div className="future-weather-column" key={timeItem.time}>
                                        <div className="future-weather-row">
                                            {timeItem.hour}
                                        </div>
                                        <div className="future-weather-row">
                                            <i className={`qi-${timeItem.icon}`}></i>
                                        </div>
                                        <div className="future-weather-row">
                                            {timeItem.temp}°
                                        </div>
                                        <div className="future-weather-row">
                                            {timeItem.precip}
                                        </div>
                                        <div className="future-weather-row">
                                            {timeItem.windSpeed}
                                        </div>

                                        <div className="future-weather-row">
                                            {timeItem.windScale.split('-')[1]}
                                        </div>
                                        <div className="future-weather-row">
                                            <div style={{ transform: `rotate(${timeItem.wind360 - 90}deg)`, transition: 'transform 0.3s ease' }}>➡️</div>
                                        </div>
                                    </div>
                                ))}

                            </div>
                        </div>
                    ))
                }
            </div>


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
        const [date, time] = ts.split(" ");

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
            ...valueObj,
        });
    });

    return Array.from(map.entries()).map(([date, list]) => ({
        date,
        week: dayjs(date).format('ddd'),
        day: dayjs(date).format('DD'),
        list,
    }));
}


function groupHourlyByDate(hourly: any[]) {
    const map = new Map();

    for (const item of hourly) {
        // 取日期部分：2025-12-21
        const date = item.fxTime.slice(0, 10);

        if (!map.has(date)) {
            map.set(date, {
                date,
                week: dayjs(date).format('ddd'),
                day: dayjs(date).format('DD'),
                weather: []
            });
        }

        map.get(date).weather.push({ ...item, hour: dayjs(item.fxTime).hour() });
    }

    return Array.from(map.values());
}

