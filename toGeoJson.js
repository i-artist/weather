// const fs = require('fs');
// const xlsx = require('xlsx');
import fs from 'fs';
import xlsx from 'xlsx';

// 读取Excel文件并转换为GeoJSON格式
function convertXLSXToGeoJSON(inputFile, outputFile) {
  // 读取Excel文件
  const workbook = xlsx.readFile(inputFile);
  const sheetName = workbook.SheetNames[0]; // 假设数据在第一个工作表中
  const sheet = workbook.Sheets[sheetName];

  // 将Excel数据转换为JSON格式
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // 处理表头 (假设第一行是表头)
  const headers = data[0];

  // 初始化GeoJSON的features数组
  const features = [];

  // 遍历数据 (从第二行开始)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 获取每一列的值，假设列的顺序与表头匹配
    const wfname = row[0];
    const wfinvestname = row[1];
    const wtcount = parseInt(row[2], 10);
    const wfdalias = row[3];
    const wfadress = row[4];
    const longitude = parseFloat(row[5]);
    const latitude = parseFloat(row[6]);

    // 创建GeoJSON的Feature对象
    const feature = {
      type: 'Feature',
      properties: {
        wfname: wfname,
        wfinvestname: wfinvestname,
        wtcount: wtcount,
        wfdalias: wfdalias,
        wfadress: wfadress,
      },
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    };

    // 将Feature添加到features数组中
    features.push(feature);
  }

  // 创建GeoJSON对象
  const geoJSON = {
    type: 'FeatureCollection',
    features: features,
  };

  // 将生成的GeoJSON写入文件
  fs.writeFileSync(outputFile, JSON.stringify(geoJSON, null, 2), 'utf8');
  console.log('GeoJSON data has been written to ' + outputFile);
}

// 调用转换函数
convertXLSXToGeoJSON('坐标.xls', 'public/marker.json');
