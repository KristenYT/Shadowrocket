/*
脚本修改自 @CyWr110 , @githubdulong
修改日期：2024.10.16
 ---------------------------------------
 */
const REQUEST_HEADERS = { 
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
};

const STATUS_COMING = 2; // 即將登陸
const STATUS_AVAILABLE = 1; // 支持解鎖
const STATUS_NOT_AVAILABLE = 0; // 不支持解鎖
const STATUS_TIMEOUT = -1; // 檢測超時
const STATUS_ERROR = -2; // 檢測異常

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';
const ipApiUrl = "https://ipinfo.io/json"; // IP获取API

let args = getArgs();

(async () => {
    let now = new Date();
    let hour = now.getHours();
    let minutes = now.getMinutes();
    hour = hour > 9 ? hour : "0" + hour;
    minutes = minutes > 9 ? minutes : "0" + minutes;

    // Initialize the panel with the current time
    let panel_result = {
        title: `${args.title} | ${hour}:${minutes}` || `解鎖檢測 | ${hour}:${minutes}`,
        content: '',
        icon: args.icon || 'play.tv.fill',
        'icon-color': args.color || '#FF2D55',
    };

    let notificationContent = "";

    // Fetch IP information and add it to the panel
    try {
        const ipData = await fetchData(ipApiUrl);
        const ipInfo = JSON.parse(ipData);
        const ipAddress = `IP: ${ipInfo.ip}  📍: ${ipInfo.region}, ${ipInfo.country}`;
        panel_result.content = `${ipAddress}\n`; // Add IP to the first line of the panel content
        notificationContent += `IP: ${ipInfo.ip}  📍: ${ipInfo.city}, ${ipInfo.country}\n`; // Add IP info to notification content
    } catch (error) {
        panel_result.content = "IP: N/A\n"; // Handle errors if IP can't be fetched
        notificationContent += "IP: N/A\n";
    }

    // Simultaneously check multiple services
    let [{ region, status }] = await Promise.all([testDisneyPlus()]);
    await Promise.all([check_chatgpt(), check_youtube_premium(), check_netflix()])
        .then((result) => {
            let disney_result = getServiceStatus(status, region, "Disney");
            result.push(disney_result);

            let youtube_netflix = [result[1], result[2]].join('  \t|  ');
            let chatgpt_disney = [result[0], result[3]].join('  \t|  ');

            // Update panel content with the service status results
            panel_result.content += youtube_netflix + '\n' + chatgpt_disney;

            // Add unlock results to the notification content
            notificationContent += `${youtube_netflix}\n`;
            notificationContent += `${chatgpt_disney}`;
        })
        .finally(() => {
            // Push notification with all results
            $notification.post(`检测完成  |  ${hour}:${minutes}`, "", notificationContent);
            $done(panel_result); // Display the final panel result
        });
})();

// Helper function to process the unlock status for each service
function getServiceStatus(status, region, serviceName) {
    if (status == STATUS_COMING) {
        return `${serviceName} ➟ 🔜\u2009${region}`;
    } else if (status == STATUS_AVAILABLE) {
        return `${serviceName} ➟ ✅\u2009${region}`;
    } else if (status == STATUS_NOT_AVAILABLE) {
        return `${serviceName} ➟ ❌`;
    } else if (status == STATUS_TIMEOUT) {
        return `${serviceName} ➟ N/A`;
    } else {
        return `${serviceName} ➟ N/A`;
    }
}

// Fetch data from a given URL
function fetchData(url) {
    return new Promise((resolve, reject) => {
        $httpClient.get({ url, headers: REQUEST_HEADERS }, (error, response, data) => {
            if (error || response.status !== 200) {
                reject(error || '请求失败');
            } else {
                resolve(data);
            }
        });
    });
}

// ... [Keep your existing service check functions for ChatGPT, YouTube, Netflix, Disney+ here]

function getArgs() {
    return Object.fromEntries(
        $argument.split("&").map(item => item.split("=")).map(([k, v]) => [k, decodeURIComponent(v)])
    );
}

// 檢測 ChatGPT
async function check_chatgpt() {
  let check_result = 'ChatGPT\u2009➟ '; // 初始化結果變量

  // 檢查網頁訪問
  let inner_check_web = () => {
    return new Promise((resolve, reject) => {
      let option = {
        url: 'http://chat.openai.com/cdn-cgi/trace',
        headers: REQUEST_HEADERS,
      };
      $httpClient.get(option, function(error, response, data) {
        if (error != null || response.status !== 200) {
          reject('Error'); // 無法檢測或超時
          return;
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
          resolve({ status: '❌', region: null }); // 網頁無法訪問
        } else {
          resolve({ status: '✅', region: country_code.toUpperCase() }); // 網頁可訪問，返回地區代碼
        }
      });
    });
  };

  // 檢查 Android 訪問
  let check_android_chatgpt = () => {
    return new Promise((resolve, reject) => {
      let option = {
        url: 'https://android.chat.openai.com',
        headers: REQUEST_HEADERS,
      };
      $httpClient.get(option, function(error, response, data) {
        if (error != null || response.status !== 200) {
          reject('Error'); // 無法檢測或超時
          return;
        }
        if (data.includes('Request')) {
          resolve('✅'); // Android 可訪問
        } else if (data.includes('VPN')) {
          resolve('⚠️'); // Android 可能有限制，需要 VPN
        } else {
          resolve('❌'); // Android 無法訪問
        }
      });
    });
  };

  try {
    // 並行檢查網頁和 Android 訪問
    let [web_result, android_result] = await Promise.all([inner_check_web(), check_android_chatgpt()]);

    if (web_result.status === '✅' && android_result === '✅') {
      check_result += '✅ ' + web_result.region; // 網頁和 Android 都可訪問
    } else if (web_result.status === '✅' && android_result === '⚠️') {
      check_result += '⚠️ ' + web_result.region; // 只有網頁可訪問
    } else if (web_result.status === '❌' && android_result === '❌') {
      check_result += '❌'; // 兩者都無法訪問
    } else {
      check_result += 'N/A'; // 無法檢測或超時
    }
  } catch (error) {
    check_result += 'N/A'; // 捕捉錯誤或超時情況
  }

  return check_result;
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
            youtube_check_result += '❌     \u2009'
        } else {
            youtube_check_result += '✅\u2009' + code
        }
    })
        .catch((error) => {
        youtube_check_result += '\u2009N/A   '
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
        netflix_check_result += '✅\u2009' + code
        return Promise.reject('BreakSignal')
    })
        .then((code) => {
        if (code === 'Not Found') {
            return Promise.reject('Not Available')
        }

        netflix_check_result += '⚠️\u2009' + code
        return Promise.reject('BreakSignal')
    })
        .catch((error) => {
        if (error === 'BreakSignal') {
            return
        }
        if (error === 'Not Available') {
            netflix_check_result += '❌'
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
}
