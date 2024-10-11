/*
脚本修改自 @CyWr110 , @githubdulong
修改日期：2024.10.10
 ----------------------------------------
 */


const REQUEST_HEADERS = { 
    'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
};

const ipApiUrl = "https://ipinfo.io/json"; // 用于获取IP信息的API

// 即將登陸
const STATUS_COMING = 2;
// 支持解鎖
const STATUS_AVAILABLE = 1;
// 不支持解鎖
const STATUS_NOT_AVAILABLE = 0;
// 檢測超時
const STATUS_TIMEOUT = -1;
// 檢測異常
const STATUS_ERROR = -2;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36';

let args = getArgs();

(async () => {
    let now = new Date();
    let hour = now.getHours();
    let minutes = now.getMinutes();
    hour = hour > 9 ? hour : "0" + hour;
    minutes = minutes > 9 ? minutes : "0" + minutes;

    // 获取IP信息
    let ipData = await fetchIPInfo();
    let ipInfo = JSON.parse(ipData);
    let ipContent = `IP: ${ipInfo.ip} 📍: ${ipInfo.city}, ${ipInfo.country}`;

    // 根據傳入的參數設置面板標題和圖標
    let panel_result = {
        title: `${args.title} | ${hour}:${minutes}` || `解鎖檢測 | ${hour}:${minutes}`,
        content: ipContent + "\n", // 将IP信息显示在面板的首行
        icon: args.icon || 'play.tv.fill',
        'icon-color': args.color || '#FF2D55',
    };

    // 同時檢測多個服務
    let disneyResult = await testDisneyPlus();
    let chatgptResult = await check_chatgpt();
    let youtubeResult = await check_youtube_premium();
    let netflixResult = await check_netflix();

    // 整理结果
    let disney_result = formatDisneyResult(disneyResult);
    let youtube_netflix = [youtubeResult, netflixResult].join(' | ');
    let chatgpt_disney = [chatgptResult, disney_result].join(' | ');

    // 更新面板内容
    panel_result['content'] += youtube_netflix + '\n' + chatgpt_disney;

    // 发送推送通知
    $notification.post(panel_result.title, "", panel_result.content);

    // 结束并输出到面板
    $done(panel_result);
})();

// 获取 IP 信息
async function fetchIPInfo() {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url: ipApiUrl, headers: REQUEST_HEADERS }, function (error, response, data) {
      if (error || response.status !== 200) {
        console.log(`IP 请求失败: ${error}, 状态码: ${response ? response.status : '无响应'}`);
        reject(error || '请求失败');
      } else {
        try {
          resolve(data);
        } catch (e) {
          console.log("IP 信息解析失败");
          reject("IP 信息解析失败");
        }
      }
    });
  });
}

// 格式化 Disney+ 检测结果
function formatDisneyResult(disneyResult) {
    if (disneyResult.status === STATUS_COMING) {
        return `Disney ➟ ≈ ${disneyResult.region}`;
    } else if (disneyResult.status === STATUS_AVAILABLE) {
        return `Disney ➟ ☑ ${disneyResult.region}`;
    } else if (disneyResult.status === STATUS_NOT_AVAILABLE) {
        return `Disney ➟ ❌`;
    } else {
        return `Disney ➟ N/A`;
    }
}

// 其他检测功能保持不变...
async function check_chatgpt() {
  // ChatGPT 检测逻辑保持不变
  let check_result = 'ChatGPT ➟ ';

  await inner_check()
    .then((code) => {
      if (code === 'Not Available') {
        check_result += '❌  ';
      } else {
        check_result += `☑ ${code}`;
      }
    })
    .catch(() => {
      check_result += 'N/A ';
    });

  return check_result;
}

// 檢測 YouTube Premium
async function check_youtube_premium() {
  // YouTube 检测逻辑保持不变
  let youtube_check_result = 'YouTube ➟ ';

  await inner_check()
    .then((code) => {
      if (code === 'Not Available') {
        youtube_check_result += '❌  ';
      } else {
        youtube_check_result += `☑ ${code}`;
      }
    })
    .catch(() => {
      youtube_check_result += 'N/A ';
    });

  return youtube_check_result;
}

// 檢測 Netflix
async function check_netflix() {
  // Netflix 检测逻辑保持不变
  let netflix_check_result = 'Netflix ➟ ';

  await inner_check(81280792)
    .then((code) => {
      if (code === 'Not Found') {
        return inner_check(80018499);
      }
      netflix_check_result += `☑ ${code}`;
      return Promise.reject('BreakSignal');
    })
    .then((code) => {
      if (code === 'Not Found') {
        return Promise.reject('Not Available');
      }
      netflix_check_result += `⚠ ${code}`;
      return Promise.reject('BreakSignal');
    })
    .catch((error) => {
      if (error === 'BreakSignal') return;
      netflix_check_result += (error === 'Not Available') ? '❌' : 'N/A';
    });

  return netflix_check_result;
}

// 檢測 Disney+
async function testDisneyPlus() {
  try {
    let { region, cnbl } = await testHomePage();
    let { countryCode, inSupportedLocation } = await getLocationInfo();

    region = countryCode ?? region;

    // 即將登陸
    if (inSupportedLocation === false) {
      return { region, status: STATUS_COMING };
    } else {
      return { region, status: STATUS_AVAILABLE };
    }
  } catch (error) {
    return { status: STATUS_NOT_AVAILABLE };
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
