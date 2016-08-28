const app = require("./NodeService");
app.start("mongodb://localhost:32774/device_registry","amqp://guest:guest@localhost:32771")
    .then(()=>console.log("Started"))
    .catch((err) => console.error(err.stack));