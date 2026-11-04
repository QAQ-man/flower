/**
 * 统一网络请求封装
 * @param {string} url 接口路径，如 /api/deliveryTemplate
 * @param {string} method 请求方式 GET / POST / PUT / DELETE
 * @param {object|null} data 请求参数，get传null，post传对象
 * @returns Promise 后端返回的data数据
 */
async function request(url, method, data = null) {
    // 后端服务地址，如果yml改端口，这里同步修改
    const baseURL = 'https://api.zhuys.dpdns.org';

    const options = {
        method: method,
        headers: {
            "Content-Type": "application/json"
        }
    };

    // POST、PUT 需要把对象转为json字符串放到请求体
    if (data !== null && (method.toUpperCase() === "POST" || method.toUpperCase() === "PUT")) {
        options.body = JSON.stringify(data);
    }

    // 发起fetch网络请求
    const response = await fetch(baseURL + url, options);
    const jsonResult = await response.json();

    // 判断后端业务状态码
    if (jsonResult.code === 200) {
        // 成功：直接把 data 返回出去
        return jsonResult.data;
    } else {
        // 业务失败，抛出异常，外部用catch捕获
        throw new Error(jsonResult.msg || "请求出错");
    }
}

// 快捷别名（可选，也可以直接用request）
async function get(url) {
    return await request(url, "GET", null);
}

async function post(url, data) {
    return await request(url, "POST", data);
}

async function put(url, data) {
    return await request(url, "PUT", data);
}

async function del(url) {
    return await request(url, "DELETE", null);
}
