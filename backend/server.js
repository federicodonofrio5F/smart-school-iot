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
// ----------------------
// SIMULATORE (gratis) dentro al backend
// ----------------------
const ENABLE_SIMULATOR = process.env.ENABLE_SIMULATOR === "true";

if (ENABLE_SIMULATOR) {
  console.log("✅ Simulator enabled inside backend");

  const ROOMS = [
    { floor: 1, room: "Aula 1A" }, { floor: 1, room: "Aula 1B" }, { floor: 1, room: "Aula 1C" },{ floor: 1, room: "Segreteria" },
    { floor: 1, room: "Aula 1D" }, { floor: 1, room: "Aula 1E" }, { floor: 1, room: "Aula 1F" },
    { floor: 1, room: "Laboratorio Chimica" }, { floor: 1, room: "Laboratorio Fisica" }, { floor: 1, room: "Aula Magna" },
    { floor: 2, room: "Aula 2A" }, { floor: 2, room: "Aula 2B" }, { floor: 2, room: "Aula 2C" },
    { floor: 2, room: "Aula 2D" }, { floor: 2, room: "Aula 2E" }, { floor: 2, room: "Aula 2F" },{ floor: 2, room: "Aula Docenti" },
    { floor: 2, room: "Laboratorio Informatica" }, { floor: 2, room: "Biblioteca" }, { floor: 2, room: "Palestra" },
  ];

  function realisticTemperature(hour, floor, room) {
    const base = 20 + (floor - 1) * 0.6;
    const daily = Math.sin((hour / 24) * Math.PI) * 5;
    let t = base + daily + (Math.random() - 0.5) * 0.8;

    const hotRooms = ["Laboratorio Informatica", "Aula 2E", "Aula 1C", "Aula Magna"];
    if (hotRooms.includes(room)) t += 2.5;
    if (Math.random() < 0.06) t += 3.0;

    return t.toFixed(1);
  }

  function realisticNoise(hour, room) {
    const isBreak = hour >= 10 && hour <= 11;
    const isLesson = hour >= 8 && hour <= 13;

    let n = 35;
    if (isLesson) n = 45;
    if (isBreak) n = 68;

    const loudRooms = ["Palestra", "Aula Magna"];
    if (loudRooms.includes(room)) n += 12;
    if (Math.random() < 0.08) n += 18;

    n += Math.random() * 10;
    return n.toFixed(1);
  }

  // usa lo STESSO mqttClient già connesso (quello del backend)
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();

    for (const r of ROOMS) {
      const tempPayload = {
        school: "SmartSchool",
        floor: r.floor,
        room: r.room,
        type: "temperature",
        value: realisticTemperature(hour, r.floor, r.room),
        unit: "C",
        timestamp: now.toISOString(),
      };

      const noisePayload = {
        school: "SmartSchool",
        floor: r.floor,
        room: r.room,
        type: "noise",
        value: realisticNoise(hour, r.room),
        unit: "dB",
        timestamp: now.toISOString(),
      };

      mqttClient.publish("school/SmartSchool/sensors", JSON.stringify(tempPayload));
      mqttClient.publish("school/SmartSchool/sensors", JSON.stringify(noisePayload));
    }
  }, 2000);
}


