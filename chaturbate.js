const appConfig = {
    name: "Chaturbate",
    site: "https://zh.chaturbate.com"
};

// XPTV 内置原生方法初始化 [cite: 33, 34]
const cheerio = createCheerio(); [cite: 33]
const CryptoJS = createCryptoJS(); [cite: 34]

function jsonify(s) { return JSON.stringify(s); }
function argsify(s) { return JSON.parse(s); } [cite: 32]

/**
 * 获取基础配置和分类标签 [cite: 88]
 */
async function getConfig() { [cite: 88]
    const config = {
        tabs: [
            { name: "热门直播", ext: { url: `${appConfig.site}/` } },
            { name: "女性主播", ext: { url: `${appConfig.site}/female-cams/` } },
            { name: "男性主播", ext: { url: `${appConfig.site}/male-cams/` } },
            { name: "情侣直播", ext: { url: `${appConfig.site}/couple-cams/` } },
            { name: "跨性别", ext: { url: `${appConfig.site}/trans-cams/` } }
        ]
    };
    return jsonify(config);
}

/**
 * 获取直播间卡片列表 [cite: 88]
 */
async function getCards(ext) { [cite: 88]
    ext = argsify(ext);
    const url = ext.url;
    const cards = [];
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', [cite: 36]
        'Accept-Language': 'zh-CN,zh;q=0.9'
    };

    try {
        const { data } = await $fetch.get(url, { headers }); [cite: 42]
        const $ = cheerio.load(data); [cite: 98]

        $('ul.list li.room_list_room').each((_, element) => {
            const href = $(element).find('a').attr('href'); [cite: 100]
            const title = $(element).find('.title a').text().trim() || href.replace(/\//g, ''); [cite: 101]
            const cover = $(element).find('img.clickable_image').attr('src') || $(element).find('img').attr('src'); [cite: 102]
            const viewers = $(element).find('.num_users').text().trim();

            if (href) {
                cards.push({
                    vod_id: href.toString(),  // vod_id 必须为字符串类型 [cite: 191, 297]
                    vod_name: title, [cite: 106]
                    vod_pic: cover, [cite: 107]
                    vod_remarks: viewers ? `在线: ${viewers}` : "直播中", [cite: 108]
                    ext: {
                        url: `${appConfig.site}${href}`, [cite: 110]
                        name: title
                    }
                });
            }
        });
    } catch (e) {
        $utils.toastError('列表加载失败: ' + e.message); [cite: 51]
    }

    return jsonify({ list: cards });
}

/**
 * 获取播放集数（单个直播间固定为一个播放轨道） [cite: 88]
 */
async function getTracks(ext) { [cite: 88]
    ext = argsify(ext);
    const tracks = [
        {
            name: "进入直播间 (" + ext.name + ")",
            ext: { url: ext.url }
        }
    ];
    return jsonify({ list: tracks });
}

/**
 * 解析并提取直播流链接 [cite: 88]
 */
async function getPlayinfo(ext) { [cite: 88]
    ext = argsify(ext);
    const url = ext.url;
    let playUrl = "";
    
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'; [cite: 327]
    const headers = { 'User-Agent': UA };

    try {
        // 尝试从网页源代码中提取原生内嵌的 m3u8 地址
        const { data } = await $fetch.get(url, { headers }); [cite: 42]
        const match = data.match(/https:\\\/\\\/[^"]+?\.m3u8/);
        if (match) {
            playUrl = match[0].replace(/\\/g, ''); 
        }
    } catch (e) {
        $print("常规页面流媒体提取失败"); [cite: 40]
    }

    // 如果原生提取失败，且你在订阅中配置了自定义的 docker 嗅探服务器，则走嗅探分支 [cite: 307]
    let $config = {};
    try { $config = argsify($config_str); } catch(e){} [cite: 32]

    if (!playUrl && $config.sniffer) { [cite: 307]
        try {
            const sniffRes = await $fetch.post(`${$config.sniffer}/getplayurl`, jsonify({ [cite: 333]
                "url": url, [cite: 334]
                "ua": [UA], [cite: 335]
                "first": 1, [cite: 321]
                "speed": 1 [cite: 324]
            }), {
                'User-Agent': UA, [cite: 338]
                'Content-Type': 'application/json' [cite: 339]
            });
            
            const resData = argsify(sniffRes.data); [cite: 32]
            if (resData && resData.result && resData.result.first) { [cite: 341]
                return jsonify({
                    urls: [resData.result.first.url], [cite: 341]
                    headers: [resData.result.first.headers || { "User-Agent": UA }] [cite: 341]
                });
            }
        } catch (err) {
            $utils.toastError('核心嗅探调度失败'); [cite: 51]
        }
    }

    // 返回流媒体结果或兜底客户端
    if (playUrl) {
        return jsonify({ urls: [playUrl], headers: [headers] });
    } else {
        return jsonify({ urls: [url], headers: [headers] });
    }
}

/**
 * 搜索页逻辑 [cite: 88]
 */
async function search(ext) { [cite: 88]
    ext = argsify(ext);
    const keyword = ext.keyword;
    const searchUrl = `${appConfig.site}/tags/${encodeURIComponent(keyword)}/`;
    return await getCards(jsonify({ url: searchUrl }));
}
