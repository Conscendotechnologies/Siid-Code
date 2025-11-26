<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • <b>Deutsch</b> • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • [Italiano](../it/README.md) • [日本語](../ja/README.md)

</sub>
<sub>

[한국어](../ko/README.md) • [Nederlands](../nl/README.md) • [Polski](../pl/README.md) • [Português (BR)](../pt-BR/README.md) • [Русский](../ru/README.md) • [Türkçe](../tr/README.md) • [Tiếng Việt](../vi/README.md) • [简体中文](../zh-CN/README.md) • [繁體中文](../zh-TW/README.md)

</sub>
</div>
<br>

<br>
<br>

<div align="center">
<h1>Siid Code</h1>
<p align="center">
<img src="https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=Siid+Code+Demo" width="100%" alt="Siid Code Demo" />
</p>

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Download%20im%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Download im VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Bewerten%20%26%20Rezensieren-green?style=for-the-badge" alt="Bewerten & Rezensieren"></a>
</div>

**Siid Code** ist ein KI-gesteuerter **autonomer Coding-Agent**, der in Ihrem Editor lebt. Er kann:

- In natürlicher Sprache kommunizieren
- Dateien direkt in Ihrem Workspace lesen und schreiben
- Terminal-Befehle ausführen
- Browser-Aktionen automatisieren
- Mit jeder OpenAI-kompatiblen oder benutzerdefinierten API/Modell integrieren
- Seine "Persönlichkeit" und Fähigkeiten durch **Benutzerdefinierte Modi** anpassen

Ob Sie einen flexiblen Coding-Partner, einen Systemarchitekten oder spezialisierte Rollen wie einen QA-Ingenieur oder Produktmanager suchen, Siid Code kann Ihnen helfen, Software effizienter zu entwickeln.

Sehen Sie sich das [CHANGELOG](../../CHANGELOG.md) für detaillierte Updates und Fehlerbehebungen an.

---

## 🎉 Neueste Version

Siid Code 3.25 bringt mächtige neue Funktionen und bedeutende Verbesserungen, um deinen Entwicklungsworkflow zu verbessern!

- **Nachrichten-Warteschlange** - Stelle mehrere Nachrichten in die Warteschlange, während Siid Code arbeitet, damit du deinen Workflow ohne Unterbrechung weiter planen kannst.
- **Benutzerdefinierte Slash-Befehle** - Erstelle personalisierte Slash-Befehle für schnellen Zugriff auf häufig verwendete Prompts und Workflows mit vollständiger UI-Verwaltung.
- **Erweiterte Gemini-Tools** - Neue URL-Kontext- und Google-Such-Grundlagen-Funktionen bieten Gemini-Modellen Echtzeit-Web-Informationen und erweiterte Recherche-Fähigkeiten.

---

## Was kann Siid Code tun?

- 🚀 **Code generieren** aus natürlichsprachlichen Beschreibungen
- 🔧 **Refaktorieren & Debuggen** von bestehendem Code
- 📝 **Dokumentation schreiben & aktualisieren**
- 🤔 **Fragen beantworten** zu Ihrem Codebase
- 🔄 **Repetitive Aufgaben automatisieren**
- 🏗️ **Neue Dateien und Projekte erstellen**

## Schnellstart

1. Siid Code installieren
2. Ihren KI-Provider verbinden
3. Ihre erste Aufgabe ausprobieren

## Hauptfunktionen

### Mehrere Modi

Siid Code passt sich Ihren Bedürfnissen mit spezialisierten Modi an:

- **Code-Modus:** Für allgemeine Coding-Aufgaben
- **Architekten-Modus:** Für Planung und technische Führung
- **Frage-Modus:** Für Beantwortung von Fragen und Bereitstellung von Informationen
- **Debug-Modus:** Für systematische Problemdiagnose
- **Benutzerdefinierte Modi:** Erstellen Sie unbegrenzte spezialisierte Personas für Sicherheitsaudits, Leistungsoptimierung, Dokumentation oder andere Aufgaben

### Intelligente Tools

Siid Code kommt mit leistungsstarken Tools, die können:

