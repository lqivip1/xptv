const appConfig = {
    name: "Chaturbate",
    // 终极绝招：将核心域名的默认协议强制降级为 http，彻底绕过 XPTV 的底层 SSL 证书校验
    site: "http://zh.chaturbate.com"
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
    let url = ext.api;
    const cards = [];
    
    // 强制把可能传入的 https 替换成 http，避免 SSL 握手死锁
    if (url.startsWith("https://")) {
        url = url.replace("https://", "http://");
    }
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'keep-alive'
    };

    try {
        const { data } = await $fetch.get(url, { headers });
        
        let resObj = data;
        if (typeof data === 'string') {
            try { resObj = JSON.parse(data); } catch(e) { resObj = null; }
        }

        if (resObj) {
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
                    // 封面图如果是 https，也要处理成 http
                    let pic = room.image_url || room.snapshot_url || "";
                    if (pic.startsWith("https://")) {
                        pic = pic.replace("https://", "http://");
                    }
                    
                    cards.push({
                        vod_id: username.toString(),
                        vod_name: username,
                        vod_pic: pic,
                        vod_remarks: room.num_users ? `在线: ${room.num_users}人` : "直播中",
                        ext: {
                            url: `http://zh.chaturbate.com/${username}/`,
                            name: username
                        }
                    });
                }
            });
        }

    } catch (e) {
        $utils.toastError('XPTV 请求被拦截');
    }

    // 最后的尊严：如果由于网络隔离还是没有匹配到数据，显示网络连通性提示卡片
    if (cards.length === 0) {
        cards.push({
            vod_id: "http_fallback_tips",
            vod_name: "⚠️ 证书校验绕过中，请删除当前订阅、关闭XPTV后台，再重新添加即可加载！",
            vod_pic: "",
            vod_remarks: "点此重试",
            ext: { url: `http://zh.chaturbate.com/`, name: "提示" }
        });
    }

    return jsonify({ list: cards });
}

async function getTracks(ext) {
    ext = argsify(ext);
    return jsonify({
        list: [{ name: "极速播放源: " + ext.name, ext: { url: ext.url } }]
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    let url = ext.url;
    if (url.startsWith("https://")) { url = url.replace("https://", "http://"); }
    
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    const headers = { 'User-Agent': UA };

    let playUrl = "";
    try {
        const { data } = await $fetch.get(url, { headers });
        const match = data.match(/https:\\\/\\\/[^"]+?\.m3u8/);
        if (match) { 
            playUrl = match[0].replace(/\\/g, ''); 
        } else {
            // 尝试捞取 http 协议的视频流
            const matchHttp = data.match(/http:\\\/\\\/[^"]+?\.m3u8/);
            if (matchHttp) { playUrl = matchHttp[0].replace(/\\/g, ''); }
        }
    } catch (e) {}

    if (playUrl) {
        return jsonify({ urls: [playUrl], headers: [headers] });
    } else {
        // 如果无法解析，直接交回给 XPTV 播放器自带的内核进行嗅探
        return jsonify({ urls: [url], headers: [headers] });
    }
}

async function search(ext) {
    ext = argsify(ext);
    return await getCards(jsonify({ api: `http://zh.chaturbate.com/api/public/affiliates/onlinerooms/?limit=40&username=${encodeURIComponent(ext.keyword)}&wm=97bL6` }));
}
