from flask import Flask, jsonify
import requests

app = Flask(__name__)

@app.route('/proxy/monitor/data', methods=['get'])
def proxy_monitor_data():
    url = "https://fgc.shenergy.net.cn/portal/monitor/data"
    data = "mdid=Model&Model_ScId=_snBigScreenMagIndexHG&Model_EnId=00_all&Model_EnKey=SNBigScreenModel&Model_PkId=&ModelKey=undefined&Model_dhs=UISys&Model_layout=1&systemKey=soam&Model_userConfig=&Model_otherMonitor=false&crossDomain=false&Zip=false"
    
    response = requests.post(url, 
        headers={"content-type": "application/x-www-form-urlencoded"},
        data=data
    )
    return jsonify(response.json())

if __name__ == '__main__':
    app.run()