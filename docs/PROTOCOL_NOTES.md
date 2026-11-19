# Protokollnotizen

Technische Referenz für beide Roboter: MIoT-Zuordnungen, Datenformate und am Gerät gewonnene Erkenntnisse.
„Bestätigt“ heißt: am realen Gerät des Nutzers getestet. Die Firmware-Stände der Testgeräte sind nicht erfasst; Bitlagen und Formate gelten deshalb nur für diese Geräte sicher.

## Allgemein (miIO / MIoT)

- MIoT-Aufrufe brauchen die numerische Xiaomi-**DID**. Sie ist nicht identisch mit der Geräte-ID im lokalen miIO-Header und wird nicht daraus abgeleitet.
- Lokale Kommunikation: UDP 54321, Handshake → verschlüsselter RPC → Antwort. Timeout 4 s.
- MIoT-Antworten werden über `siid`/`piid` zugeordnet, nicht über die Reihenfolge.
- Xiaomi Cloud, MIoT-Lesen: `datasource: 1` bevorzugt den Server-Cache und kann veraltet sein; `datasource: 2` fragt das Gerät direkt. Für Prüfungen nach dem Schreiben wird immer `datasource: 2` verwendet.
- Cloud-Fehler `-704220025` bedeutet „action arguments count mismatch“.

## Roidmi EVE Plus (`roidmi.vacuum.v60`)

Spec: https://home.miot-spec.com/spec?type=urn:miot-spec-v2:device:vacuum:0000A006:roidmi-v60:3

### Aktionen

| Funktion | SIID / AIID | Eingaben | Stand |
|---|---|---|---|
| Ganze Karte reinigen | 14 / 1 | `[1, ""]` | bestätigt |
| Raumreinigung | 14 / 1 | `[2, JSON.stringify({ mapId, segmentId: [ids] })]` | bestätigt |
| Pause | 8 / 8 | – | bestätigt |
| Fortsetzen | 8 / 5 | – | nicht separat bestätigt |
| Zur Ladestation | 3 / 1 | – | bestätigt |
| Stopp | 2 / 2 | – | implementiert |

Mehrere Räume stehen als mehrere IDs im selben `segmentId`-Array. Die `mapId` stammt aus der Cloud-Karte (oder einmalig manuell, siehe `ROOM_IMPORT.md`).

### Properties

| Wert | SIID / PIID | Werte |
|---|---|---|
| Roboterstatus | 2 / 1 | siehe unten |
| Fehlercode | 2 / 2 | 0–25 laut Spec (`roidmi-status.ts`) |
| Saugstufe | 2 / 4 | 0 Aus, 1 Leise, 2 Standard, 3 Stark, 4 Maximal |
| Reinigungsart | 2 / 8 | 0 Saugen, 1 Wischen (Spec nennt bis 2; Bedeutung von 2 offen) |
| Akku | 3 / 1 | % |
| Ladestatus | 3 / 2 | siehe unten |
| Wischaufsatz vorhanden | 8 / 1 | |
| Wasserstufe | 8 / 11 | 0 Aus, 1 Niedrig, 2 Mittel, 3 Maximal, 4 Zusatzstufe |
| Doppelte Reinigung | 8 / 20 | 0/1 |
| Wischmuster | 13 / 8 | 0 Normal, 1 Y-Weg, 2 Wiederholen |
| Individuelle Raumeinstellungen | 13 / 7 | 0/1 |
| Zeitpläne | 8 / 6 | JSON, siehe unten |
| Verbrauchsmaterial | 10–12, 15 | Lebensdauer % (PIID 2) und Restzeit (PIID 1) |

Polling: höchstens 6 Properties pro `get_properties`-RPC. Größere Bündel verwirft die Firmware.

### Status-Rohwerte (empirisch)

| Status (2/1) | Ladestatus (3/2) | Beobachtung |
|---:|---:|---|
| 9 | 1 | angedockt, voll geladen |
| 4 | 2 | Reinigung läuft |
| 3 | 2 | nach Ende/Unterbrechung außerhalb der Station |
| 5 | 2 | Rückfahrt zur Station (vorläufig) |
| 6 | 1 | nach dem Andocken während der Staubabsaugung (vorläufig) |

Ladestatus 1 tritt angedockt bei 99 % und 100 % auf und bedeutet daher nicht sicher „lädt“. Unbekannte Werte bleiben als Rohwert sichtbar.

