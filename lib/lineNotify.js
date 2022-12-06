const { default: axios } = require("axios");

exports.pushMessage = async ({
  message,
  token = "bj9cs0bTsqM0KMdKoT89mwwNFgRkFWiupW48K5Kp5CC",
}) => {
  const query = new URLSearchParams();
  query.set("message", message);

  await axios.post(API_NOTIFY, query.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
};
