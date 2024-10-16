/*
脚本修改自 @CyWr110 , @githubdulong
修改日期：2024.10.16
 ---------------------------------------
 */
const REQUEST_HEADERS = { 
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
    'Accept': '*/*', // 添加 Accept 頭
    'Referer': 'https://chat.openai.com/', // 添加 Referer 頭
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
        console.error("IP Fetch Error:", error);
    }

    // Simultaneously check multiple services
    try {
        const disneyPromise = testDisneyPlus();
        const chatgptPromise = check_chatgpt();
        const youtubePromise = check_youtube_premium();
        const netflixPromise = check_netflix();

        const [disneyResult, chatgptResult, youtubeResult, netflixResult] = await Promise.all([
            disneyPromise.catch(error => error), 
            chatgptPromise.catch(error => error), 
            youtubePromise.catch(error => error), 
            netflixPromise.catch(error => error)
        ]);

        // Process Disney+ result
        let disneyStatus = STATUS_ERROR;
        let disneyRegion = '';
        if (typeof disneyResult === 'object' && disneyResult !== null) {
            disneyStatus = disneyResult.status;
            disneyRegion = disneyResult.region || '';
        }

        let disney_output = getServiceStatus(disneyStatus, disneyRegion, "Disney");

        // Process其他服務結果
        let youtube_netflix = `${youtubeResult}  \t|  ${netflixResult}`;
        let chatgpt_disney = `${chatgptResult}  \t|  ${disney_output}`;

        // Update panel content with the service status results
        panel_result.content += `${youtube_netflix}\n${chatgpt_disney}`;

        // Add unlock results to the notification content
        notificationContent += `${youtube_netflix}\n${chatgpt_disney}`;
    } catch (error) {
        console.error("Service Check Error:", error);
    } finally {
        // Push notification with all results
        $notification.post(`检测完成  |  ${hour}:${minutes}`, "", notificationContent);
        $done(panel_result); // Display the final panel result
    }
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
    let inner_check_web = () => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://chat.openai.com/cdn-cgi/trace', // 修改為 https
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function(error, response, data) {
                if (error != null || response.status !== 200) {
                    reject('Error in check_chatgpt - Web Check');
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
                    resolve({ status: 'Not Available', region: '' });
                } else {
                    resolve({ status: 'Available', region: country_code.toUpperCase() });
                }
            });
        });
    }

    let inner_check_android = () => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://android.chat.openai.com',
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function(error, response, data) {
                if (error != null || response.status !== 200) {
                    reject('Error in check_chatgpt - Android Check');
                    return;
                }

                if (data.includes("Request")) {
                    resolve('Client Available');
                } else if (data.includes("VPN")) {
                    resolve('Client Not Available');
                } else {
                    resolve('Client Unknown');
                }
            });
        });
    }

    let check_result = 'ChatGPT\u2009➟ ';

    try {
        const [webResult, androidResult] = await Promise.all([inner_check_web(), inner_check_android()]);
        console.log("ChatGPT Web Result:", webResult);
        console.log("ChatGPT Android Result:", androidResult);

        // 根据检测结果生成最终返回内容
        if (webResult.status === 'Available' && androidResult === 'Client Available') {
            check_result += `✅\u2009${webResult.region}`;
        } else if (webResult.status === 'Available' && androidResult === 'Client Not Available') {
            check_result += `⚠️\u2009${webResult.region}`;
        } else {
            check_result += '❌';
        }
    } catch (error) {
        console.error("check_chatgpt Error:", error);
        check_result += 'N/A';
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
                    reject('Error in check_youtube_premium');
                    return;
                }

                if (data.indexOf('Premium is not available in your country') !== -1) {
                    resolve('❌');
                    return;
                }

                let region = ''
                let re = /"countryCode":"(.*?)"/gm;
                let result = re.exec(data)
                if (result != null && result.length === 2) {
                    region = result[1].toUpperCase()
                } else if (data.indexOf('www.google.cn') !== -1) {
                    region = 'CN'
                } else {
                    region = 'US'
                }
                resolve(`✅\u2009${region}`);
            })
        })
    }

    let youtube_check_result = 'YouTube ➟ '

    try {
        const code = await inner_check();
        youtube_check_result += code;
    } catch (error) {
        console.error("check_youtube_premium Error:", error);
        youtube_check_result += '❌';
    }

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
                    reject('Error in check_netflix');
                    return;
                }

                if (response.status === 403) {
                    reject('❌');
                    return;
                }

                if (response.status === 404) {
                    resolve('Not Found');
                    return;
                }

                if (response.status === 200) {
                    let url = response.headers['x-originating-url'] || '';
                    let region = '';
                    if (url) {
                        let parts = url.split('/');
                        if (parts.length > 3) {
                            region = parts[3].split('-')[0].toUpperCase();
                            if (region === 'TITLE') {
                                region = 'US';
                            }
                        }
                    }
                    resolve(`✅\u2009${region}`);
                    return;
                }

                reject('❌');
            })
        })
    }

    let netflix_check_result = 'Netflix ➟ '

    try {
        let code1 = await inner_check(81280792);
        if (code1 === 'Not Found') {
            let code2 = await inner_check(80018499);
            if (code2 === 'Not Found') {
                netflix_check_result += '❌';
            } else {
                netflix_check_result += `⚠️\u2009${code2}`;
            }
        } else {
            netflix_check_result += code1;
        }
    } catch (error) {
        console.error("check_netflix Error:", error);
        if (error === '❌') {
            netflix_check_result += '❌';
        } else {
            netflix_check_result += 'N/A';
        }
    }

    return netflix_check_result
}

// 檢測 Disney+
async function testDisneyPlus() {
    try {
        let disneyHomePage = await Promise.race([testHomePage(), timeout(7000)]);
        let locationInfo = await Promise.race([getLocationInfo(), timeout(7000)]);

        let region = locationInfo.countryCode || disneyHomePage.region;

        if (region != null) {
            region = region.toUpperCase();
        }

        // 即將登陸
        if (locationInfo.inSupportedLocation === false || locationInfo.inSupportedLocation === 'false') {
            return {region, status: STATUS_COMING};
        } else {
            return {region, status: STATUS_AVAILABLE};
        }

    } catch (error) {
        console.error("testDisneyPlus Error:", error);
        if (error === 'Not Available') {
            return {status: STATUS_NOT_AVAILABLE};
        }

        if (error === 'Timeout') {
            return {status: STATUS_TIMEOUT};
        }

        return {status: STATUS_ERROR};
    }
}

function getLocationInfo() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
            headers: {
                'Accept-Language': 'en',
                Authorization: 'Bearer YOUR_VALID_TOKEN_HERE', // 建議使用有效的 Bearer Token
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
                        deviceLanguage: