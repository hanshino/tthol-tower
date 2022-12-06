const GoogleSheet = require("./lib/googleSheet.js");
const util = require("util");
const mem = require("memory-cache");
const LineNotify = require("./lib/lineNotify.js");
const byPassList = [
  "han",
  "gime",
  "asdf",
  "suc750319",
  "ben820514",
  "breakthrough001",
  "721432",
  "weisyun1021",
  "a1234a567812",
];
let uploadQueue = [];
let uploadStatus = null;

/**
 * 新增使用紀錄至GoogleSheet
 * @param   {String}    account 帳號
 * @param   {Object}    rawData 原始資料
 */
function insertRecord(account, rawData) {
  if (byPassList.includes(account) === true) return;
  let { data: strData, no } = rawData;

  let characterDatas = strData.split(",");
  let repeatNames = [];
  let result = [];

  characterDatas.forEach(data => {
    let charDatas = data.split("|");

    if (charDatas[0].indexOf("▲") === 0 || charDatas[0].indexOf("●") === 0) return;

    if (repeatNames.indexOf(charDatas[0]) === -1) {
      let temp = [no, account];
      repeatNames.push(charDatas[0]);
      charDatas.forEach(d => {
        temp.push(d.replace(/.*?:/, ""));
      });
      result.push(temp);
    } else {
      return;
    }
  });

  uploadQueue.push(result);

  if (uploadStatus !== null) return;

  uploadStatus = setTimeout(() => {
    uploadData();
    uploadQueue = [];
    uploadStatus = null;
  }, 5000);
}

function setStatus(account, status) {
  console.log(account, status);
  return GoogleSheet.proc({
    url: "https://script.google.com/macros/s/AKfycbzB81kbSwJos3e8ehYj6G_nQTetEEtahJWHgul3-IJWZ5WTyYo/exec",
    method: "setStatus",
    data: {
      account: account,
      status: status,
    },
  }).then(resp => {
    console.log(resp);
  });
}

function fetchAnnouncement() {
  let sql =
    'SELECT * ORDER BY A DESC LIMIT 1 LABEL A "no", B "version", C "message", D "memoryA", E "memoryB", F "memoryC", G "downloadLink"';

  // concat string from H to Z
  Array.from({ length: 19 }).forEach((_, i) => {
    sql += `, ${String.fromCharCode(i + 72)} "memory${i + 1}"`;
  });

  // concat string from AA to AX
  Array.from({ length: 24 }).forEach((_, i) => {
    sql += `, A${String.fromCharCode(i + 65)} "memory${i + 20}"`;
  });

  let memData = mem.get("ANNOUNCE");
  if (memData !== null) {
    return JSON.parse(memData);
  }

  return GoogleSheet.query({
    key: "1Mv6apOE05pen8Qb9xIqLfAnZyPYMEDUGdb8lUPfOsm8",
    type: "json",
    query: sql,
    gid: "1523891811",
  }).then(resp => {
    mem.put("ANNOUNCE", JSON.stringify(resp), 60 * 1000);
    return resp;
  });
}

/**
 * 寫入帳號資料至快取
 * @param {String} account 帳號
 * @param {Object} data 帳號資料
 */
function saveAccountData(account, data) {
  return mem.put("ACCOUNT_" + account, data);
}

/**
 * 獲取帳號資訊，快取版本
 * @param {String} account 帳號
 */
async function getAccountData(account) {
  let memData = mem.get("ACCOUNT_" + account);
  let result = null;

  if (memData === null) {
    result = await fetchAccountData(account);
    result = result[0] || [];
    saveAccountData(account, result);
  } else {
    result = memData;
  }

  return result;
}

async function doLogout(account) {
  if (byPassList.includes(account) === true) return true;
  if (verfiyAccount(account) === false) throw "帳號格式錯誤";
  let data = await fetchAccountData(account);

  if (data.length === 0) throw "查無此帳號";

  let accountData = data[0];
  let status = parseInt(accountData.status);

  if (status === 0) throw "無須登出";

  LineNotify.pushMessage({
    message: `\n帳號：${account}\n動作：登出\n目前狀態：${status}`,
  });

  setStatus(account, 0);

  return true;
}

