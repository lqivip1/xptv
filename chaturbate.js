const appConfig = {
    name: "Chaturbate",
    site: "https://zh.chaturbate.com"
};

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

function jsonify(s) { return JSON.stringify(s); }
function argsify(s) { return JSON.parse(s); }

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

async function getCards(ext) {
    ext = argsify(ext);
    const url = ext.api;
    const cards = [];
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    try {
        const { data } = await $fetch.get(url, { headers });
        
        // 健壮性解析：防止返回的 data 已经是对象或仍是字符串
        let resObj = data;
        if (typeof data === 'string') {
            try { resObj = JSON.parse(data); } catch(e) { resObj = null; }
        }

        if (resObj) {
            // 兼容多种可能的 JSON 嵌套结构
            let rooms = [];
            if (Array.isArray(resObj)) {
                rooms = resObj;
            } else if (resObj.results && Array.isArray(resObj.results)) {
                rooms = resObj.results;
            } else if (resObj.data && Array.isArray(resObj.data)) {
                rooms = resObj.data;
            }

            rooms.forEach((room) => {
                const username = room.username || room.screen_name;
                if (username) {
                    cards.push({
                        vod_id: username.toString(),
                        vod_name: username,
                        vod_pic: room.image_url || room.snapshot_url || "",
                        vod_remarks: room.num_users ? `在线: ${room.num_users}人` : "直播中",
                        ext: {
                            url: `${appConfig.site}/${username}/`,
                            name: username
                        }
                    });
                }
            });
        }
        
        // 如果上面都没匹配成功，尝试用最粗暴的正则去 API 文本里捞用户名和封面
        if (cards.length === 0 && typeof data === 'string') {
            const usernames = data.match(/"username":\s*"([^"]+)"/g);
            if (usernames) {
                usernames.forEach((item) => {
                    const name = item.split('"')[3];
                    if (name && cards.length < 40) {
                        cards.push({
                            vod_id: name,
                            vod_name: name,
                            vod_pic: "",
                            vod_remarks: "在线直播",
                            ext: { url: `${appConfig.site}/${name}/`, name: name }
                        });
                    }
                });
            }
        }

    } catch (e) {
        $utils.toastError('XPTV 请求接口失败: ' + e.message);
    }

    // 终极保底：如果还是空白，塞入一个提示卡片，证明脚本本身没死，只是数据卡住了
    if (cards.length === 0) {
        cards.push({
            vod_id: "empty_tips",
            vod_name: "⚠️ 脚本已运行但未匹配到数据，请点进任意分类尝试清理 XPTV 缓存",
            vod_pic: "",
            vod_remarks: "点击排查",
            ext: { url: `${appConfig.site}/`, name: "提示" }
        });
    }

    return jsonify({ list: cards });
}

async function getTracks(ext) {
    ext = argsify(ext);
    return jsonify({
        list: [{ name: "极速播放: " + ext.name, ext: { url: ext.url } }]
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = ext.url;
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const headers = { 'User-Agent': UA };

    let playUrl = "";
    try {
        const { data } = await $fetch.get(url, { headers });
        const match = data.match(/https:\\\/\\\/[^"]+?\.m3u8/);
        if (match) { playUrl = match[0].replace(/\\/g, ''); }
    } catch (e) {}

    if (playUrl) {
        return jsonify({ urls: [playUrl], headers: [headers] });
    } else {
        return jsonify({ urls: [url], headers: [headers] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    return await getCards(jsonify({ api: `${appConfig.site}/api/public/affiliates/onlinerooms/?limit=40&username=${encodeURIComponent(ext.keyword)}&wm=97bL6` }));
}
