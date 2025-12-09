export const electric = {
    "code": "00000",
    "msg": "成功",
    "data": {
        "cli": {
            "dps": {
                "Model": {
                    "ens": {
                        "hgIndex": {
                            "id": "hgIndex",
                            "name": "发电量实体",
                            "pname": "",
                            "level": 0,
                            "type": "Any",
                            "deviceTypeId": 0,
                            "protocolId": 0,
                            "devicesAmount": 0,
                            "phaseCount": 0,
                            "firstRunStatArr": [],
                            "thirdRunStatArr": [],
                            "standardWtSignStatus": false,
                            "isaccess": 0,
                            "wfMonitorShowMap": false,
                            "proxyPort": 0,
                            "sort": 0,
                            "deviceOrderNum": 0,
                            "resetisview": false,
                            "active": false,
                            "standardWt": false,
                            "antiVortexFlag": false,
                            "locking": false,
                            "multipleAgcOrEms": false
                        }
                    },
                    "dis": {
                        "hg_any_PlannedPower": {
                            "id": "hg_any_PlannedPower",
                            "name": "计划发电量",
                            "show": true,
                            "pathId": "plannedPower",
                            "unit": "万kWh",
                            "max": "0.0",
                            "min": "0.0",
                            "place": "2",
                            "packageVO": null,
                            "type": "System.Decimal",
                            "coeff": "0.0001",
                            "toThousand": false,
                            "url": null,
                            "staType": "month",
                            "customAnalysis": false,
                            "remoteSignaling": false,
                            "needToExplain": false,
                            "dataType": "float",
                            "dataflag": null,
                            "sn": "计划发电量",
                            "sort": null,
                            "protocolId": 0,
                            "range": null,
                            "visualIsEnable": false,
                            "visualIsDeleted": false,
                            "visualIecType": null,
                            "visualExpress": null,
                            "visualModifyUserName": null,
                            "visualModifyTime": null,
                            "iecType": 0,
                            "originalIecType": null,
                            "transtype": 0,
                            "trgop": null,
                            "trueValueDesc": null,
                            "falsedValueDesc": null,
                            "visible": true,
                            "advancedControl": false,
                            "visualIec": false
                        },
                        "hg_any_ActualPower": {
                            "id": "hg_any_ActualPower",
                            "name": "实际发电量",
                            "show": true,
                            "pathId": "actualPower",
                            "unit": "万kWh",
                            "max": "0.0",
                            "min": "0.0",
                            "place": "2",
                            "packageVO": null,
                            "type": "System.Decimal",
                            "coeff": "0.0001",
                            "toThousand": false,
                            "url": null,
                            "staType": "month",
                            "customAnalysis": false,
                            "remoteSignaling": false,
                            "needToExplain": false,
                            "dataType": "float",
                            "dataflag": null,
                            "sn": "实际发电量",
                            "sort": null,
                            "protocolId": 0,
                            "range": null,
                            "visualIsEnable": false,
                            "visualIsDeleted": false,
                            "visualIecType": null,
                            "visualExpress": null,
                            "visualModifyUserName": null,
                            "visualModifyTime": null,
                            "iecType": 0,
                            "originalIecType": null,
                            "transtype": 0,
                            "trgop": null,
                            "trueValueDesc": null,
                            "falsedValueDesc": null,
                            "visible": true,
                            "advancedControl": false,
                            "visualIec": false
                        },
                        "hg_any_PowerRate": {
                            "id": "hg_any_PowerRate",
                            "name": "完成率",
                            "show": true,
                            "pathId": "powerRate",
                            "unit": "%",
                            "max": "0.0",
                            "min": "0.0",
                            "place": "2",
                            "packageVO": null,
                            "type": "System.Decimal",
                            "coeff": "1",
                            "toThousand": false,
                            "url": null,
                            "staType": "month",
                            "customAnalysis": false,
                            "remoteSignaling": false,
                            "needToExplain": false,
                            "dataType": "float",
                            "dataflag": null,
                            "sn": "完成率",
                            "sort": null,
                            "protocolId": 0,
                            "range": null,
                            "visualIsEnable": false,
                            "visualIsDeleted": false,
                            "visualIecType": null,
                            "visualExpress": null,
                            "visualModifyUserName": null,
                            "visualModifyTime": null,
                            "iecType": 0,
                            "originalIecType": null,
                            "transtype": 0,
                            "trgop": null,
                            "trueValueDesc": null,
                            "falsedValueDesc": null,
                            "visible": true,
                            "advancedControl": false,
                            "visualIec": false
                        }
                    },
                    "dps": {
                        "hgIndex": {
                            "show": [
                                "hg_any_PlannedPower",
                                "hg_any_ActualPower",
                                "hg_any_PowerRate"
                            ],
                            "hide": []
                        }
                    },
                    "pels": {},
                    "enids": [
                        "hgIndex"
                    ],
                    "disIds": [
                        "hg_any_PlannedPower",
                        "hg_any_ActualPower",
                        "hg_any_PowerRate"
                    ],
                    "prs": {},
                    "svg": "<svg>\n    <g EntType=\"Any\" RelaDatas=\"snBigScreenPowerHG\" show=\"true\"/>\n</svg>",
                    "resource": {},
                    "data": [
                        {
                            "hg_any_PlannedPower": 712428957.24,
                            "month": "1",
                            "year": 2025,
                            "hg_any_ActualPower": 637993063.88,
                            "hg_any_PowerRate": "89.5518"
                        },
                        {
                            "hg_any_PlannedPower": 731064740.45,
                            "month": "2",
                            "year": 2025,
                            "hg_any_ActualPower": 575944712.94,
                            "hg_any_PowerRate": "78.7816"
                        },
                        {
                            "hg_any_PlannedPower": 784211078.82,
                            "month": "3",
                            "year": 2025,
                            "hg_any_ActualPower": 805551492.01,
                            "hg_any_PowerRate": "102.7213"
                        },
                        {
                            "hg_any_PlannedPower": 739321977.49,
                            "month": "4",
                            "year": 2025,
                            "hg_any_ActualPower": 780818236.68,
                            "hg_any_PowerRate": "105.6127"
                        },
                        {
                            "hg_any_PlannedPower": 739625845.87,
                            "month": "5",
                            "year": 2025,
                            "hg_any_ActualPower": 702876564.07,
                            "hg_any_PowerRate": "95.0314"
                        },
                        {
                            "hg_any_PlannedPower": 656211053.04,
                            "month": "6",
                            "year": 2025,
                            "hg_any_ActualPower": 605060161.24,
                            "hg_any_PowerRate": "92.2051"
                        },
                        {
                            "hg_any_PlannedPower": 753698604.89,
                            "month": "7",
                            "year": 2025,
                            "hg_any_ActualPower": 766790937.51,
                            "hg_any_PowerRate": "101.7371"
                        },
                        {
                            "hg_any_PlannedPower": 655503861.11,
                            "month": "8",
                            "year": 2025,
                            "hg_any_ActualPower": 635409610.72,
                            "hg_any_PowerRate": "96.9345"
                        },
                        {
                            "hg_any_PlannedPower": 747039009.06,
                            "month": "9",
                            "year": 2025,
                            "hg_any_ActualPower": 515079616.26,
                            "hg_any_PowerRate": "68.9495"
                        },
                        {
                            "hg_any_PlannedPower": 742909126.61,
                            "month": "10",
                            "year": 2025,
                            "hg_any_ActualPower": 556088226.62,
                            "hg_any_PowerRate": "74.8528"
                        },
                        {
                            "hg_any_PlannedPower": 669024586.76,
                            "month": "11",
                            "year": 2025,
                            "hg_any_ActualPower": 638423275.45,
                            "hg_any_PowerRate": "95.4260"
                        },
                        {
                            "hg_any_PlannedPower": 654365480.66,
                            "month": "12",
                            "year": 2025,
                            "hg_any_ActualPower": 179284178.617,
                            "hg_any_PowerRate": "27.3982"
                        }
                    ],
                    "result": 0,
                    "disOrder": [
                        "hg_any_PlannedPower",
                        "hg_any_ActualPower",
                        "hg_any_PowerRate"
                    ],
                    "enableSphmAlarmInfo": false,
                    "flickerSwitch": false,
                    "allStopWordCodeList": [],
                    "photovoltaicActiveControlIsOpen": false,
                    "pwrReactAutoControlIsOpen": false,
                    "runbackIsOpen": false,
                    "standardWTSignInSingOutIsOpen": false,
                    "virtualSecurityColumn": false,
                    "PwrReactAutoControlIsOpen": false,
                    "StandardWTSignInSingOutIsOpen": false,
                    "VirtualSecurityColumn": false,
                    "UserConfig": {}
                }
            }
        }
    },
    "init": "1",
    "time": "2025-12-09 18:10:34 GMT+08:00",
    "info": null,
    "tz": 0,
    "externalData": null,
    "detailMsg": null,
    "traceId": null,
    "success": true
}