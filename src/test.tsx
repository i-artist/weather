/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

// Windy API 类型定义
type WindyAPI = {
  map: any;
  store: any;
  picker: any;
  utils: any;
  broadcast: any;
};

type WindyWindow = Window & {
  windyInit?: (
    opts: {
      key: string;
      verbose?: boolean;
      lat?: number;
      lon?: number;
      zoom?: number;
    },
    callback: (api: WindyAPI) => void,
  ) => void;
  L?: any;
};

// 可用的图层列表
const layers = [
  { id: "wind", label: "风速 (Wind)" },
  { id: "rain", label: "降雨 (Rain)" },
  { id: "temp", label: "温度 (Temp)" },
  { id: "clouds", label: "云图 (Clouds)" },
  { id: "pressure", label: "气压 (Pressure)" },
];

export default function Test() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const windyApiRef = useRef<WindyAPI | null>(null);
  const [activeLayer, setActiveLayer] = useState("wind");

  useEffect(() => {
    // 防止重复初始化
    if (initializedRef.current || !containerRef.current) {
      return;
    }

    // 检查 Windy API 是否已加载
    const checkAndInit = () => {
      const windyWindow = window as WindyWindow;
      if (windyWindow.windyInit && windyWindow.L) {
        const options = {
          // 使用项目中的 API key
          key: "G4x76YUokVT2laj5u8iavAyjKFybnoCL", // 项目中的 Windy API key
          verbose: true,
          lat: 50.4,
          lon: 14.3,
          zoom: 5,
        };

        // 初始化 Windy API
        windyWindow.windyInit(options, (windyAPI: WindyAPI) => {
          // windyAPI 已准备就绪
          const { picker, utils, broadcast, store } = windyAPI;
          windyApiRef.current = windyAPI; // 保存 API 引用以便外部使用
          console.log("Windy API 已初始化", windyAPI);

          // 监听 picker 打开事件
          picker.on("pickerOpened", ({ lat, lon, values, overlay }: any) => {
            console.log("Picker 已打开", { lat, lon, values, overlay });

            // 如果是风数据，转换为可读格式
            if (overlay === "wind" && values) {
              const windObject = utils.wind2obj(values);
              console.log("风数据:", windObject);
            }
          });

          // 监听 picker 移动事件
          picker.on("pickerMoved", ({ lat, lon, values, overlay }: any) => {
            console.log("Picker 已移动", { lat, lon, values, overlay });

            // 如果是风数据，转换为可读格式
            if (overlay === "wind" && values) {
              const windObject = utils.wind2obj(values);
              console.log("风数据:", windObject);
            }
          });

          // 监听 picker 关闭事件
          picker.on("pickerClosed", () => {
            console.log("Picker 已关闭");
          });

          // 监听 picker 位置变化事件
          store.on("pickerLocation", ({ lat, lon }: any) => {
            console.log("Picker 位置变化", { lat, lon });

            const { values, overlay } = picker.getParams();
            console.log("位置变化详情", { lat, lon, values, overlay });

            // 如果是风数据，转换为可读格式
            if (overlay === "wind" && values) {
              const windObject = utils.wind2obj(values);
              console.log("风数据:", windObject);
            }
          });

          // 等待地图渲染完成后打开 picker
          broadcast.once("redrawFinished", () => {
            // 打开 picker（异步操作）
            picker.open({ lat: 48.4, lon: 14.3 });
            console.log("Picker 已打开在位置: 48.4, 14.3");
          });
        });

        initializedRef.current = true;
      } else {
        // 如果脚本还未加载，等待一段时间后重试（最多等待 5 秒）
        const maxRetries = 50;
        let retries = 0;
        const retryInterval = setInterval(() => {
          retries++;
          const checkWindow = window as WindyWindow;
          if (checkWindow.windyInit && checkWindow.L) {
            clearInterval(retryInterval);
            checkAndInit();
          } else if (retries >= maxRetries) {
            clearInterval(retryInterval);
            console.error(
              "Windy API 脚本加载超时，请检查 index.html 中的脚本引用",
            );
          }
        }, 100);
      }
    };

    // 等待 DOM 和脚本加载
    if (document.readyState === "complete") {
      checkAndInit();
    } else {
      window.addEventListener("load", checkAndInit);
    }

    // 清理函数
    return () => {
      initializedRef.current = false;
    };
  }, []);

  // 切换图层
  const handleLayerChange = (layerId: string) => {
    setActiveLayer(layerId);
    if (windyApiRef.current && windyApiRef.current.store) {
      windyApiRef.current.store.set("overlay", layerId);
      console.log("图层已切换为:", layerId);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 图层切换控制面板 */}
      <div style={styles.controlPanel}>
        <h3 style={styles.title}>切换图层</h3>
        <div style={styles.buttonGroup}>
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => handleLayerChange(layer.id)}
              style={{
                ...styles.button,
                backgroundColor:
                  activeLayer === layer.id ? "#007bff" : "#f0f0f0",
                color: activeLayer === layer.id ? "#fff" : "#333",
              }}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Windy 地图容器 */}
      <div
        id="windy"
        ref={containerRef}
        style={{
          width: "100%",
          height: "500px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />
    </div>
  );
}

// 样式定义
const styles: {
  controlPanel: React.CSSProperties;
  title: React.CSSProperties;
  buttonGroup: React.CSSProperties;
  button: React.CSSProperties;
} = {
  controlPanel: {
    background: "rgba(255, 255, 255, 0.95)",
    padding: "15px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: "16px",
    color: "#333",
    fontWeight: "600",
  },
  buttonGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  button: {
    padding: "8px 16px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s",
    fontWeight: "500",
    fontSize: "14px",
  },
};
