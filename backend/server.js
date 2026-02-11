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

// --- SIMULATORE INTEGRATO ---
import mqtt from "mqtt";

const simClient = mqtt.connect("mqtt://broker.hivemq.com");

function randomTemp() {
  return (20 + Math.random() * 8).toFixed(1);
}

function randomNoise() {
  return (40 + Math.random() * 40).toFixed(1);
}

simClient.on("connect", () => {
  console.log("Simulator started inside backend");

  setInterval(() => {
    const rooms = [
      "Aula-101", "Aula-102", "Aula-103",
      "Aula-201", "Aula-202", "Laboratorio-1"
    ];

    rooms.forEach(room => {
      const tempPayload = {
        room,
        type: "temperature",
        value: randomTemp(),
        unit: "C",
        timestamp: new Date().toISOString()
      };

      const noisePayload = {
        room,
        type: "noise",
        value: randomNoise(),
        unit: "dB",
        timestamp: new Date().toISOString()
      };

      simClient.publish(
        `school/SmartSchool/${room}/temperature`,
        JSON.stringify(tempPayload)
      );

      simClient.publish(
        `school/SmartSchool/${room}/noise`,
        JSON.stringify(noisePayload)
      );
    });

  }, 2000);
});

