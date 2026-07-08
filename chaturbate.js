const appConfig = {
    name: "Chaturbate",
    site: "https://zh.chaturbate.com"
};

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

function jsonify(s) { return JSON.stringify(s); }
function argsify(s) { return JSON.parse(s); }

/**
 * 获取基础配置
 * 直接使用官方的隐藏分类 API
 */
async function getConfig() {
    const config = {
        tabs: [
            { name: "热门直播", ext: { api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&wm=97bL6` } },
            { name: "女性主播", ext: { api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&gender=f&wm=97bL6` } },
            { name: "男性主播", ext: { api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&gender=m&wm=97bL6` } },
            { name: "情侣直播", ext: { api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&gender=c&wm=97bL6` } },
            { name: "跨性别", ext: { api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&gender=t&wm=97bL6` } }
        ]
    };
    return jsonify(config);
}

/**
 * 通过 API 直接获取视频卡片（规避了 HTML 结构改变的风险）
 */
async function getCards(ext) {
    ext = argsify(ext);
    const url = ext.api;
    const cards = [];
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json'
    };

    try {
        const { data } = await $fetch.get(url, { headers });
        // XPTV 环境下统一使用内置防错解析数据
        const resObj = argsify(data); 
        const rooms = resObj.results || resObj;

        if (Array.isArray(rooms)) {
            rooms.forEach((room) => {
                if (room.username) {
                    cards.push({
                        vod_id: room.username.toString(), // 确保是字符串
                        vod_name: room.username,
                        vod_pic: room.image_url || room.snapshot_url,
                        vod_remarks: `在线: ${room.num_users || 0}人`,
                        ext: {
                            url: `${appConfig.site}/${room.username}/`,
                            name: room.username
                        }
                    });
                }
            });
        }
    } catch (e) {
        $utils.toastError('接口数据抓取失败: ' + e.message);
    }

    return jsonify({ list: cards });
}

/**
 * 获取播放轨道
 */
async function getTracks(ext) {
    ext = argsify(ext);
    const tracks = [
        {
            name: "在线播放直播间 (" + ext.name + ")",
            ext: { url: ext.url }
        }
    ];
    return jsonify({ list: tracks });
}

/**
 * 提取 HLS/m3u8 播放地址
 */
async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = ext.url;
    let playUrl = "";
    
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const headers = { 'User-Agent': UA };

    try {
        // 直接请求网页源码，提取动态生成的原始 m3u8
        const { data } = await $fetch.get(url, { headers });
        const match = data.match(/https:\\\/\\\/[^"]+?\.m3u8/);
        if (match) {
            playUrl = match[0].replace(/\\/g, ''); 
        }
    } catch (e) {
        $print("常规解析失败");
    }

    // 嗅探器作为兜底分支
    let $config = {};
    try { $config = argsify($config_str); } catch(e){}

    if (!playUrl && $config.sniffer) {
        try {
            const sniffRes = await $fetch.post(`${$config.sniffer}/getplayurl`, jsonify({
                "url": url,
                "ua": [UA],
                "first": 1,
                "speed": 1
            }), {
                'User-Agent': UA,
                'Content-Type': 'application/json'
            });
            const resData = argsify(sniffRes.data);
            if (resData && resData.result && resData.result.first) {
                return jsonify({
                    urls: [resData.result.first.url],
                    headers: [resData.result.first.headers || { "User-Agent": UA }]
                });
            }
        } catch (err) {}
    }

    if (playUrl) {
        return jsonify({ urls: [playUrl], headers: [headers] });
    } else {
        return jsonify({ urls: [url], headers: [headers] });
    }
}

/**
 * 搜索逻辑
 */
async function search(ext) {
    ext = argsify(ext);
    const keyword = ext.keyword;
    const searchUrl = `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&username=${encodeURIComponent(keyword)}&wm=97bL6`;
    return await getCards(jsonify({ url: searchUrl }));
}
