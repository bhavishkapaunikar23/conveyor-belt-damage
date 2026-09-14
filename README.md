# Pulse-Mine AI

Conveyor belt health monitoring dashboard for iron ore mines, built for SIH (Problem Statement 26008 — Belt Joint Rupture and Conveyor Belt Damages in Iron Ore Mining Industry).

## Why we built this

Conveyor belts in mines run 24/7 under heavy load, dust, and constant vibration. Belt joints especially take a beating — cracks, wear, spillage, splice failure — and most of the time nobody notices until the belt actually rips or spills material everywhere. Inspections happen on a fixed schedule (like once a week), which means a joint can go from fine to failing in between checks and nobody knows until it's too late.

We wanted to build something that watches the belt continuously instead — combining sensor data and camera footage — and flags problems early enough that maintenance teams can actually do something about it before a breakdown happens.

## What it does

The dashboard pulls together a few things:

- **9 sensor readings** per belt — temperature, vibration, overload, motor current, belt speed, acceleration, looseness, bearing condition, and how often it starts/stops. Each one has its own normal/warning/critical range.
- **Camera inspection** — you can upload a video (or use a webcam) and it'll analyze the frames on its own, looking for material spillage, cracks/tears, and edge wear. No manual tagging needed, it runs the analysis live.
- **A 3D digital twin** of the conveyor that you can rotate around — the joints glow different colors depending on what the sensors + camera are currently picking up.
- **A basic diagnosis layer** — instead of just saying "vibration is high," it tries to figure out *why* (is the load also high? then it's probably overload; if load's normal, it's more likely misalignment).
- Alerts, sound notifications, and historical trend charts.

We also built in a rough SCADA/PLC integration page since real mines already have that infrastructure — right now it's simulated since we don't have access to actual plant hardware, but the idea is the same data pipeline would work with real Modbus/OPC-UA feeds later.

## Running it

You'll need Node.js installed. Then:

```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
npm install --legacy-peer-deps
npm run dev
```

The `--legacy-peer-deps` flag is needed because of a version clash between React and the 3D libraries (`@react-three/fiber` / `drei`) — without it npm throws a dependency resolution error.

Once it's running, it'll print a localhost link in the terminal, open that in your browser.

To test the camera detection, just go to the Camera Inspection tab and upload any conveyor belt video — there's also a manual "simulate" option if you want to demo specific conditions without depending on the video timing.

## Honest limitations

Since we don't have real mine sensor data or an actual physical conveyor to test on, a lot of the sensor readings are simulated rather than coming from real hardware. The camera detection uses frame-based anomaly detection (edge/pattern analysis) rather than a fully trained deep learning model, since we didn't have a labeled dataset of belt defects to train on. We're upfront about this in our presentation — the architecture is built so real sensors/cameras/PLC data could plug in later without changing how the rest of the system works.

We also deliberately avoided showing a specific "will fail in X days" prediction, since we don't have real failure data to back that up — instead we show risk levels (Low/Medium/High/Critical) based on trend direction, which felt more honest.

## Tech stack

React + TypeScript on the frontend, Three.js (via react-three-fiber) for the 3D twin, Recharts for graphs, Node.js backend. Built with Vite.

---

Built for Smart India Hackathon.
