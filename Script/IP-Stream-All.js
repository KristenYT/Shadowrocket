/*
脚本修改自 @CyWr110 , @githubdulong
修改日期：2024.10.10 １
 ----------------------------------------
 */
const ipApiUrl = "http://ip-api.com/json"; // 用于获取IP的API
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
};

let args = getArgs();

(async () => {
    try {
        let now = new Date();
        let hour = now.getHours();
        let minutes = now.getMinutes();
        hour = hour > 9 ? hour : "0" + hour;
        minutes = minutes > 9 ? minutes : "0" + minutes;

        let panel_result = {
            title: `${args.title} | ${hour}:${minutes}` || `解鎖檢測 | ${hour}:${minutes}`,
            content: '',
            icon: args.icon || 'play.tv.fill',
            'icon-color': args.color || '#FF2D55',
        };

        let notification_content = '';  // 用于存储通知内容

        // 檢測 IP 和位置
        const ipData = await fetchData(ipApiUrl);
        const ipInfo = JSON.parse(ipData);
        const ipInfoText = `IP: ${ipInfo.query}\n位置: ${ipInfo.city}, ${ipInfo.country}\n`;
        notification_content += ipInfoText;  // 添加到通知内容
        panel_result.content += ipInfoText;  // 添加到面板内容

        // 檢測服務狀態
        const [{ region, status }] = await Promise.all([testDisneyPlus()]);
        const results = await Promise.all([check_chatgpt(), check_youtube_premium(), check_netflix()]);

        let disney_result = '';
        if (status == STATUS_COMING) {
            disney_result = 'Disney\u2009➟ \u2009≈ ' + region;
        } else if (status == STATUS_AVAILABLE) {
            disney_result = 'Disney\u2009➟ \u2611\u2009' + region;
        } else {
            disney_result = 'Disney\u2009➟ N/A';
        }

        results.push(disney_result);

        let youtube_netflix = [results[1], results[2]].join('\t|  ');
        let chatgpt_disney = [results[0], results[3]].join('\t|  ');

        let services_status = youtube_netflix + '\n' + chatgpt_disney;
        notification_content += services_status;  // 添加到通知内容
        panel_result['content'] += services_status;  // 添加到面板内容

        // 發送包含 IP 和檢測結果的推送通知
        $notification.post("檢測結果", "", notification_content);
        $done(panel_result);
    } catch (error) {
        // 捕获所有错误并通知
        $notification.post("脚本运行失败", error.toString());
        $done();
    }
})();

function fetchData(url) {
    return new Promise((resolve, reject) => {
        $httpClient.get({
            url: url,
            headers: REQUEST_HEADERS,
        }, function (error, response, data) {
            if (error || response.status !== 200) {
                reject(error || '请求失败');
            } else {
                resolve(data);
            }
        });
    });
}

function getArgs() {
    return Object.fromEntries(
        $argument.split("&").map(item => item.split("=")).map(([k, v]) => [k, decodeURIComponent(v)])
    );
}


// 檢測 ChatGPT
async function check_chatgpt() {
  let inner_check = () => {
    return new Promise((resolve, reject) => {
      let option = {
        url: 'http://chat.openai.com/cdn-cgi/trace',
        headers: REQUEST_HEADERS,
      }
      $httpClient.get(option, function(error, response, data) {
        if (error != null || response.status !== 200) {
          reject('Error')
          return
        }

        let lines = data.split("\n");
        let cf = lines.reduce((acc, line) => {
          let [key, value] = line.split("=");
          acc[key] = value;
          return acc;
        }, {});

        let country_code = cf.loc;
        let restricted_countries = ['HK', 'RU', 'CN', 'KP', 'CU', 'IR', 'SY'];
        if (restricted_countries.includes(country_code)) {
          resolve('Not Available')
        } else {
          resolve(country_code.toUpperCase())
        }
      })
    })
  }

  let check_result = 'ChatGPT\u2009➟ ';

  await inner_check()
    .then((code) => {
      if (code === 'Not Available') {
        check_result += '\u2612  \u2009'
      } else {
        check_result += '\u2611\u2009' + code
      }
    })
    .catch((error) => {
      check_result += 'N/A '
    })

  return check_result
}

// 檢測 YouTube Premium
async function check_youtube_premium() {
    let inner_check = () => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://www.youtube.com/premium',
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function (error, response, data) {
                if (error != null || response.status !== 200) {
                    reject('Error')
                    return
                }

                if (data.indexOf('Premium is not available in your country') !== -1) {
                    resolve('Not Available')
                    return
                }

                let region = ''
                let re = new RegExp('"countryCode":"(.*?)"', 'gm')
                let result = re.exec(data)
                if (result != null && result.length === 2) {
                    region = result[1].toUpperCase()
                } else if (data.indexOf('www.google.cn') !== -1) {
                    region = 'CN'
                } else {
                    region = 'US'
                }
                resolve(region) 
            })
        })
    }

    let youtube_check_result = 'YouTube ➟ '

    await inner_check()
        .then((code) => {
        if (code === 'Not Available') {
            youtube_check_result += '\u2612     \u2009'
        } else {
            youtube_check_result += '\u2611\u2009' + code
        }
    })
        .catch((error) => {
        youtube_check_result += '\u2009N/A '
    })

    return youtube_check_result
}

