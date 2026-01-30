import { useEffect, useState } from "react";
import "./weather-buttons.css";

type WeatherLayerItem = { name: string; id: string; img?: string };
type WeatherLayerGroup = { title: string; items: WeatherLayerItem[] };

const weatherLayerGroups: WeatherLayerGroup[] = [
    {
        title: "风",
        items: [
            { name: "风", id: "wind", img: "/wind.jpg" },
            { name: "阵风", id: "gust", img: "/gust.jpg" },
            //   { name: "风积", id: "windAccumulation", img: "/gustAccu.jpg" },
            { name: "雷雨", id: "rain", img: "/thunder.jpg" },
            { name: "积雨", id: "rainAccu", img: "/rainAccu-v2.jpg" },
        ],
    },
    {
        title: "雨、雪",
        items: [
            { name: "新雪", id: "snowAccu", img: "/snowAccu.jpg" },
            { name: "积雪", id: "snowcover", img: "/snowcover.jpg" },
            { name: "降水类型", id: "ptype", img: "/ptype.jpg" },
        ],
    },
    {
        title: "温度",
        items: [
            { name: "温度", id: "temp", img: "/temp.jpg" },
            { name: "露点", id: "dewpoint", img: "/dewpoint.jpg" },
            { name: "湿度", id: "rh", img: "/rh.jpg" },
            { name: "冰冻高度", id: "deg0", img: "/deg0.jpg" },
        ],
    },
    {
        title: "云量、航空",
        items: [
            { name: "云", id: "clouds", img: "/clouds.jpg" },
            { name: "高云", id: "hclouds", img: "/hclouds.jpg" },
            { name: "中云", id: "mclouds", img: "/mclouds.jpg" },
            { name: "低云", id: "lclouds", img: "/lclouds.jpg" },
            { name: "雾", id: "fog", img: "/fog.jpg" },
            { name: "对流有效位能指数（CAPE）", id: "cape", img: "/cape.jpg" },
        ],
    },
    {
        title: "海洋",
        items: [
            { name: "波浪", id: "waves", img: "/waves.jpg" },
            { name: "涌浪", id: "swell1", img: "/swell1.jpg" },
            { name: "二级涌浪", id: "swell2", img: "/swell2.jpg" },
            { name: "三级涌浪", id: "swell3", img: "/swell3.jpg" },
            { name: "风浪", id: "wwaves", img: "/wwaves.jpg" },
            { name: "海流", id: "currents", img: "/currents.jpg" },
            { name: "潮流", id: "currentsTide", img: "/currentsTide.jpg" },
        ],
    },
    {
        title: "空气质量",
        items: [
            { name: "二氧化氮", id: "no2", img: "/no2.jpg" },
            { name: "PM2.5", id: "pm2p5", img: "/pm2p5.jpg" },
            { name: "气溶胶", id: "aod550", img: "/aod550.jpg" },
            { name: "臭氧层", id: "gtco3", img: "/gtco3.jpg" },
            { name: "二氧化硫质量", id: "tcso2", img: "/tcso2.jpg" },
            { name: "地表臭氧", id: "go3", img: "/go3.jpg" },
            { name: "co浓度", id: "cosc", img: "/cosc.jpg" },
            { name: "粉尘浓度", id: "dustsm", img: "/dustsm.jpg" },
            // { name: "火灾强度", id: "fires", img: "/fires.jpg" },
        ],
    },
    {
        title: "其他",
        items: [
            { name: "气压", id: "pressure", img: "/pressure.jpg" },
            { name: "卫星", id: "satellite", img: "/cloudtop.jpg" },
            // { name: "热气流", id: "heatmaps", img: "/heatmaps.jpg" },
            { name: "火灾强度", id: "fires", img: "/fwi.jpg" },
        ],
    },
];

const quickButtons: WeatherLayerItem[] = [
    { name: "风", id: "wind", img: "/wind.jpg" },
    { name: "雨、雷暴", id: "rain", img: "/thunder.jpg" },
    { name: "温度", id: "temp", img: "/temp.jpg" },
    { name: "云", id: "clouds", img: "/clouds.jpg" },
    { name: "气压", id: "pressure", img: "/pressure.jpg" },
];

export function WeatherButtons(props: { onClick?: (id: string) => void }) {
    const { onClick } = props;

    const [activeId, setActiveId] = useState<string>("wind");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const menuIconSrc = isDrawerOpen
        ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' fill='none'><line x1='18' y1='18' x2='46' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/><line x1='46' y1='18' x2='18' y2='46' stroke='white' stroke-width='6' stroke-linecap='round'/></svg>"
        : "/text-align-justify.svg";

    useEffect(() => {
        document.body.classList.toggle("drawer-open", isDrawerOpen);
        return () => {
            document.body.classList.remove("drawer-open");
        };
    }, [isDrawerOpen]);

    const handleItemClick = (id: string) => {
        setActiveId(id); // 更新内部 UI 状态
        onClick?.(id); // 触发父组件传入的回调
    };

    return (
        <div className={`weather-buttons ${isDrawerOpen ? "drawer-open" : ""}`}>
            <div className="weather-menu-toggle">
                <div className="weather-quick-list">
                    <div
                        className="menu-title-container weather-quick-item"
                        onClick={() => setIsDrawerOpen((prev) => !prev)}
                    >
                        <span className="weather-quick-label menu-title-label">
                            {isDrawerOpen ? "关闭" : "菜单"}
                        </span>
                        <img
                            src={menuIconSrc}
                            alt={isDrawerOpen ? "关闭" : "菜单"}
                            className="menu-toggle-icon"
                        />
                    </div>
                    {quickButtons.map((item) => (
                        <div
                            key={item.id}
                            className={`weather-quick-item ${activeId === item.id ? "active" : ""
                                }`}
                            onClick={() => handleItemClick(item.id)}
                        >
                            <span className="weather-quick-label">{item.name}</span>
                            <img
                                src={item.img}
                                alt={item.name}
                                className="weather-quick-icon"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className={`weather-drawer ${isDrawerOpen ? "open" : ""}`}>
                <div className="weather-drawer-title">图层菜单</div>
                <div className="weather-drawer-content">
                    {weatherLayerGroups.map((group) => (
                        <div key={group.title} className="weather-drawer-section">
                            <div className="weather-drawer-section-title">{group.title}</div>
                            <div className="weather-drawer-grid">
                                {group.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`weather-drawer-card ${activeId === item.id ? "active" : ""
                                            }`}
                                        onClick={() => handleItemClick(item.id)}
                                    >
                                        <div
                                            className={`weather-drawer-card-image ${item.img ? "has-image" : "no-image"
                                                }`}
                                            style={
                                                item.img ? { backgroundImage: `url(${item.img})` } : {}
                                            }
                                        >
                                            {!item.img && (
                                                <span className="weather-drawer-card-icon">
                                                    {item.name.slice(0, 1)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="weather-drawer-card-label">{item.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
