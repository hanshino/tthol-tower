const { default: axios } = require("axios");
const URLSearchParams = require("url").URLSearchParams;
const SheetUrl = "https://docs.google.com/spreadsheets/u/0/d/%s/gviz/tq?";
const { format } = require("util");

/**
 * 使用SQL語法取得表單資料
 * @param {Ojbect} param0
 * @param {String} param0.gid 表單ID
 * @param {String} param0.type 回傳格式
 * @param {String} param0.key 表單Key
 * @param {String} param0.query SQL語法
 * @returns {Promise}
 */
exports.query = ({ gid, type = "json", query, key }) => {
  let params = new URLSearchParams({
    tqx: `out:${type}`,
    tq: query,
    gid: gid,
  });

  let url = format(SheetUrl, key) + params.toString();
  return queryData(url);
};

exports.proc = ({ url, method, data }) => {
  const query = new URLSearchParams();
  query.append("method", method);
  query.append("data", JSON.stringify(data));

  return axios.post(url, query.toString());
};

function queryData(url) {
  return axios.get(url).then((resp) => {
    let jsonResult = resp.data.match(/\{.*\}/)[0];

    try {
      return queryParse(JSON.parse(jsonResult));
    } catch (e) {
      console.log(e);
      console.log(jsonResult);
      console.log("Google表單回傳物件無法解析");
      return false;
    }
  });
}

function queryParse(data) {
  let rows = data.table.rows;

  let title = data.table.cols.map((col) => {
    return col.label !== "" ? col.label.trim() : col.id;
  });

  let result = [];

  rows.forEach(function (row) {
    let temp = {};
    row.c.forEach(function (value, index) {
      if (value === null) return;
      temp[title[index]] = value.hasOwnProperty("f") ? value.f : value.v;
    });
    result.push(temp);
  });

  return result;
}