### Karte und Raumprofile

- Das Cloud-Kartenarchiv (Map-Key `0`) ist gzip-komprimiert. Nach 16 Byte Präfix und dem Rasterbereich markiert `0x7f` den Beginn der JSON-Metadaten (`width`, `height`, `resolution`, `autoArea` …).
- Raumprofile (`fanLevel`, `waterPump`, `cleanOrder`) stehen in den Kartenmetadaten und werden beim Kartenabruf gelesen. Der Roboter wendet sie auch bei einer über den Adapter gestarteten Raumreinigung an.
- Lokales `get_map_v1` wird bewusst nicht aufgerufen (Firmware antwortete mit `-9999: user ack timeout`).
- Raumprofile **schreiben** ist bewusst nicht vorgesehen: Sie werden ausschließlich in der Xiaomi-App gepflegt, der Adapter liest sie nur. (Zur Information: Die Spec nennt SIID 13 / AIID 10 `area-custom` und SIID 13 / AIID 11 `map-area-order`; das Payload-Format ist unbekannt.)

### Zeitpläne (SIID 8 / PIID 6)

- JSON-Wurzel `{ "time": [...], "tz": …, "tzs": … }`.
- Eintrag: `[Sekunden ab Mitternacht, aktiviert, Saugstufe, Reinigungsart, [Wochentage 0=So…6=Sa], Wasserstufe, [Raum-IDs], letztes Feld]`. Beispiel: 35280 = 09:48.
- Aktiviert = 1, deaktiviert = 0. Das letzte Feld und unbekannte Zusatzfelder werden unverändert erhalten.
- Schreiben ersetzt die komplette Property. Deshalb: frisch lesen → mit dem angezeigten Stand vergleichen (bei Abweichung abbrechen) → nur angeforderte Felder ändern → schreiben → zurücklesen → prüfen, dass nur diese Felder geändert wurden. Kein automatischer Wiederholungsversuch.
- Neuanlage und Löschen sind nicht implementiert.

### Quellen

- openHAB-Profil: https://github.com/openhab/openhab-addons/blob/main/bundles/org.openhab.binding.miio/src/main/resources/database/roidmi.vacuum.v60-miot.json
- python-miio (Zeitplanformat): https://python-miio.readthedocs.io/en/latest/_modules/miio/integrations/roidmi/vacuum/roidmivacuum_miot.html
- Raumreinigungs-Workflow: https://community.home-assistant.io/t/roidmi-eva-integration/450084/8

## Xiaomi X20+ (`xiaomi.vacuum.c102gl`)

Spec: https://home.miot-spec.com/spec?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1
Hardwaregetestete Referenz: https://github.com/ilirdokle43/HA-Xiaomi-Vacuum-Local

### Aktionen

| Funktion | SIID / AIID | Stand |
|---|---|---|
| Start / Fortsetzen | 2 / 1 | bestätigt |
| Pause | 2 / 2 | bestätigt (ein separates „Stopp“ verhielt sich identisch und wurde entfernt) |
| Zur Ladestation | 3 / 1 | bestätigt |
| Raumreinigung | 4 / 1 | bestätigt, siehe unten |
| Verbrauchsmaterial zurücksetzen | 9, 10, 11, 18 / 1 | implementiert |

### Properties

| Wert | SIID / PIID | Hinweis |
|---|---|---|
| Status | 2 / 1 | Texte in `xiaomi-x20plus-profile.ts` |
| Fehler | 2 / 2 | |
| Saugleistung | 2 / 3 | 0–3 |
| Akku / Ladestatus | 3 / 1, 3 / 2 | |
| Arbeitsmodus, Dauer, Fläche | 4 / 1, 4 / 2, 4 / 3 | |
| Reinigungseinstellungen (gepackt) | 4 / 23 | Reinigungsart und Wasserstufe, siehe unten |
| Teppich-Boost | 4 / 12 | `uint8` 0/1 – boolescher Wert wird beim Schreiben in 0/1 umgewandelt |
| Fortsetzen nach Laden | 4 / 11 | |
| Kindersicherung | 4 / 27 | |
| Verbrauchsmaterial | 9, 10, 11, 18 | alle 5 Minuten |
| Lebenszeitwerte | 12 / 1–4 | |
| Zeitpläne | 8 / 2 | über Xiaomi Cloud, siehe unten |

