# Architektur (vorläufig)

## Leitlinien
- TypeScript/Node.js als Laufzeit; keine Python-Laufzeitabhängigkeit.
- Geräteprotokoll in einer eigenen Schicht kapseln.
- Zugangsdaten nie loggen und nie versionieren.
- Erst Read-only validieren, danach schreibende Befehle freigeben.
- Jede Gerätefähigkeit als `supported`, `unsupported` oder `unknown` kennzeichnen.
- Lokale und Cloud-Funktionen nicht vermischen.

## Geplante Schichten
1. ioBroker-Adapter-Lifecycle und Konfiguration
2. Connection Manager (Timeouts, Reconnect, Backoff)
3. MIoT/miIO Transport und Nachrichtenkodierung
4. Gerätefähigkeiten und Mapping auf ioBroker-States
5. optionale Karten-/Raum-/Verlaufserweiterungen

Die konkrete Implementierung wird erst nach Validierung der realen Geräteantworten festgelegt.