- Dateien in Ihrem Projekt lesen und schreiben
- Befehle in Ihrem VS Code-Terminal ausführen
- Einen Webbrowser steuern
- Externe Tools über MCP (Model Context Protocol) nutzen

MCP erweitert die Fähigkeiten von Siid Code, indem es Ihnen ermöglicht, unbegrenzte benutzerdefinierte Tools hinzuzufügen. Integrieren Sie externe APIs, verbinden Sie sich mit Datenbanken oder erstellen Sie spezialisierte Entwicklungstools - MCP bietet das Framework, um die Funktionalität von Siid Code zu erweitern und Ihre spezifischen Bedürfnisse zu erfüllen.

### Anpassung

Passen Sie Siid Code nach Ihren Wünschen an mit:

- Benutzerdefinierten Anweisungen für personalisiertes Verhalten
- Benutzerdefinierten Modi für spezialisierte Aufgaben
- Lokalen Modellen für Offline-Nutzung
- Auto-Genehmigungs-Einstellungen für schnellere Workflows

## Ressourcen

### Dokumentation

- Grundlegende Nutzungsanleitung
- Erweiterte Funktionen
- Häufig gestellte Fragen

### Support

- **GitHub Issues:** [Probleme melden](https://github.com/Conscendotechnologies/Siid-Code/issues) oder [Funktionen anfragen](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Lokales Setup & Entwicklung

1. **Klonen** Sie das Repository:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Abhängigkeiten installieren**:

```sh
npm run install:all
```

3. **Webview starten (Vite/React-App mit HMR)**:

```sh
npm run dev
```

4. **Debugging**:
   Drücken Sie `F5` (oder **Ausführen** → **Debugging starten**) in VSCode, um eine neue Sitzung mit geladenem Siid Code zu öffnen.

Änderungen an der Webview erscheinen sofort. Änderungen an der Kern-Erweiterung erfordern einen Neustart des Erweiterungs-Hosts.

Alternativ können Sie eine .vsix-Datei erstellen und direkt in VSCode installieren:

```sh
npm run build
```

Eine `.vsix`-Datei erscheint im `bin/`-Verzeichnis, die mit folgendem Befehl installiert werden kann:

```sh
code --install-extension bin/siid-code-<version>.vsix
```

Wir verwenden [changesets](https://github.com/changesets/changesets) für Versionierung und Veröffentlichung. Überprüfen Sie unsere `CHANGELOG.md` für Release-Hinweise.

---

## Haftungsausschluss

**Bitte beachten Sie**, dass Conscendo Technologies **keine** Zusicherungen oder Garantien bezüglich jeglichen Codes, Modellen oder anderen Tools gibt, die in Verbindung mit Siid Code bereitgestellt oder verfügbar gemacht werden, jeglichen zugehörigen Drittanbieter-Tools oder resultierenden Outputs. Sie übernehmen **alle Risiken** im Zusammenhang mit der Nutzung solcher Tools oder Outputs; solche Tools werden auf einer **"WIE BESEHEN"** und **"WIE VERFÜGBAR"** Basis bereitgestellt. Solche Risiken können, ohne Einschränkung, Verletzung geistigen Eigentums, Cyber-Schwachstellen oder -Angriffe, Voreingenommenheit, Ungenauigkeiten, Fehler, Mängel, Viren, Ausfallzeiten, Eigentumsverlust oder -schäden und/oder Personenschäden umfassen. Sie sind allein verantwortlich für Ihre Nutzung solcher Tools oder Outputs (einschließlich, ohne Einschränkung, deren Rechtmäßigkeit, Angemessenheit und Ergebnisse).

---

## Mitwirken

Wir lieben Community-Beiträge! Beginnen Sie mit dem Lesen unserer [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Lizenz

[Apache 2.0 © 2025 Conscendo Technologies](../LICENSE)

---

**Genießen Sie Siid Code!** Ob Sie ihn an der kurzen Leine halten oder autonom agieren lassen, wir können es kaum erwarten zu sehen, was Sie bauen. Wenn Sie Fragen oder Funktionsideen haben, schauen Sie in unserer GitHub. Frohes Coding!