Die Firmware verwirft zu große `get_properties`-Antworten ohne Fehlermeldung; deshalb wird in kleinen Gruppen gelesen.

### Gepackte Reinigungseinstellungen (SIID 4 / PIID 23)

- **Reinigungsart:** Bits 0–1 (`& 0x03`): 0 Saugen und Wischen, 1 Wischen, 2 Saugen, 3 Saugen vor Wischen (Zuordnung wie in `x20Plus.control.cleaningMode`).
- **Wasserstufe:** Bits 16–17 (`(raw >>> 16) & 0x03`): 1, 2, 3 = Grad 1, 2, 3. Rohwerte aus der App: `0x10801`, `0x20801`, `0x30801`.
- Beim Schreiben nur die betroffenen Bits ersetzen, den Rest erhalten und danach zurücklesen. Die frühere Property 4 / 5 (`mop-mode`) zeigt nicht den Wert aus der App und wird nicht verwendet.

### Raumreinigung (SIID 4 / AIID 1)

- Nur **lokal** möglich. Die Firmware erwartet zwei Eingaben, die veröffentlichte Spec nur eine; die Cloud lehnt den Aufruf deshalb mit `-704220025` ab.
- RPC-Umschlag wie in der Referenz: `method: "action"`, `params: { did, siid: 4, aiid: 1, in: [{ piid: 1, value: 18 }, { piid: 10, value: JSON.stringify({ selects }) }] }`. Ein verschachtelter `miIO.miotspecv2`-Aufruf bleibt unbeantwortet.
- `selects` ist eine Zeile pro Raum: `[segmentId, Wiederholungen, Saugleistung, Wasser, 1]`. Der fünfte Wert muss in **jeder** Zeile `1` sein; mit fortlaufenden Werten (1, 2, 3 …) wählt der Roboter nur den ersten Raum.
- Bestätigt mit einem, zwei, drei und mehr Räumen sowie in „Saugen vor Wischen“ und „Saugen und Wischen gleichzeitig“.
- Vor dem Senden setzt der Adapter die Reinigungsart (Bits 0–1 in 4 / 23) und prüft sie. Für die Raumreinigung wird ein frischer Handshake erzwungen.
- Die Aktionsantwort `code: 0` bestätigt nur den Empfang; der Adapter beobachtet danach den Status, um den tatsächlichen Start festzustellen.
- Segment-IDs kommen aus der Cloud-Karte (`x20Plus.rooms.roomsJson`). Die Kartenbeschriftung in Xiaomi Home („Raum 5“) ist nicht die Segment-ID. Segmente ohne zugeordneten Raum (Außenflächen, Fenster) werden herausgefiltert.

### Zeitpläne (SIID 8 / PIID 2, Xiaomi Cloud)

- Mehrere Einträge, durch `;` getrennt; jeder Eintrag hat 9 Felder, durch `-` getrennt:
  `ID-aktiviert-HH:MM-Wochentage-Wasser-Saugleistung-Reinigungsart-Räume-…`
- Beispiel: `2-0-10:00-1001011-1-1-1-64-0`
- **Aktiviert:** 1 = ein, 0 = aus.
- **Wochentage:** 7-stellige Bitfolge, Positionen von links So, Mo, Di, Mi, Do, Fr, Sa; `0000000` = einmalig. `1001011` = So, Mi, Fr, Sa.
- **Wasser:** 0 automatische Anpassung, 1 niedrig, 2 mittel, 3 hoch.
- **Reinigungsart (Feld 7):** 16 Saugen, 32 Saugen und Wischen, 48 Wischen, 64 Saugen vor Wischen. Unbekannte Werte bleiben als „unbekannt“ sichtbar.
- **Räume:** `0` = alle Bereiche.
- Ändern (Aktivieren/Deaktivieren oder einzelne Felder): direkt vom Gerät lesen (`datasource: 2`) → nur den gewählten Eintrag ändern → schreiben → direkt zurücklesen und strukturell prüfen. Läuft das Zurücklesen in einen Timeout, wird das als „Bestätigung ausstehend“ gemeldet, nicht als Fehler.
- Löschen (SIID 8 / AIID 1) und Neuanlage sind nicht implementiert.