// 檢測 Netflix
async function check_netflix() {
    let inner_check = (filmId) => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://www.netflix.com/title/' + filmId,
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function (error, response, data) {
                if (error != null) {
                    reject('Error')
                    return
                }

                if (response.status === 403) {
                    reject('Not Available')
                    return
                }

                if (response.status === 404) {
                    resolve('Not Found')
                    return
                }

                if (response.status === 200) {
                    let url = response.headers['x-originating-url']
                    let region = url.split('/')[3]
                    region = region.split('-')[0]
                    if (region == 'title') {
                        region = 'US'
                    }
                    if (region != null) {
                        region = region.toUpperCase()
                    }
                    resolve(region) 
                    return
                }

                reject('Error')
            })
        })
    }

    let netflix_check_result = 'Netflix ➟ '

    await inner_check(81280792)
        .then((code) => {
        if (code === 'Not Found') {
            return inner_check(80018499)
        }
        netflix_check_result += '\u2611\u2009' + code
        return Promise.reject('BreakSignal')
    })
        .then((code) => {
        if (code === 'Not Found') {
            return Promise.reject('Not Available')
        }

        netflix_check_result += '⚠\u2009' + code
        return Promise.reject('BreakSignal')
    })
        .catch((error) => {
        if (error === 'BreakSignal') {
            return
        }
        if (error === 'Not Available') {
            netflix_check_result += '\u2612'
            return
        }
        netflix_check_result += 'N/A'
    })

    return netflix_check_result
}

// 檢測 Disney+
async function testDisneyPlus() {
    try {
        let {region, cnbl} = await Promise.race([testHomePage(), timeout(7000)])

        let { countryCode, inSupportedLocation } = await Promise.race([getLocationInfo(), timeout(7000)])

        region = countryCode ?? region

        if (region != null) {
            region = region.toUpperCase()
        }

        // 即將登陸
        if (inSupportedLocation === false || inSupportedLocation === 'false') {
            return {region, status: STATUS_COMING}
        } else {
            return {region, status: STATUS_AVAILABLE}
        }

    } catch (error) {
        if (error === 'Not Available') {
            return {status: STATUS_NOT_AVAILABLE}
        }

        if (error === 'Timeout') {
            return {status: STATUS_TIMEOUT}
        }

        return {status: STATUS_ERROR}
    }

}

function getLocationInfo() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
            headers: {
                'Accept-Language': 'en',
                Authorization: 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
                'Content-Type': 'application/json',
                'User-Agent': UA,
            },
            body: JSON.stringify({
                query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
                variables: {
                    input: {
                        applicationRuntime: 'chrome',
                        attributes: {
                            browserName: 'chrome',
                            browserVersion: '94.0.4606',
                            manufacturer: 'apple',
                            model: null,
                            operatingSystem: 'macintosh',
                            operatingSystemVersion: '10.15.7',
                            osDeviceIds: [],
                        },
                        deviceFamily: 'browser',
                        deviceLanguage: 'en',
                        deviceProfile: 'macosx',
                    },
                },
            }),
        }

        $httpClient.post(opts, function (error, response, data) {
            if (error) {
                reject('Error')
                return
            }

            if (response.status !== 200) {
                reject('Not Available')
                return
            }

            data = JSON.parse(data)
            if(data?.errors){
                reject('Not Available')
                return
            }

            let {
                token: {accessToken},
                session: {
                    inSupportedLocation,
                    location: {countryCode},
                },
            } = data?.extensions?.sdk
            resolve({inSupportedLocation, countryCode, accessToken})
        })
    })
}

function testHomePage() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://www.disneyplus.com/',
            headers: {
                'Accept-Language': 'en',
                'User-Agent': UA,
            },
        }

        $httpClient.get(opts, function (error, response, data) {
            if (error) {
                reject('Error')
                return
            }
            if (response.status !== 200 || data.indexOf('Sorry, Disney+ is not available in your region.') !== -1) {
                reject('Not Available')
                return
            }

            let match = data.match(/Region: ([A-Za-z]{2})[\s\S]*?CNBL: ([12])/)
            if (!match) {
                resolve({region: '', cnbl: ''})
                return
            }

            let region = match[1]
            let cnbl = match[2]
            resolve({region, cnbl})
        })
    })
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject('Timeout')
        }, delay)
    })
}

function getIcon(code, icons) {
    if (code != null && code.length === 2){
        for (let i = 0; i < icons.length; i++) {
            if (icons[i][0] === code) {
                return icons[i][1] + code
            }
        }
    }
    return code
}=