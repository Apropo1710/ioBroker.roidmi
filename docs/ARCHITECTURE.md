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


## Performance- und Polling-Leitlinien

Ziel ist eine möglichst geringe Datenlatenz bei minimaler Last für Roboter und ioBroker.

- Das konservative V60-Profil liest aktuell eine Property je `get_properties`-RPC, weil die verfügbare Gerätebeschreibung `maxProperties: 1` nennt. Erst wenn das konkrete Gerät Mehrfachabfragen nachweislich unterstützt, werden Properties gebündelt.
- Polling standardmäßig moderat (30 Sekunden); die Frequenz muss konfigurierbar bleiben.
- Keine überlappenden Polling-Durchläufe: der nächste Lauf wird erst nach Abschluss des vorherigen geplant.
- Bei erfolgreicher Abfrage nur geänderte Werte mit `setStateChangedAsync` schreiben, damit unnötige Datenbank- und Event-Last vermieden wird.
- Bei Verbindungsfehlern exponentiell zurückschalten, mit Obergrenze von fünf Minuten; nach erfolgreicher Abfrage zum normalen Intervall zurückkehren.
- Wiederholte identische Fehler nicht in jedem Poll-Zyklus erneut protokollieren.
- Schnelle Statuswerte (Roboterzustand, Fehler) und langsam veränderliche Werte (z. B. Wartungs-/Lebensdauerwerte) später in getrennte Polling-Gruppen mit unterschiedlichen Intervallen aufteilen.
- Karten, Historie und umfangreiche Daten nur bei Bedarf oder bei expliziter Aktualisierung laden, nicht im normalen Status-Polling.
- Keine unnötigen Objekte/Datenpunkte pro Poll neu anlegen.
- Polling-Takt, Anzahl der RPC-Aufrufe und Antwortzeiten später messbar machen, ohne Tokens oder sensible Nutzdaten zu protokollieren.

Die aktuelle Implementierung liest vier Basis-Eigenschaften nacheinander mit je einem RPC, schreibt nur geänderte Werte und verwendet ein nicht überlappendes Polling mit Fehler-Backoff. Die Intervalle werden anhand echter Geräteantworten weiter optimiert.
