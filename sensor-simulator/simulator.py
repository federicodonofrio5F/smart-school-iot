import json
import math
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER = "broker.hivemq.com"
TOPIC = "school/SmartSchool/sensors"   # <-- usa questo topic (facile da sub)
INTERVAL_SECONDS = 2

ROOMS = [
    {"floor": 1, "room": "Aula 1A"},
    {"floor": 1, "room": "Aula 1B"},
    {"floor": 1, "room": "Aula 1C"},
    {"floor": 1, "room": "Aula 1D"},
    {"floor": 1, "room": "Aula 1E"},
    {"floor": 1, "room": "Aula 1F"},
    {"floor": 1, "room": "Laboratorio Chimica"},
    {"floor": 1, "room": "Laboratorio Fisica"},
    {"floor": 1, "room": "Aula Magna"},
    {"floor": 2, "room": "Aula 2A"},
    {"floor": 2, "room": "Aula 2B"},
    {"floor": 2, "room": "Aula 2C"},
    {"floor": 2, "room": "Aula 2D"},
    {"floor": 2, "room": "Aula 2E"},
    {"floor": 2, "room": "Aula 2F"},
    {"floor": 2, "room": "Laboratorio Informatica"},
    {"floor": 2, "room": "Biblioteca"},
    {"floor": 2, "room": "Palestra"},
]

HOT_ROOMS = {"Laboratorio Informatica", "Aula 2E", "Aula 1C", "Aula Magna"}
LOUD_ROOMS = {"Palestra", "Aula Magna"}

def iso_now():
    return datetime.now(timezone.utc).isoformat()

def realistic_temperature(hour, floor, room):
    base = 20.0 + (floor - 1) * 0.6
    daily = math.sin((hour / 24.0) * math.pi) * 5.0
    t = base + daily + (random.random() - 0.5) * 0.8
    if room in HOT_ROOMS:
        t += 2.5
    if random.random() < 0.06:  # picco
        t += 3.0
    return round(t, 1)

def realistic_noise(hour, room):
    is_break = 10 <= hour <= 11
    is_lesson = 8 <= hour <= 13
    n = 35.0
    if is_lesson:
        n = 45.0
    if is_break:
        n = 68.0
    if room in LOUD_ROOMS:
        n += 12.0
    if random.random() < 0.08:  # picco
        n += 18.0
    n += random.random() * 10.0
    return round(n, 1)

def realistic_humidity():
    # comfort ~ 30-65, ma ogni tanto esce
    h = 45 + (random.random() - 0.5) * 20
    if random.random() < 0.05:
        h += 25
    if random.random() < 0.05:
        h -= 25
    return int(max(10, min(90, round(h))))

def realistic_airppm(room):
    # simuliamo "CO2/aria" in ppm
    base = 500 + random.randint(-40, 80)
    if room in {"Aula Magna", "Biblioteca"}:
        base += 150
    if random.random() < 0.06:
        base += 300
    return int(max(350, min(2000, base)))

def publish_sensor(client, school, floor, room, s_type, value, unit):
    payload = {
        "school": school,
        "floor": floor,
        "room": room,
        "type": s_type,
        "value": value,
        "unit": unit,
        "timestamp": iso_now()
    }
    client.publish(TOPIC, json.dumps(payload), qos=0, retain=False)

def main():
    school = "SmartSchool"

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(BROKER, 1883, 60)
    client.loop_start()

    print("✅ Python simulator connected to MQTT:", BROKER)
    print("Publishing to:", TOPIC)

    try:
        while True:
            now = datetime.now()
            hour = now.hour

            for r in ROOMS:
                floor = r["floor"]
                room = r["room"]

                temp = realistic_temperature(hour, floor, room)
                noise = realistic_noise(hour, room)
                hum = realistic_humidity()
                air = realistic_airppm(room)

                publish_sensor(client, school, floor, room, "temperature", temp, "C")
                publish_sensor(client, school, floor, room, "noise", noise, "dB")
                publish_sensor(client, school, floor, room, "humidity", hum, "%")
                publish_sensor(client, school, floor, room, "airppm", air, "ppm")

            time.sleep(INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
