# Architektur

## Überblick

Ein ioBroker-Adapter (TypeScript, Node.js ≥ 20, keine Python-Abhängigkeit) betreibt zwei Roboter in einer Instanz. Jeder Roboter hat eigene Zugangsdaten, einen eigenen Objektbaum (`evePlus.*`, `x20Plus.*`) und einen eigenen Poll-Timer. Ein Fehler bei einem Roboter setzt den anderen weder auf „getrennt“ noch stoppt er dessen Polling. `info.connection` auf Instanzebene ist nur dann `true`, wenn alle aktivierten Roboter erreichbar sind; deaktivierte Roboter zählen nicht.

```text
src/main.ts                     Adapter-Lifecycle, Objekte, Polling, Befehle beider Roboter
src/lib/
  config.ts                     Validierung der Instanzkonfiguration (IPv4, DID, Token, Intervalle)
  object-tree-migration.ts      Umzug alter flacher Datenpunkte in evePlus.* / x20Plus.*

  miio-packet.ts                miIO-Paketformat (Header, AES-Verschlüsselung, Prüfsumme)
  miio-client.ts                lokaler UDP-RPC-Client (Handshake, Timeout, Antwortzuordnung)
  device-availability.ts        Neustart-Erkennung, Einstufung von Ausfällen fürs Log, Tagesstatistik, Instanzstatus
  xiaomi-cloud-map.ts           Xiaomi-Cloud-Anmeldung (inkl. 2FA), MIoT über Cloud, Kartenabruf

  Roidmi EVE Plus
  roidmi-actions.ts             MIoT-Aktionen (Start, Pause, Fortsetzen, Station, Stopp)
  roidmi-settings.ts            schreibbare Einstellungen und Wertebereiche
  roidmi-status.ts              Status- und Fehlertexte
  roidmi-map.ts                 Parser für das Roidmi-Kartenarchiv (Räume, Raumprofile)
  room-map.ts                   Raumkonfiguration (Import, Validierung, Persistenz)
  room-cleaning.ts              Raumreinigungs-Aktion SIID 14 / AIID 1
  cleaning-schedules.ts         Zeitpläne lesen (SIID 8 / PIID 6)
  roidmi-cleaning-schedules.ts  bestehende Zeitpläne gezielt ändern und prüfen

  Xiaomi X20+
  xiaomi-x20plus-profile.ts     MIoT-Profil (Properties, Pollgruppen, Statustexte)
  xiaomi-dreame-map.ts          Parser für die Cloud-Karte des C102GL (Räume, aktive Auswahl)
  xiaomi-room-cleaning.ts       Raumreinigungs-Payload SIID 4 / AIID 1, Reinigungsart-Bits
  xiaomi-room-clean-status.ts   prüft nach dem Befehl, ob die Reinigung tatsächlich startet
  xiaomi-cleaning-schedules.ts  Zeitpläne (SIID 8 / PIID 2) lesen, schalten, bearbeiten
```

`build/` enthält das kompilierte JavaScript. Es wird nach jedem erfolgreichen CI-Lauf auf `main` automatisch neu erzeugt und committet (Workflow „Build distribution“).

## Kommunikation

- **Lokal (Standard):** miIO über UDP 54321. Alle lokalen Transaktionen beider Roboter laufen nacheinander über eine gemeinsame Warteschlange. Der X20+ verwendet den letzten Handshake wieder; die Raumreinigung erzwingt einen frischen Handshake.
- **Xiaomi Cloud (optional):** Anmeldung über die Instanzeinstellungen, Sitzung verschlüsselt in `evePlus.map.cloudSession` gespeichert. Genutzt für Karten/Räume beider Roboter, für die Zeitpläne des X20+ und – wenn eingeschaltet – für Steuerbefehle.
- MIoT-Antworten werden über SIID/PIID zugeordnet, nicht über die Reihenfolge.

## Polling und Last

- Status wird gebündelt gelesen: EVE Plus höchstens 6 Properties pro RPC, X20+ in kleinen Gruppen (die Firmware verwirft zu große Antworten).
- Langsam veränderliche Werte (Verbrauchsmaterial, optionale Einstellungen) werden seltener abgefragt.
- Polls überlappen nicht. Bei einem Timeout gibt es genau einen zweiten Versuch; schlägt auch der fehl, verlängert sich das Intervall (exponentieller Backoff, max. 5 Minuten).
- Meldung von Ausfällen: Ein einzelner fehlgeschlagener Poll wird erst beim nächsten Poll eingestuft. Hat das Gerät inzwischen neu gestartet, gibt es eine Info; sonst eine Warnung. Scheitert auch der nächste Poll, wird einmal gewarnt und die Wiederherstellung als Info gemeldet.
- Nur geänderte Werte werden geschrieben (`setStateChangedAsync`).
- Karten und Zeitpläne gehören nicht ins Status-Polling. Zeitpläne werden manuell oder über einen eigenen, optionalen Timer pro Roboter abgerufen.

## Schreibende Aktionen

- Einstellungen und Zeitpläne: aktuellen Wert lesen → nur die gewünschten Felder/Bits ändern → schreiben → gezielt zurücklesen. ioBroker-States werden erst nach bestätigtem Readback aktualisiert.
- Gepackte Werte (X20+ SIID 4 / PIID 23) werden bitgenau geändert; andere Bits bleiben erhalten.
- Nicht idempotente Befehle (Start, Raumreinigung) werden bei einem Timeout nicht wiederholt. Der Status meldet dann „Ausgang unbekannt“.

## Sicherheit

- Token, Cloud-Passwort und Cloud-Sitzung werden verschlüsselt gespeichert (`encryptedNative`, `protectedNative`) und nie protokolliert.
- Keine Zugangsdaten oder persönlichen Karten-/Raumdaten in Git oder Tests.
