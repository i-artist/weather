/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRequest } from 'ahooks';
import * as echarts from 'echarts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Windy } from './components/windy.js';

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

const LINE_OPTION = {
  title: {
    text: '经营指标（全口径）',
    left: 'left',
    textStyle: {
      color: '#0ef9f2',
    },
  },
  tooltip: {
    trigger: 'axis',
  },
  legend: {
    textStyle: {
      color: '#f9f9fa',
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
    // axisLabel: {
    //   color: '#f9f9fa',
    // },
    data: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'],
  },
  yAxis: {
    type: 'value',
    // axisLabel: {
    //   color: '#f9f9fa',
    // },
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
};

export default function Dashboard() {
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

  const [pieOption, setPieOption] = useState(PIE_OPTION);
  const [lineOption, setLineOption] = useState(LINE_OPTION);
  const [barOption, setBarOption] = useState(Option);

  const [info, setInfo] = useState({ saveCoal: '0', co2: '0' });

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
        const newOption = { ...op };
        newOption.series[0].data[0].value = Number(yearPwrRate);
        newOption.series[0].data[1].value = 100 - Number(yearPwrRate);
        return newOption;
      });
    },
    {
      pollingInterval: 3000,
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
        const newOption = { ...op };
        newOption.xAxis[0].data = dates;
        newOption.series[0].data = plans;
        newOption.series[1].data = actuals;
        newOption.series[2].data = powerRates;
        return newOption;
      });
    },
    {
      pollingInterval: 3000,
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
        const newOption = { ...op };
        newOption.xAxis.data = dates;
        newOption.series[0].data = profits;
        newOption.series[1].data = revenues;
        return newOption;
      });
    },
    {
      pollingInterval: 3000,
    },
  );

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#0a152d' }}>
      <div
        style={{
          height: '100%',
          minHeight: 500,
          minWidth: 1200,
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            flex: '0 0 50px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src="/logo.png" alt="" style={{ height: 32 }} />
          <span style={{ fontSize: 24, color: '#fff', marginLeft: 8 }}>
            申能股份风光存储信息系统
          </span>
          <span style={{ fontSize: 16, color: '#fff', marginLeft: 16 }}>
            申能股份
          </span>
        </div>
        <div style={{ flex: 8, display: 'flex' }}>
          <div
            style={{
              flex: '0 0 200px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0 16px 0 16px',
              width: 240,
              overflow: 'hidden',
            }}
          >
            {leftItems.map((item) => (
              <Card key={item.title} {...item}></Card>
            ))}
          </div>
          <div style={{ flex: 10 }}>
            {/* <Map /> */}
            <Windy></Windy>
          </div>
          <div
            style={{
              flex: '0 0 200px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0px 16px 0 16px',
              overflow: 'hidden',
              width: 240,
            }}
          >
            {rightItems.map((item) => (
              <Card key={item.title} {...item}></Card>
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
              title="年完成率"
              value={<Chart option={pieOption} />}
              unit="发电量"
              style={{ margin: 0, width: '180px' }}
            ></Card>
          </div>
          <div style={{ flex: 11, display: 'flex' }}>
            <div style={{ flex: 5 }}>
              <Chart option={barOption}></Chart>
            </div>
            <div style={{ flex: 5 }}>
              <Chart option={lineOption}></Chart>
            </div>
            <div
              style={{
                flex: '0 0 170px',
                width: 200,
                display: 'flex',
                flexDirection: 'column',
                background: '#041f2b',
                padding: '0 16px',
                marginLeft: 16,
                marginRight: 16,
                textAlign: 'left',
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
                  style={{ color: '#e6f2f3', fontSize: 16, fontWeight: 'bold' }}
                >
                  节约标准煤
                </div>
                <div style={{ color: '#0ef9f2', fontSize: 24 }}>
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
                  style={{ color: '#e6f2f3', fontSize: 16, fontWeight: 'bold' }}
                >
                  CO2减排量
                </div>
                <div style={{ color: '#0ef9f2', fontSize: 24 }}>
                  {formatNumber(info.co2)}
                </div>
              </div>
              <div style={{ flex: 1 }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card(props: {
  title: string;
  unit: string;
  value: ReactNode;
  style?: React.CSSProperties;
}) {
  const { title, unit, value, style } = props;
  return (
    <div
      style={{
        background: '#041f2b',
        display: 'flex',
        minHeight: 100,
        flexDirection: 'column',
        marginBottom: 16,
        flex: 1,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 16,
          padding: '4px 16px',
          background: '#061d2d',
          borderBottom: '1px solid #0d303a',
        }}
      >
        <span style={{ color: '#f9f9fa', fontWeight: 'bold' }}>{title}</span>
        &nbsp;&nbsp;
        <span style={{ color: '#2f4a58' }}>{unit}</span>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '4px 16px',
          color: '#0ef9f2',
          height: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const Option = {
  title: {
    text: '年发电量',
    left: 'left',
    textStyle: {
      color: '#0ef9f2',
    },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      crossStyle: {
        color: '#f2ebeb',
      },
    },
  },
  legend: {
    textStyle: {
      color: '#f9f9fa',
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
        // color: '#f9f9fa',
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
        // color: '#f9f9fa',
        formatter: '{value}',
      },
    },
    {
      type: 'value',
      name: '完成率',
      min: 60,
      max: 100,
      axisLabel: {
        // color: '#f9f9fa',
        formatter: '{value} %',
      },
      splitLine: {
        show: false,
      },
      nameTextStyle: {
        color: '#f9f9fa',
      },
    },
  ],
  series: [
    {
      name: '计划发电量',
      type: 'bar',
      itemStyle: {
        color: '#0ef9f2',
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
        color: '#4c98e4',
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
};
const PIE_OPTION = {
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
        color: '#0ef9f2',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: function (params: any) {
          return params.percent + '%';
        },
      },
      labelLine: {
        show: false,
      },
      data: [
        { value: 0, name: '完成率', itemStyle: { color: '#13fcfc' } },
        { value: 0, name: '未完成率', itemStyle: { color: '#057c87' } },
      ],
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Chart(props: { option: any }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    console.log(props.option);
    const chart = echarts.init(container.current as HTMLElement);
    chart.setOption(props.option);
  }, [props.option]);
  return (
    <div
      ref={container}
      style={{ background: '#041f2b', height: '100%', width: '100%' }}
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
