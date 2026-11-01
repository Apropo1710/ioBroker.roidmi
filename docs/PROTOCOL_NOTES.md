# Protokollnotizen

## Bekannte Rechercheansätze
- Gerätekennung aus vorhandenen Integrationen: `roidmi.vacuum.v60`
- MIoT / miIO ist der vorrangige technische Untersuchungsansatz.
- `python-miio` enthält eine Referenzimplementierung für Roidmi-MIoT-Geräte; sie dient nur als Protokollreferenz, nicht als Laufzeitabhängigkeit.
- Home-Assistant-Beispiele deuten Raum-/Segmentaktionen über Karten- und Segmentkennungen an.
- Karten-/Verlaufsfunktionen können je nach Firmware und Cloud-Abhängigkeit eingeschränkt sein.

## Wichtige Einschränkung
Diese Hinweise sind Rechercheansätze, keine bestätigte Capability-Liste des konkreten EVE-Plus-Geräts. Nichts davon wird als unterstützt ausgegeben, bevor echte Geräteantworten geprüft wurden.

## Sicherheitsregeln
- Token niemals in Git, Screenshots oder ungeschützte Logs übernehmen.
- Bei Debug-Ausgaben Payloads mit Authentifizierungsdaten redigieren.
- Erste Tests ausschließlich lesend durchführen.
