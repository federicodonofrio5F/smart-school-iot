import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mqtt from "mqtt";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
      origin: [
        "https://smart-school-iot-1.onrender.com"
      ],
      methods: ["GET", "POST"]
    }
  });
  

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("Backend connected to MQTT");
  mqttClient.subscribe("school/SmartSchool/sensors");
});

mqttClient.on("message", (topic, message) => {
  const data = JSON.parse(message.toString());
    console.log("DATI RICEVUTI:", data); // conferma dei dati
    io.emit("sensor-update", data);
  
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

httpServer.listen(4000, () => {
  console.log("Server running on port 4000");
});
