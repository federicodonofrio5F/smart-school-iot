import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  Thermometer,
  Waves,
  ChevronLeft,
  Droplets,
  Wind,
} from "lucide-react";

const socket = io("https://smart-school-iot.onrender.com", {
  transports: ["websocket","polling"],
});

/**
 * Mappa stanze (devi usare gli stessi nomi che arrivano dal simulatore: update.room)
 * Se il tuo simulatore manda "Aula-11" ecc, rinomina qui per combaciare.
 */
const FLOORS = [
  {
    id: 1,
    name: "Piano Terra",
    rooms: [
      { id: "Aula 1A", subtitle: "Piano Terra", key: "Aula 1A" },
      { id: "Aula 1B", subtitle: "Piano Terra", key: "Aula 1B" },
      { id: "Aula 1C", subtitle: "Piano Terra", key: "Aula 1C" },
      { id: "Aula 1D", subtitle: "Piano Terra", key: "Aula 1D" },
      { id: "Aula 1E", subtitle: "Piano Terra", key: "Aula 1E" },
      { id: "Aula 1F", subtitle: "Piano Terra", key: "Aula 1F" },
      { id: "Laboratorio Chimica", subtitle: "Piano Terra", key: "Laboratorio Chimica" },
      { id: "Laboratorio Fisica", subtitle: "Piano Terra", key: "Laboratorio Fisica" },
      { id: "Segreteria", subtitle: "Piano Terra", key: "Segreteria" },
      { id: "Aula Magna", subtitle: "Piano Terra", key: "Aula Magna" },
    ],
  },
  {
    id: 2,
    name: "Primo Piano",
    rooms: [
      { id: "Aula 2A", subtitle: "Primo Piano", key: "Aula 2A" },
      { id: "Aula 2B", subtitle: "Primo Piano", key: "Aula 2B" },
      { id: "Aula 2C", subtitle: "Primo Piano", key: "Aula 2C" },
      { id: "Aula 2D", subtitle: "Primo Piano", key: "Aula 2D" },
      { id: "Aula 2E", subtitle: "Primo Piano", key: "Aula 2E" },
      { id: "Aula 2F", subtitle: "Primo Piano", key: "Aula 2F" },
      { id: "Laboratorio Informatica", subtitle: "Primo Piano", key: "Laboratorio Informatica" },
      { id: "Biblioteca", subtitle: "Primo Piano", key: "Biblioteca" },
      { id: "Aula Docenti", subtitle: "Primo Piano", key: "Aula Docenti" },
      { id: "Palestra", subtitle: "Primo Piano", key: "Palestra" },
    ],
  },
];


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export default function App() {
  const [view, setView] = useState("overview"); // overview | detail
  const [floorId, setFloorId] = useState(1);
  const [selectedRoomKey, setSelectedRoomKey] = useState(null);

  // store latest per room+type
  const [latest, setLatest] = useState([]); // [{room,type,value,unit,timestamp,floor?...}]

  useEffect(() => {
    const handler = (update) => {
      setLatest((prev) => {
        const filtered = prev.filter(
          (d) => !(d.room === update.room && d.type === update.type)
        );
        return [update, ...filtered];
      });
    };

    socket.on("sensor-update", handler);
    return () => socket.off("sensor-update", handler);
  }, []);

  const currentFloor = useMemo(
    () => FLOORS.find((f) => f.id === floorId),
    [floorId]
  );

  const selectedRoom = useMemo(() => {
    for (const f of FLOORS) {
      const found = f.rooms.find((r) => r.key === selectedRoomKey);
      if (found) return { ...found, floorName: f.name, floorId: f.id };
    }
    return null;
  }, [selectedRoomKey]);

  function getReading(roomKey, type) {
    return latest.find((d) => d.room === roomKey && d.type === type);
  }

  function getRoomMetrics(roomKey) {
    // Temperature & noise from live if present
    const t = getReading(roomKey, "temperature");
    const n = getReading(roomKey, "noise");

    const temp = t ? parseFloat(t.value) : null;
    const noise = n ? parseFloat(n.value) : null;

    // Derivations for missing sensors (so UI is full)
    const humidity = temp == null ? null : clamp(round1(55 - (temp - 22) * 2), 30, 75); // %
    const airppm = temp == null ? null : clamp(Math.round(420 + (temp - 20) * 35), 380, 900); // ppm-ish

    return {
      temperature: temp,
      noise,
      humidity,
      airppm,
      timestamp: t?.timestamp || n?.timestamp || null,
    };
  }

  function roomStatus(roomKey) {
    const m = getRoomMetrics(roomKey);
    const tempAlert = m.temperature != null && m.temperature > 28;
    const noiseAlert = m.noise != null && m.noise > 70;
    const airAlert = m.airppm != null && m.airppm > 700;

    if (tempAlert || noiseAlert || airAlert) return "alert";
    // warning if close
    const tempWarn = m.temperature != null && m.temperature > 26;
    const noiseWarn = m.noise != null && m.noise > 60;
    const airWarn = m.airppm != null && m.airppm > 600;
    if (tempWarn || noiseWarn || airWarn) return "warning";

    return "ok";
  }

  const stats = useMemo(() => {
    const allRooms = FLOORS.flatMap((f) => f.rooms);
    const monitored = allRooms.length;

    // crude "sensors active": count unique room+type present
    const active = latest.length;

    let alerts = 0;
    allRooms.forEach((r) => {
      if (roomStatus(r.key) === "alert") alerts++;
    });

    // average noise %
    let noiseVals = allRooms
      .map((r) => getRoomMetrics(r.key).noise)
      .filter((v) => typeof v === "number");
    const avgNoise = noiseVals.length
      ? Math.round((noiseVals.reduce((a, b) => a + b, 0) / noiseVals.length / 100) * 100)
      : 0;

    return { monitored, active, alerts, avgNoise };
  }, [latest]);

  function openRoom(roomKey) {
    setSelectedRoomKey(roomKey);
    // set floor automatically based on room
    const f = FLOORS.find((ff) => ff.rooms.some((r) => r.key === roomKey));
    if (f) setFloorId(f.id);
    setView("detail");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* TOP BAR */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/90 p-2 rounded-xl">
              <Activity className="text-black" size={18} />
            </div>
            <div>
              <div className="font-semibold text-lg leading-tight">IoT School Monitor</div>
              <div className="text-xs text-slate-400">
                Monitoraggio Ambientale Intelligente
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              Ultimo aggiornamento:{" "}
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-800 hover:bg-slate-700 transition px-4 py-2 rounded-xl text-sm"
            >
              Aggiorna
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          <StatCard icon={<Activity size={18} />} title="Aule Monitorate" value={stats.monitored} />
          <StatCard icon={<Thermometer size={18} />} title="Sensori Attivi" value={stats.active} />
          <StatCard icon={<AlertTriangle size={18} />} title="Alert Attivi" value={stats.alerts} />
          <StatCard icon={<Waves size={18} />} title="Media Rumore" value={`${stats.avgNoise}%`} />
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-6 pb-8 mt-6">
        {view === "overview" && (
          <Overview
            floorId={floorId}
            setFloorId={setFloorId}
            currentFloor={currentFloor}
            roomStatus={roomStatus}
            openRoom={openRoom}
          />
        )}

        {view === "detail" && selectedRoom && (
          <RoomDetail
            room={selectedRoom}
            metrics={getRoomMetrics(selectedRoom.key)}
            onBack={() => setView("overview")}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------- OVERVIEW -------------------- */

function Overview({ floorId, setFloorId, currentFloor, roomStatus, openRoom }) {
  const statusDot = {
    ok: "bg-emerald-400",
    warning: "bg-amber-400",
    alert: "bg-rose-400",
  };

  // Dividiamo le stanze in “sopra corridoio” e “sotto corridoio”
  // (metà sopra, metà sotto). Se vuoi, poi le assegniamo manualmente.
  const rooms = currentFloor.rooms;
  const split = Math.ceil(rooms.length / 2);
  const topRooms = rooms.slice(0, split);
  const bottomRooms = rooms.slice(split);

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* MAP / FLOOR */}
      <div className="col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        {/* Header + switch piano */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-300 font-medium">Mappa Piano</div>
          <div className="flex gap-2">
            <button
              onClick={() => setFloorId(1)}
              className={`px-3 py-2 rounded-xl text-sm border ${
                floorId === 1
                  ? "bg-slate-800 border-slate-700"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900"
              }`}
            >
              Piano 1
            </button>
            <button
              onClick={() => setFloorId(2)}
              className={`px-3 py-2 rounded-xl text-sm border ${
                floorId === 2
                  ? "bg-slate-800 border-slate-700"
                  : "bg-slate-950 border-slate-800 hover:bg-slate-900"
              }`}
            >
              Piano 2
            </button>
          </div>
        </div>

        {/* PIANTINA: aule sopra + corridoio centrale + aule sotto */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          {/* AULE SOPRA */}
          <div className="grid grid-cols-5 gap-3">
            {topRooms.map((r) => {
              const st = roomStatus(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => openRoom(r.key)}
                  className="relative text-left bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition"
                  title={r.id}
                >
                  <span className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${statusDot[st]}`} />
                  <div className="font-semibold text-sm">{r.id}</div>
                  <div className="text-[11px] text-slate-400">{r.subtitle}</div>
                </button>
              );
            })}
          </div>

          {/* CORRIDOIO CENTRALE */}
          <div className="my-4">
            <div className="h-14 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center">
              <span className="text-xs text-slate-400 tracking-[0.3em]">
                CORRIDOIO PRINCIPALE
              </span>
            </div>
          </div>

          {/* AULE SOTTO */}
          <div className="grid grid-cols-5 gap-3">
            {bottomRooms.map((r) => {
              const st = roomStatus(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => openRoom(r.key)}
                  className="relative text-left bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition"
                  title={r.id}
                >
                  <span className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${statusDot[st]}`} />
                  <div className="font-semibold text-sm">{r.id}</div>
                  <div className="text-[11px] text-slate-400">{r.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div>
          <div className="text-sm font-semibold mb-2">Seleziona un'aula</div>
          <div className="text-xs text-slate-400">
            Clicca su un’aula nella mappa per vedere la schermata dettagliata con i sensori.
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-3">Legenda</div>
          <LegendDot color="bg-emerald-400" label="Normale" />
          <LegendDot color="bg-amber-400" label="Attenzione" />
          <LegendDot color="bg-rose-400" label="Critico" />
        </div>

        <div>
          <div className="text-sm font-semibold mb-3">Tipi di sensore</div>
          <div className="text-xs text-slate-300 space-y-2">
            <div>🌡 Temperatura</div>
            <div>🔊 Rumore</div>
            <div>💧 Umidità</div>
            <div>🌬 Qualità aria</div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* -------------------- DETAIL -------------------- */

function sensorStatus(type, value) {
  if (value == null) return "ok";

  if (type === "temperature") {
    if (value > 28) return "alert";
    if (value > 26) return "warning";
  }

  if (type === "noise") {
    if (value > 70) return "alert";
    if (value > 60) return "warning";
  }

  if (type === "air") {
    if (value > 700) return "alert";
    if (value > 600) return "warning";
  }

  if (type === "humidity") {
    if (value > 75 || value < 25) return "alert";      // troppo alta o troppo bassa
    if (value > 65 || value < 30) return "warning";    // fuori comfort
  }

  return "ok";
}


function RoomDetail({ room, metrics, onBack }) {
  const temp = metrics.temperature;
  const noise = metrics.noise;     // 👈 AGGIUNTO
  const hum = metrics.humidity;
  const air = metrics.airppm;

  const tempLabel = temp == null ? "--" : `${round1(temp)}°C`;
  const noiseLabel = noise == null ? "--" : `${round1(noise)} dB`;
  const humLabel = hum == null ? "--" : `${hum}%`;
  const airLabel = air == null ? "--" : `${air}ppm`;

  // livello aula (0=ok, 1=warning, 2=alert)
const levelTemp = temp != null ? (temp > 28 ? 2 : temp > 26 ? 1 : 0) : 0;
const levelNoise = noise != null ? (noise > 70 ? 2 : noise > 60 ? 1 : 0) : 0;
const levelAir = air != null ? (air > 700 ? 2 : air > 600 ? 1 : 0) : 0;

// livello massimo tra i sensori
const roomLevel = Math.max(levelTemp, levelNoise, levelAir); // 0 ok, 1 warning, 2 alert

const sidebarClass =
  roomLevel === 2
    ? "bg-rose-900/30 border-rose-600"
    : roomLevel === 1
    ? "bg-amber-900/30 border-amber-600"
    : "bg-slate-900/60 border-slate-800";


  return (
    <div className="grid grid-cols-4 gap-6">
      {/* MAIN */}
      <div className="col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <button
          onClick={onBack}
          className="text-slate-300 hover:text-white text-sm flex items-center gap-2 mb-4"
        >
          <ChevronLeft size={18} />
          Torna alla mappa
        </button>

        <div className="text-center mb-4">
          <div className="text-xl font-semibold">{room.id}</div>
          <div className="text-sm text-slate-400">{room.floorName}</div>
        </div>

        {/* “Piantina aula” simulata (stile screenshot) */}
        <div className="mx-auto max-w-2xl bg-slate-950/60 border border-slate-800 rounded-2xl p-6">
          <div className="relative h-[360px] rounded-xl bg-slate-950/40 border border-slate-800 overflow-hidden">
            {/* banchi/elementi */}
            <div className="absolute left-16 top-20 grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-16 rounded-lg bg-slate-800/35 border border-slate-700/40"
                />
              ))}
            </div>

            <div className="absolute right-16 top-20 grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-16 rounded-lg bg-slate-800/35 border border-slate-700/40"
                />
              ))}
            </div>

            {/* SENSOR BUBBLES */}
            <SensorBubble
              label={tempLabel}
              sublabel="Temperatura"
              icon={<Thermometer size={16} />}
              x="12%"
              y="18%"
            />

            <SensorBubble
              label={noiseLabel}
              sublabel="Rumore"
              icon={<Waves size={16} />}
              x="18%"
              y="70%"
            />

            <SensorBubble
              label={humLabel}
              sublabel="Umidità"
              icon={<Droplets size={16} />}
              x="46%"
              y="24%"
            />

            <SensorBubble
              label={airLabel}
              sublabel="Qualità Aria"
              icon={<Wind size={16} />}
              x="78%"
              y="46%"
            />

            {/* porta */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 tracking-widest">
              PORTA
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className={`${sidebarClass} border rounded-2xl p-6 space-y-4 transition-all duration-300`}>

        <div className="text-sm font-semibold">DETTAGLI AULA</div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
          <div className="text-sm font-semibold">{room.id}</div>
          <div className="text-xs text-slate-400">{room.floorName}</div>
        </div>

        <div className="text-xs text-slate-400 font-semibold mt-2">SENSORI</div>

        <SensorCard
          title="Temperatura"
          value={tempLabel}
          status={sensorStatus("temperature", temp)}
          icon={<Thermometer size={16} />}
        />


        <SensorCard
          title="Rumore"
          value={noiseLabel}
          status={sensorStatus("noise", noise)}
          icon={<Waves size={16} />}
        />


          <SensorCard
            title="Umidità"
            value={humLabel}
            status={sensorStatus("humidity", hum)}
            icon={<Droplets size={16} />}
          />


          <SensorCard
            title="Qualità Aria"
            value={airLabel}
            status={sensorStatus("air", air)}
            icon={<Wind size={16} />}
          />
      </div>
    </div>
  );
}

/* -------------------- UI bits -------------------- */

function StatCard({ icon, title, value }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-slate-400">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      <div className="text-slate-400">{icon}</div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-300 mb-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function SensorCard({ title, value, icon, status = "ok" }) {
  const colors = {
    ok: "bg-slate-950/60 border border-slate-800",
    warning: "bg-amber-900/30 border border-amber-600",
    alert: "bg-rose-900/30 border border-rose-600",
  };

  const valueColor = {
    ok: "text-emerald-300",
    warning: "text-amber-300",
    alert: "text-rose-400",
  };

  return (
    <div className={`rounded-xl p-4 flex items-center justify-between transition-all duration-300 ${colors[status]}`}>
      <div className="flex items-center gap-2 text-sm text-slate-300">
        {icon}
        {title}
      </div>
      <div className={`text-lg font-semibold ${valueColor[status]}`}>
        {value}
      </div>
    </div>
  );
}

function SensorBubble({ label, sublabel, icon, x, y }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <div className="relative">
        <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 text-xs font-semibold text-center">
          {label}
        </div>
        <div className="mx-auto mt-2 h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-100">
          {icon}
        </div>
      </div>
      <div className="text-[10px] text-slate-400 text-center mt-1">
        {sublabel}
      </div>
    </div>
  );
}
