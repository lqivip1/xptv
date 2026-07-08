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
            { name: "热门直播", ext: { url: `${appConfig.site}/` } },
            { name: "女性主播", ext: { url: `${appConfig.site}/female-cams/` } },
            { name: "男性主播", ext: { url: `${appConfig.site}/male-cams/` } },
            { name: "情侣直播", ext: { url: `${appConfig.site}/couple-cams/` } },
            { name: "跨性别", ext: { url: `${appConfig.site}/trans-cams/` } }
        ]
    };
    return jsonify(config);
}

async function getCards(ext) {
    ext = argsify(ext);
    const url = ext.url;
    const cards = [];
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': appConfig.site
    };

    try {
        const { data } = await $fetch.get(url, { headers });
        
        // 尝试解析 HTML (防止 API 彻底被封封锁)
        const $ = cheerio.load(data);
        
        // 针对 Chaturbate 动态/静态混合结构的多种选择器兼容兼容
        const listItems = $('ul.list li.room_list_room, div.room_list_room, li.cams-list-item');
        
        if (listItems.length > 0) {
            listItems.each((_, element) => {
                const href = $(element).find('a').attr('href');
                let title = $(element).find('.title a, .username').text().trim();
                let cover = $(element).find('img.clickable_image, img').attr('src');
                const viewers = $(element).find('.num_users, .count').text().trim();

                if (href && href.includes('/') && !href.includes('javascript')) {
                    const cleanHref = href.startsWith('http') ? href : `${appConfig.site}${href}`;
                    const name = title || href.replace(/\//g, '');
                    cards.push({
                        vod_id: name,
                        vod_name: name,
                        vod_pic: cover || "",
                        vod_remarks: viewers ? `在线: ${viewers}` : "直播中",
                        ext: { url: cleanHref, name: name }
                    });
                }
            });
        }
        
        // 兜底方案：如果实在解析不出，塞入一个“需要手动激活”的常驻卡片，避免页面空白无法交互
        if (cards.length === 0) {
            cards.push({
                vod_id: "check_network",
                vod_name: "⚠️ 未刷新出内容，请点击此处测试网络或过几秒重试",
                vod_pic: "https://pub-static.f002.backblazeb2.com/empty.png",
                vod_remarks: "点击排查",
                ext: { url: `${appConfig.site}/`, name: "网络排查" }
            });
        }

    } catch (e) {
        $utils.toastError('网络连接被拒绝，请确认代理状态');
        cards.push({
            vod_id: "error",
            vod_name: "加载失败: " + e.message,
            vod_pic: "",
            vod_remarks: "请检查规则",
            ext: { url: url, name: "重试" }
        });
    }

    return jsonify({ list: cards });
}

async function getTracks(ext) {
    ext = argsify(ext);
    return jsonify({
        list: [{ name: "极速嗅探播放: " + ext.name, ext: { url: ext.url } }]
    });
}

async function getPlayinfo(ext) {
    ext = argsify(ext);
    const url = ext.url;
    
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const headers = { 'User-Agent': UA };

    let $config = {};
    try { $config = argsify($config_str); } catch(e){}

    // 针对严格限制站，直接使用嗅探器方案或者直接传回原网页让播放器内核进行二级硬嗅探
    if ($config.sniffer) {
        try {
            const sniffRes = await $fetch.post(`${$config.sniffer}/getplayurl`, jsonify({
                "url": url,
                "ua": [UA],
                "first": 1,
                "speed": 1,
                "triggerplay": 1
            }), { 'User-Agent': UA, 'Content-Type': 'application/json' });
            
            const resData = argsify(sniffRes.data);
            if (resData && resData.result && resData.result.first) {
                return jsonify({
                    urls: [resData.result.first.url],
                    headers: [resData.result.first.headers || headers]
                });
            }
        } catch (err) {}
    }

    // 终极兜底：直接扔给客户端播放器
    return jsonify({ urls: [url], headers: [headers] });
}

async function search(ext) {
    ext = argsify(ext);
    return await getCards(jsonify({ url: `${appConfig.site}/tags/${encodeURIComponent(ext.keyword)}/` }));
}
