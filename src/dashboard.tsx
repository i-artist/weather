import * as echarts from 'echarts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Windy } from './components/windy.js';

function formatNumber(num, maximumFractionDigits = 2) {
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
function genLeftItems(arr: number[]) {
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

function genRightItems(arr: number[]) {
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
  },
  tooltip: {
    trigger: 'axis',
  },
  legend: {
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
    data: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'],
  },
  yAxis: {
    type: 'value',
  },
  series: [
    {
      name: '利润',
      type: 'line',
      stack: 'Total',
      data: [120, 132, 101, 134, 90, 230, 210],
    },
    {
      name: '收入',
      type: 'line',
      stack: 'Total',
      data: [220, 182, 191, 234, 290, 330, 310],
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
  >(genLeftItems([4102951.27, 1256.77, 10102.27, 717951.85, 685721.32]));

  const [rightItems, setRightItems] = useState<
    {
      title: string;
      unit: string;
      value: string;
    }[]
  >(genRightItems([1410.26, 1563.39, 5829.85, 71, 1734]));

  // useRequest(
  //   async () => {
  //     const res = await fetch('/dashboard.json');
  //     const json = await res.json();
  //     setLeftItems(genLeftItems(json.left));
  //     setRightItems(genRightItems(json.right));
  //   },
  //   {
  //     pollingInterval: 3000,
  //   },
  // );
  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#010102' }}>
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
              flex: '0 0 170px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0 16px 0 16px',
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
              flex: '0 0 170px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0px 16px 0 16px',
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
              flex: '0 0 177px',
              padding: '0 16px',
              display: 'flex',
              width: 160,
            }}
          >
            <Card
              title="年完成率"
              value={<Chart option={PIE_OPTION} />}
              unit="发电量"
              style={{ margin: 0, width: '144px' }}
            ></Card>
          </div>
          <div style={{ flex: 11, display: 'flex' }}>
            <div style={{ flex: 5 }}>
              <Chart option={Option}></Chart>
            </div>
            <div style={{ flex: 5 }}>
              <Chart option={LINE_OPTION}></Chart>
            </div>
            <div
              style={{
                flex: '0 0 138px',
                width: 160,
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
                <div style={{ color: '#e6f2f3', fontSize: 16 }}>节约标准煤</div>
                <div style={{ color: '#0ef9f2', fontSize: 24 }}>881,323.43</div>
              </div>
              <div
                style={{
                  flex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ color: '#e6f2f3', fontSize: 16 }}>CO2减排量</div>
                <div style={{ color: '#0ef9f2', fontSize: 24 }}>452,756.63</div>
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
          fontSize: 18,
          padding: '4px 16px',
          borderBottom: '1px solid #0d303a',
        }}
      >
        <span style={{ color: '#e6f2f3' }}>{title}</span>
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
    data: ['计划发电量', '实际发电量', '完成率'],
  },
  xAxis: [
    {
      type: 'category',
      data: ['5月', '6月', '7月', '8月', '9月', '10月', '11月'],
      axisPointer: {
        type: 'shadow',
      },
    },
  ],
  yAxis: [
    {
      type: 'value',
      name: '年发电量',
      min: 0,
      max: 1250,
      axisLabel: {
        formatter: '{value}',
      },
    },
    {
      type: 'value',
      name: '完成率',
      min: 60,
      max: 100,
      axisLabel: {
        formatter: '{value} %',
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
      data: [
        1112.0, 1224.9, 1117.0, 1123.2, 1025.6, 1176.7, 1135.6, 1162.2, 1132.6,
        1020.0, 1096.4, 1123.3,
      ],
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
      data: [
        1232.6, 1225.9, 1219.0, 1226.4, 1228.7, 1270.7, 1235.6, 1282.2, 1248.7,
        1218.8, 1206.0, 1202.3,
      ],
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
      data: [
        98.0, 92.2, 93.3, 94.5, 96.3, 90.2, 90.3, 93.4, 93.0, 96.5, 92.0, 96.2,
      ],
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
        { value: 88, name: '完成率', itemStyle: { color: '#13fcfc' } },
        { value: 12, name: '未完成率', itemStyle: { color: '#057c87' } },
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
