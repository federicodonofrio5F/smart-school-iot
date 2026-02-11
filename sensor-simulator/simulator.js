import mqtt from "mqtt";

const client = mqtt.connect("mqtt://broker.hivemq.com");

// 👇 metti qui gli stessi nomi che hai in FLOORS (key: "...")
const ROOMS = [
  // Piano Terra
  { floor: 1, room: "Aula 1A" },
  { floor: 1, room: "Aula 1B" },
  { floor: 1, room: "Aula 1C" },
  { floor: 1, room: "Aula 1D" },
  { floor: 1, room: "Aula 1E" },
  { floor: 1, room: "Aula 1F" },
  { floor: 1, room: "Laboratorio Chimica" },
  { floor: 1, room: "Laboratorio Fisica" },
  { floor: 1, room: "Segreteria" },
  { floor: 1, room: "Aula Magna" },

  // Primo Piano
  { floor: 2, room: "Aula 2A" },
  { floor: 2, room: "Aula 2B" },
  { floor: 2, room: "Aula 2C" },
  { floor: 2, room: "Aula 2D" },
  { floor: 2, room: "Aula 2E" },
  { floor: 2, room: "Aula 2F" },
  { floor: 2, room: "Laboratorio Informatica" },
  { floor: 2, room: "Biblioteca" },
  { floor: 2, room: "Aula Docenti" },
  { floor: 2, room: "Palestra" },
];

function realisticTemperature(hour, floor, room) {
    // base giornaliera
    const base = 20 + (floor - 1) * 0.6;
    const daily = Math.sin((hour / 24) * Math.PI) * 5; // più caldo verso metà giornata
    let temp = base + daily + (Math.random() - 0.5) * 0.8;
  
    // 🔥 Stanze che tendono a essere più calde (più persone / PC / sole)
    const hotRooms = [
      "Laboratorio Informatica",
      "Aula 2E",
      "Aula 1C",
      "Aula Magna",
    ];
    if (hotRooms.includes(room)) temp += 2.5;
  
    // 🔥 Picco ogni tanto (finestre chiuse / termosifoni / evento)
    // 6% di probabilità ad ogni invio -> a volte sale oltre 28
    if (Math.random() < 0.06) temp += 3.0;
  
    return temp.toFixed(1);
  }
  
  function realisticNoise(hour, room) {
    const isBreak = hour >= 10 && hour <= 11; // intervallo
    const isLesson = hour >= 8 && hour <= 13;
  
    // base
    let noise = 35;
    if (isLesson) noise = 45;
    if (isBreak) noise = 68;
  
    // 🔊 stanze rumorose “di natura”
    const loudRooms = ["Palestra", "Aula Magna"];
    if (loudRooms.includes(room)) noise += 12;
  
    // 🔊 picchi casuali reali (urla, spostamenti, campanella)
    // 8% di probabilità -> rumore critico per quell'update
    if (Math.random() < 0.08) noise += 18;
  
    // jitter
    noise += Math.random() * 10;
  
    return noise.toFixed(1);
  }
  

client.on("connect", () => {
  console.log("Simulator connected to MQTT");

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

      // topic semplice (gli spazi vanno bene nei payload, nel topic meglio evitare)
      client.publish("school/SmartSchool/sensors", JSON.stringify(tempPayload));
      client.publish("school/SmartSchool/sensors", JSON.stringify(noisePayload));
    }
  }, 2000);
});
