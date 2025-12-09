fetch('https://fgc.shenergy.net.cn/portal/monitor/data', {
  headers: {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    pragma: 'no-cache',
    'sec-ch-ua':
      '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-requested-with': 'XMLHttpRequest',
  },
  referrer:
    'https://fgc.shenergy.net.cn/?withoutLoginIndex=1&indexPageIdentifier=caseShshennengBigScreen',
  body: 'mdid=Model&Model_ScId=_snBigScreenMagIndexHG&Model_EnId=00_all&Model_EnKey=SNBigScreenModel&Model_PkId=&ModelKey=undefined&Model_dhs=UISys&Model_layout=1&systemKey=soam&Model_userConfig=&Model_otherMonitor=false&crossDomain=false&Zip=false',
  method: 'POST',
  mode: 'cors',
  credentials: 'include',
})
  .then((res) => res.json())
  .then((res) => console.log(res));
