const app = require("./MqttGateway");
app.start(
    "amqp://guest:guest@localhost:32771",
    "mqtt://raspberrypi.fritz.box")

    .then(()=>console.log("Started"))
    .catch((err) => console.error(err.stack));