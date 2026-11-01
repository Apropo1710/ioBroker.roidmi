# ioBroker Roidmi Adapter

Eigenständiger ioBroker-Adapter zur lokalen Steuerung und Überwachung von Roidmi-Saugrobotern, mit Schwerpunkt auf dem Roidmi EVE Plus.

> **Projektstatus:** Entwicklung und Protokollvalidierung. Eine funktionierende Verbindung und Steuerung müssen noch am realen Gerät bestätigt werden.

## Ziele
- Lokale Verbindung zum Roidmi EVE Plus, soweit das Gerät sie unterstützt
- Status, Akku, Ladezustand und Reinigungszustand
- Start, Pause, Fortsetzen und Rückkehr zur Ladestation
- Saug- und Wischparameter
- Raum-/Zonenreinigung sowie Karten-/Verlaufsdaten, sofern verfügbar
- Saubere Trennung zwischen lokalen und Cloud-Funktionen

## Sicherheit
MIoT-/miIO-Zugangsdaten und Tokens dürfen niemals eingecheckt oder in Logs ausgegeben werden. Zugangsdaten gehören ausschließlich in die Adapterkonfiguration bzw. geschützte Laufzeitdaten.

## Entwicklungsstand
Siehe [Projektplan](docs/PROJECT_PLAN.md), [Architektur](docs/ARCHITECTURE.md) und [Protokollnotizen](docs/PROTOCOL_NOTES.md).

## Entwicklung
Voraussetzung: eine von ioBroker unterstützte Node.js-Version.

```bash
npm install
npm test
npm run build
```

Die konkrete ioBroker-Adapterintegration und die Gerätekommunikation werden schrittweise ergänzt und gegen ein reales Gerät validiert.
