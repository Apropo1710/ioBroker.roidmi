# ioBroker Roidmi Adapter

ioBroker-Adapter zur Steuerung und Überwachung von zwei Saugrobotern in einer Instanz:

- **Roidmi EVE Plus** (MIoT-Modell `roidmi.vacuum.v60`)
- **Xiaomi Robot Vacuum X20+** (MIoT-Modell `xiaomi.vacuum.c102gl`)

Status und Steuerung laufen lokal über miIO/MIoT (UDP 54321). Die Xiaomi Cloud ist optional und wird für Karten/Räume, die Zeitpläne des X20+ und auf Wunsch für Steuerbefehle verwendet.

Aktueller Funktions- und Teststand: [STATUS.md](STATUS.md).

> Der Adapter ist nicht im offiziellen ioBroker-Repository gelistet und wird direkt aus GitHub installiert. Vor Installation oder Update ein ioBroker-Backup erstellen.

## Installation

1. ioBroker Admin öffnen und zum Reiter **Adapter** wechseln.
2. **Aus eigener Quelle installieren** (Octocat-Symbol) → **Von GitHub**.
3. Repository `Apropo1710/ioBroker.roidmi` eintragen und installieren (Branch `main`).
4. Instanz **Roidmi** hinzufügen und konfigurieren.

Bei der Installation aus GitHub wird der TypeScript-Code automatisch gebaut (`prepare`-Skript).

## Konfiguration

Die Instanzeinstellungen haben drei Reiter:

**Geräte & Verbindung**
- Je Roboter ein Schalter zum Aktivieren sowie **IP-Adresse**, **Geräte-DID** und **MIoT-/miIO-Token** (32 Hex-Zeichen, wird verschlüsselt gespeichert).
- **Abfrageintervall** in Sekunden (Standard 30, zulässig 5–3600).
- Ohne gültige Daten startet der Adapter, der jeweilige Roboter bleibt aber getrennt; der Grund steht in `<roboter>.info.connectionText`.

**Zeitpläne**
- Je Roboter: automatischen Abruf ein/aus und Intervall (5–1440 Minuten). Standard: aus, 60 Minuten.
- EVE Plus liest lokal (SIID 8 / PIID 6), der X20+ über die Xiaomi Cloud (aktive Cloud-Sitzung nötig).

**Xiaomi Cloud** (optional)
- Benutzername, Passwort und Region des Xiaomi-Kontos. Anmeldung in zwei Schritten: Code anfordern, dann den Code aus SMS/E-Mail eingeben.
- Optional: **Steuerbefehle über Xiaomi Cloud senden** – Statusabfragen bleiben trotzdem lokal.

### IP-Adresse, DID und Token ermitteln

- **IP-Adresse:** in der Geräteliste des Routers. Eine feste DHCP-Zuweisung wird empfohlen.
- **DID und Token:** z. B. mit dem [Xiaomi Cloud Tokens Extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor). Die richtige Region des Xiaomi-Kontos wählen.
- Der Token ist ein Geheimnis: nie in Chats, Screenshots, GitHub oder Logs veröffentlichen.

## Objektbaum

```text
roidmi.0
├── info
│   └── connection true, wenn alle aktivierten Roboter erreichbar sind (Anzeige im Admin)
├── evePlus
│   ├── info       Verbindung, letzter Poll, Poll-Zähler, Verbindungsstatistik
│   ├── status     Roboterstatus, Akku, Fehler, schreibbare Einstellungen (Saugstärke, Wasser …)
│   ├── control    Start, Pause, Fortsetzen, Station, Stopp, Wartungs-Resets, Raumreinigung, Kartenabruf, Zeitpläne
│   ├── map        Cloud-Anmeldung, Karte, Raumliste, Raumprofile
│   ├── rooms      ein Unterordner je Raum mit Name, Reinigungs-Button und Raumprofil
│   └── timing     Zeitpläne (roh, dekodiert, Zusammenfassung)
└── x20Plus
    ├── info       Verbindung, letzter Poll, Poll-Zähler, Verbindungsstatistik, Rohwert der Reinigungseinstellungen
    ├── status     Roboterstatus, Akku, Verbrauchsmaterial, Einstellungen
    ├── control    Start, Pause, Station, Saugleistung, Reinigungsart, Wasserstufe, Teppich-Boost, Raumreinigung, Zeitpläne
    ├── rooms      Raumliste aus der Cloud-Karte
    └── timing     Zeitpläne (roh, dekodiert, Zusammenfassung, Status)
```

**Verbindungsstatistik** je Roboter (gleitende Zeitfenster, zählt ohne zusätzliche Abfragen):

| Datenpunkt | Bedeutung |
|---|---|
| `info.timeouts24h` / `info.timeouts7d` | Anfragen mit Zeitüberschreitung in den letzten 24 Stunden / 7 Tagen, auch solche, die der zweite Versuch aufgefangen hat – Maß für die WLAN-Qualität |
| `info.failedPolls24h` / `info.failedPolls7d` | Abfragen, die auch im zweiten Versuch gescheitert sind |
| `info.restarts24h` / `info.restarts7d` | erkannte Neustarts des Roboters |
| `info.lastRestart` | Zeitpunkt des letzten erkannten Neustarts |

Ältere Installationen mit flachen Datenpunkten (`battery`, `control.*`, `xiaomi.*` …) werden beim Start automatisch in diese Struktur verschoben.

## Raumreinigung

- **EVE Plus:** Räume über `evePlus.control.refreshMap` aus der Cloud laden; danach je Raum `evePlus.rooms.<id>.clean` oder mehrere Räume über `evePlus.control.cleanRooms` mit `{"mapId":123456,"roomIds":[1,3]}`.
- **X20+:** Räume über `x20Plus.control.refreshRooms` laden; Reinigung über `x20Plus.control.cleanRooms` mit z. B. `{"rooms":[{"segmentId":1},{"segmentId":4}]}`. Die Reinigungsart aus `x20Plus.control.cleaningMode` wird vor dem Start gesetzt und geprüft.

Details: [docs/ROOM_IMPORT.md](docs/ROOM_IMPORT.md).

## Last und Sicherheit

- Status wird gebündelt abgefragt (wenige Properties pro RPC), Polls überlappen nicht, bei Fehlern verlängert sich das Intervall automatisch.
- Nur geänderte Werte werden in ioBroker geschrieben.
- Karten werden nie im normalen Polling abgerufen.
- Schreibende Aktionen auf Einstellungen und Zeitpläne werden gezielt zurückgelesen und erst danach übernommen.
- Zugangsdaten, Tokens und Cloud-Sitzung werden verschlüsselt gespeichert und nicht protokolliert.

## Dokumentation

- [STATUS.md](STATUS.md) – aktueller Funktionsstand, offene Punkte, Projektregeln
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Aufbau des Codes
- [docs/PROTOCOL_NOTES.md](docs/PROTOCOL_NOTES.md) – MIoT-Zuordnungen und Datenformate beider Roboter
- [docs/ROOM_IMPORT.md](docs/ROOM_IMPORT.md) – Räume laden und reinigen

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run lint
npm test
npm run build
```

Bei jedem Push auf `main` laufen Lint, Tests und Build in GitHub Actions; anschließend werden die kompilierten Dateien in `build/` automatisch aktualisiert. Ein installierbares Testpaket lässt sich bei Bedarf manuell über den Workflow „Test and build adapter“ erzeugen.
