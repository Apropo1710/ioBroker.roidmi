# ioBroker Roidmi Adapter

Eigenständiger ioBroker-Adapter zur lokalen Steuerung und Überwachung von Roidmi-Saugrobotern, mit Schwerpunkt auf dem Roidmi EVE Plus.

> **Projektstatus:** Frühe Testversion. Build und automatisierte Tests sind erfolgreich. Die Kommunikation und Steuerbefehle müssen noch am realen Roidmi EVE Plus bestätigt werden. Bitte vor der Installation ein ioBroker-Backup erstellen.

## Installation zum Testen über ioBroker Admin

Der Adapter ist noch nicht im offiziellen ioBroker-Repository gelistet. Er kann für Tests direkt aus GitHub installiert werden:

1. ioBroker Admin öffnen und zum Reiter **Adapter** wechseln.
2. Oben in der Werkzeugleiste **Aus eigener Quelle installieren** öffnen (Octocat-Symbol).
3. **Von GitHub** auswählen.
4. Als Repository **Apropo1710/ioBroker.roidmi** eintragen und die Installation starten.
5. Anschließend die neue Instanz **Roidmi** hinzufügen bzw. deren Konfiguration öffnen.

Die Installation aus GitHub ist eine Entwicklungsversion und erhält keine Prüfung wie ein Eintrag im Stable-Repository. Nicht auf einem produktiven System ohne aktuelles Backup installieren.

## Konfiguration

- **Robot IP address:** lokale IPv4-Adresse des Roboters.
- **Xiaomi device DID:** numerische Xiaomi-Geräte-ID (DID).
- **MIoT / miIO token:** 32-stelliger Token (wird in ioBroker verschlüsselt gespeichert).
- **Polling interval:** Abfrageintervall in Sekunden, Standard 30; zulässig sind 5 bis 3600 Sekunden.

Ohne gültige IP-Adresse, DID und Token startet der Adapter, bleibt aber getrennt und zeigt den Grund unter `info.connectionText` an.

## Xiaomi X20+ – IP-Adresse, DID und Token

- **IP-Adresse:** in der Geräteliste des Routers (DHCP) oder in Xiaomi Home nachsehen; für eine stabile Verbindung empfiehlt sich eine feste DHCP-Zuweisung.
- **DID und miIO-Token:** können üblicherweise mit dem [Xiaomi Cloud Tokens Extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor) aus den Xiaomi-Home-Gerätedaten ermittelt werden. Bitte dessen aktuelle Anleitung lesen und die richtige Xiaomi-Konto-Region wählen. Je nach Android-/Mi-Home-Version kann ein unterstütztes Backup-/Extraktionsverfahren notwendig sein.
- Der **Token ist ein Geheimnis** (normalerweise 32 Hex-Zeichen). Niemals in Chats, Screenshots, GitHub, Issues oder Logs veröffentlichen. Nur in der lokalen Adapterkonfiguration eintragen; ioBroker speichert ihn verschlüsselt.
- DID und Token gehören zum jeweiligen Gerät. Beim parallelen Betrieb von Roidmi EVE Plus und Xiaomi X20+ die getrennten Felder verwenden.

## Optionale Xiaomi-Cloud-Kartenerkennung

Die Xiaomi-Cloud-Anbindung ist **optional** und standardmäßig ausgeschaltet. Sie wird ausschließlich benötigt, um die gespeicherte Karte sowie Raum-IDs und Raumnamen automatisch aus dem Xiaomi-Konto abzurufen. Ohne diese Funktion bleiben lokale Statusabfragen und die lokale Robotersteuerung nutzbar. Die Cloud wird nicht periodisch abgefragt: Der Abruf startet nur, wenn `control.refreshMap` manuell ausgelöst wird. Xiaomi-Benutzername und Passwort werden nur bei aktivierter Funktion verwendet und in ioBroker verschlüsselt gespeichert. Je nach Xiaomi-Konto kann eine Zwei-Faktor-Bestätigung erforderlich sein.

## Ziele

- Lokale Verbindung zum Roidmi EVE Plus, soweit das Gerät sie unterstützt
- Status, Akku, Ladezustand und Reinigungszustand
- Start, Pause, Fortsetzen und Rückkehr zur Ladestation
- Saug- und Wischparameter
- Raum-/Zonenreinigung sowie Karten-/Verlaufsdaten, sofern verfügbar
- Saubere Trennung zwischen lokalen und Cloud-Funktionen

## Sicherheit und Belastung

MIoT-/miIO-Zugangsdaten und Tokens dürfen niemals eingecheckt oder in Logs ausgegeben werden. Zugangsdaten gehören ausschließlich in die Adapterkonfiguration bzw. geschützte Laufzeitdaten.

Die Statusabfrage erfolgt standardmäßig alle 30 Sekunden. Alle sieben aktuell unterstützten Status- und Einstellungswerte werden in einer gebündelten MIoT-Anfrage gelesen. Dadurch sinkt die Zahl der Status-RPCs pro Polling-Zyklus von sieben auf eine. Polling-Zyklen überlappen nicht; bei Fehlern verlängert der Adapter das Intervall automatisch. Zeitpläne werden nur auf ausdrückliche Anforderung gelesen und sind nicht Teil des regelmäßigen Pollings.

## Entwicklungsstand

Siehe [Projektplan](docs/PROJECT_PLAN.md), [Architektur](docs/ARCHITECTURE.md), [Protokollnotizen](docs/PROTOCOL_NOTES.md) und [Raumimport](docs/ROOM_IMPORT.md).

## Entwicklung

Voraussetzung: eine von ioBroker unterstützte Node.js-Version (Node.js 20 oder neuer).

```bash
npm install
npm test
npm run build
```

Das `prepare`-Skript baut die TypeScript-Dateien auch bei einer Installation direkt aus dem Git-Repository. Die Gerätekommunikation und die Befehle müssen weiterhin gegen ein reales Gerät validiert werden.