async function doLogin(objData) {
  let { account, status: queryStatus } = objData;
  if (verfiyAccount(account) === false) throw "帳號格式錯誤";
  let data = await fetchAccountData(account);

  if (data.length === 0) throw "查無此帳號";

  let accountData = data[0];
  saveAccountData(account, accountData);

  let status = parseInt(accountData.status);

  if (byPassList.includes(accountData.account) === true) {
    let tomorrow = new Date(new Date().getTime() + 86400 * 1000);
    status = 2;
    accountData.expireDTM =
      [
        tomorrow.getFullYear(),
        ("0" + (tomorrow.getMonth() + 1)).slice(-2),
        ("0" + tomorrow.getDate()).slice(-2),
      ].join("") + "0000";
  }

  if (status >= 3) throw "帳號登入中";

  let action = status == 1 ? "初次登入註冊" : "登入";
  if (queryStatus == 1) {
    status++;
  } else {
    status = queryStatus;
  }

  // 特定帳號進行bypass
  if (byPassList.includes(accountData.account) === false) {
    LineNotify.pushMessage({ message: `\n帳號：${account}\n動作：${action}\n目前狀態：${status}` });
    setStatus(account, status);
    accountData.status = status.toString();
  } else {
    LineNotify.pushMessage({ message: `\n帳號：${account}\n進行登入，在罕罕bypass名單，放行！` });
    accountData.status = "1";

    if (typeof accountData.machineCodeA == "string") {
      accountData.machineCodeA = accountData.machineCodeA.replace(/#\d$/, "#5");
    }

    if (typeof accountData.machineCodeB == "string") {
      accountData.machineCodeB = accountData.machineCodeB.replace(/#\d$/, "#5");
    }

    if (typeof accountData.machineCodeC == "string") {
      accountData.machineCodeC = accountData.machineCodeC.replace(/#\d$/, "#5");
    }
  }

  let announce = await fetchAnnouncement();

  if (announce.length === 0) {
    announce = {
      ver: "",
      message: "",
    };
  } else {
    announce = announce[0];
  }

  let offsetPos = [];

  Object.keys(announce).forEach(key => {
    if (/^memory\d{1,2}$/.test(key)) {
      offsetPos.push(announce[key]);
    }
  });

  let result = [
    accountData.timestamp,
    accountData.account,
    accountData.status,
    accountData.type,
    accountData.expireDTM,
    accountData.machineCodeA,
    accountData.machineCodeB,
    accountData.machineCodeC,
    announce.version,
    announce.message,
    getCurrentDate(),
    announce.memoryA,
    announce.memoryB,
    announce.memoryC,
    accountData.passBy,
    accountData.memberType,
    accountData.dataRecord,
    announce.downloadLink,
    ...offsetPos,
  ];

  return result;
}

/**
 * 獲取帳號資訊
 * @param {String} account 帳號
 */
function fetchAccountData(account) {
  let sql =
    'SELECT * WHERE K = "%s" LABEL A "no", B "timestamp", C "status", D "logoutDTM", E "type", F "createDTM", G "boughtDTM", H "amount", I "expireDTM", J "passBy", K "account", L "userName", M "server", N "machineCode", O "machineCodeA", P "machineCodeB", Q "machineCodeC", R "unlockTimes", S "memberType", T "dataRecord"';
  sql = util.format(sql, account);

  return GoogleSheet.query({
    key: "1Mv6apOE05pen8Qb9xIqLfAnZyPYMEDUGdb8lUPfOsm8",
    type: "json",
    query: sql,
    gid: "0",
  });
}

function uploadData() {
  GoogleSheet.proc({
    url: "https://script.google.com/macros/s/AKfycbzB81kbSwJos3e8ehYj6G_nQTetEEtahJWHgul3-IJWZ5WTyYo/exec",
    method: "appendSheetDatas",
    data: {
      sheetName: "使用數據",
      appendDatas: uploadQueue,
    },
  });
}

/**
 * 驗證帳號格式
 * @param {String} account 帳號
 * @returns {Boolean} return true on correct, otherwise.
 */
function verfiyAccount(account) {
  return /^[0-9a-z]{1,20}$/.test(account) === true;
}

function getCurrentDate() {
  let now = new Date();

  return [
    now.getFullYear(),
    ("0" + (now.getMonth() + 1)).substr(-2),
    ("0" + now.getDate()).substr(-2),
    ("0" + now.getHours()).substr(-2),
    ("0" + now.getMinutes()).substr(-2),
  ].join("");
}

async function isLogin(account) {
  if (verfiyAccount(account) === false) throw "帳號格式錯誤";
  let result = await fetchAccountData(account);

  if (result.length === 0) throw JSON.stringify({ code: "400-01", errMsg: "查無此帳號" });

  let accountData = result[0];

  return accountData.status !== "0";
}

exports.status = async (req, res) => {
  let account = req.params.account;
  let result = "";

  try {
    let resp = await isLogin(account);

    if (resp) {
      result = "登入中";
    } else {
      result = "離線中";
    }
  } catch (e) {}

  res.send(result);
};

exports.data = async (req, res) => {
  let account = req.params.account;
  const resp = await fetchAccountData(account);

  if (resp.length === 0) {
    res.send("");
  } else {
    console.log(resp[0]);
    res.send(
      Object.keys(resp[0])
        .map(key => {
          return resp[0][key];
        })
        .join("*/")
    );
  }
};

exports.login = async (req, res) => {
  let result = "";

  try {
    let loginResult = await doLogin({
      account: req.params.account,
      status: req.body.login || "1",
    });

    result = loginResult.join("*/");
  } catch (e) {
    result = e;
    console.log(e);
  }

  res.send(result);
};

exports.logout = async (req, res) => {
  let result = "";

  try {
    let account = req.params.account;

    result = await doLogout(account);

    result = result ? "登出成功" : "登出失敗";
  } catch (e) {
    result = e;
  }

  res.send(result);
};

exports.record = (req, res) => {
  insertRecord(req.params.account, req.body);
  res.send(JSON.stringify({ status: "done" }));
};
