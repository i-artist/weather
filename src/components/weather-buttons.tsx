import { useState } from "react";
import "./weather-buttons.css";

// 1. 修改子组件 Props 类型，增加 isActive
type WeatherButtonProps = {
    name: string;
    id: string;
    img?: string;
    isActive: boolean; // 新增：用于判断是否选中
    onClick?: () => void;
};

function WeatherButton(props: WeatherButtonProps) {
    const { name, id, img, onClick, isActive } = props;
    const src = img ?? `/${id}.jpg`;

    // 2. 根据 isActive 动态生成 className
    // 如果选中，className 就是 "weather-button active"，否则只是 "weather-button"
    const containerClass = isActive ? "weather-button active" : "weather-button";

    return (
        <div className={containerClass} onClick={onClick}>
            <div className="title">{name}</div>
            <img src={src} alt={name} />
        </div>
    );
}

type WeatherButtonItem = { name: string; id: string; img?: string };

const weatherButtonsData: WeatherButtonItem[] = [
    { name: "风", id: "wind" }, // 假设默认选中第一个
    { name: "云", id: "clouds" },
    { name: "降雨量", id: "rainAccu" },
    { name: "雨、雷暴", id: "rain" },
    { name: "温度", id: "temp" },
    { name: "气压", id: "pressure" },
];

export function WeatherButtons(props: { onClick?: (id: string) => void }) {
    const { onClick } = props;

    // 3. 添加状态管理，默认选中 'wind' (也可以设为 null)
    const [activeId, setActiveId] = useState<string>("wind");

    const handleItemClick = (id: string) => {
        setActiveId(id); // 更新内部 UI 状态
        onClick?.(id); // 触发父组件传入的回调
    };

    return (
        <div className="weather-buttons">
            {weatherButtonsData.map((item) => (
                <WeatherButton
                    key={item.id}
                    name={item.name}
                    id={item.id}
                    img={item.img}
                    // 4. 判断当前按钮是否被选中，并传给子组件
                    isActive={activeId === item.id}
                    onClick={() => handleItemClick(item.id)}
                />
            ))}
        </div>
    );
}
