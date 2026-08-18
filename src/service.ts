
import axios from 'axios';

// ==================== 1. 配置区域 ====================

const REALTIME_API = '/api/realtime';

// 风电 ID 列表
const WIND_IDS = [
  "140929", "150133", "150213", "150842", "152202", "152541", "152925",
  "310115", "310116", "310117", "310118", "310119", "310122", "310123",
  "320645", "320646", "340602", "341606", "410410", "410486", "411121",
  "411208", "410881", "411312", "411623", "411626", "411648", "411649", "429009",
  "431103", "451422", "610000", "610809", "610886", "632548", "632897",
  "632898", "632900", "652307", "460401"
];

// 光伏 ID 列表 (33个，包含 361002)
const PV_IDS = [
  "101084", "130734", "130809", "130837", "130838", "140938", "140939",
  "320707", "341525", "341823", "361002", "370325", "370404", "411209",
  "420602", "420603", "420807", "429008", "450704", "520309", "520425",
  "520428", "522726", "522727", "610860", "612202", "612247", "640127",
  "653189", "653203", "653205", "653221", "653223"
];

// ==================== 2. 请求函数 ====================

const postPowerApi = async (
  url: string,
  extraPayload: Record<string, unknown> = {},
) => {
  const response = await axios.post(url, {
    remotePort: '8102',
    windIds: WIND_IDS,
    pvIds: PV_IDS,
    ...extraPayload,
  }, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  if (response.status === 200) {
    return response.data;
  }
  console.error('API Error:', response.status);
  return null;
};

/**
 * 统一解析 ModelData
 */
export const normalizeModelData = (json: any) => {
  if (!json) return null;
  return json?.data?.cli?.dps?.ModelData ?? json?.data ?? json;
};

/**
 * 获取实时发电数据（地图点位、弹窗等）
 * 请求体会带 remotePort / windIds / pvIds，后端按这些场站返回数据。
 */
export const fetchRealTimeData = async () => {
  try {
    const raw = await postPowerApi(REALTIME_API, {
      purpose: 'stationDetail',
    });
    return normalizeModelData(raw);
  } catch (error) {
    console.error('Request Failed:', error);
    throw error;
  }
};

/** kW 转 MW，保留两位小数 */
const kwToMw = (value: unknown): number => {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    return 0;
  }
  return Number((num / 1000).toFixed(2));
};

export const extractTotalPower = (data: any) => ({
  pvfs: kwToMw(data?.pvfsIndex?.sn_top_CurrentPower_pvfs),
  wfs: kwToMw(data?.wfsIndex?.sn_top_CurrentPower_wfs),
});

/**
 * 获取总光伏发电功率、总风机发电功率
 * 走天润实时接口，后端按 windIds/pvIds 汇总。
 */
export const fetchTotalPowerData = async () => {
  try {
    const data = normalizeModelData(await postPowerApi(REALTIME_API, {
      purpose: 'totalPower',
      allowStale: false,
    }));
    if (!data) return null;
    return extractTotalPower(data);
  } catch (error) {
    console.error('Request Failed:', error);
    throw error;
  }
};
