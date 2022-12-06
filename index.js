const express = require("express");
const app = express();
const tthol = require("./tthol");
const bodyParser = express.urlencoded({ extended: true });

app.get("/tthol/:account/status", tthol.status);
app.get("/tthol/:account/data", tthol.data);
app.post("/tthol/:account/login", bodyParser, tthol.login);
app.delete("/tthol/:account/logout", tthol.logout);
app.post("/tthol/:account/record", bodyParser, tthol.record);

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("開工了！！目前在port " + port);
});
