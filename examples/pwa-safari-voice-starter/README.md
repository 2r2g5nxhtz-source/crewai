# Safari PWA + Voice + CrewAI Starter

This starter is a turnkey baseline for:

- Safari/iOS installable PWA
- Voice input with Web Speech API
- Offline queue + retry behavior
- Backend endpoint for agent execution

## Structure

```text
examples/pwa-safari-voice-starter/
├── frontend/
│   ├── index.html
│   ├── app.css
│   ├── app.js
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── offline.html
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── backend/
    ├── main.py
    └── requirements.txt
```

## Local Run

1. Install backend dependencies:

```bash
cd examples/pwa-safari-voice-starter/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

3. Open:

```text
http://localhost:8080
```

## iPhone Safari Test

1. Open the deployed HTTPS URL in Safari on iPhone.
2. Tap `Share -> Add to Home Screen`.
3. Launch from Home Screen and verify standalone mode.
4. Toggle airplane mode and retry a command to test offline queue behavior.

## CrewAI Integration Mode

Backend has two modes:

- Demo mode (default): deterministic placeholder response.
- Real mode: set env variables and it will run CrewAI.

Enable real mode:

```bash
export CREWAI_REAL_MODE=1
export OPENAI_API_KEY=your_key
```

## Notes for iOS

- Keep voice start behind a direct user tap.
- Safari may suspend background work quickly.
- Use stable `request_id` for retry idempotency.
