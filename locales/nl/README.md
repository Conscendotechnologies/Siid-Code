<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • [Italiano](../it/README.md) • [日本語](../ja/README.md)

</sub>
<sub>

[한국어](../ko/README.md) • <b>Nederlands</b> • [Polski](../pl/README.md) • [Português (BR)](../pt-BR/README.md) • [Русский](../ru/README.md) • [Türkçe](../tr/README.md) • [Tiếng Việt](../vi/README.md) • [简体中文](../zh-CN/README.md) • [繁體中文](../zh-TW/README.md)

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

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Download%20op%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Download op VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Beoordeel%20%26%20Review-green?style=for-the-badge" alt="Beoordeel & Review"></a>
</div>

**Siid Code** is een AI-gestuurde **autonome codeeragent** die in je editor leeft. Het kan:

- Communiceren in natuurlijke taal
- Bestanden direct in je werkruimte lezen en schrijven
- Terminalcommando's uitvoeren
- Browseracties automatiseren
- Integreren met elke OpenAI-compatibele of aangepaste API/model
- Zijn "persoonlijkheid" en mogelijkheden aanpassen via **Aangepaste Modi**

Of je nu op zoek bent naar een flexibele codeerpartner, een systeemarchitect, of gespecialiseerde rollen zoals QA-engineer of productmanager, Siid Code helpt je efficiënter software te bouwen.

Bekijk de [CHANGELOG](../../CHANGELOG.md) voor gedetailleerde updates en fixes.

---

## 🎉 Nieuwste release

Siid Code 3.25 brengt krachtige nieuwe functies en significante verbeteringen om je ontwikkelingsworkflow te verbeteren!

- **<bold>Browser Sessiebeheer</bold>** - Beheer meerdere browsersessies tegelijkertijd, waardoor verschillende taken en testomgevingen gescheiden kunnen worden.
- **<bold>Prompt Caching</bold>** - Cache veelgebruikte prompts om responstijden aanzienlijk te verkorten en API-gebruik te verminderen.
- **<bold>Computer Use Functionaliteit</bold>** - AI kan direct interacteren met desktoptoepassingen, screenshots maken en klik- en typacties uitvoeren.

---

## Wat kan Siid Code?

- 🚀 **Genereer code** vanuit natuurlijke taalbeschrijvingen
- 🔧 **Refactor & Debug** bestaande code
- 📝 **Schrijf & Update** documentatie
- 🤔 **Beantwoord vragen** over je codebase
- 🔄 **Automatiseer** repetitieve taken
- 🏗️ **Maak** nieuwe bestanden en projecten

## Snelstart

1. Installeer Siid Code
2. Verbind je AI-provider
3. Probeer je eerste taak

## Belangrijkste functies

### Meerdere Modi

Siid Code past zich aan jouw behoeften aan met gespecialiseerde modi:

- **Code-modus:** Voor algemene coderingstaken
- **Architect-modus:** Voor planning en technisch leiderschap
- **Vraag-modus:** Voor het beantwoorden van vragen en het geven van informatie
- **Debug-modus:** Voor systematische probleemdiagnose
- **Aangepaste modi:** Maak onbeperkt gespecialiseerde persona's voor beveiligingsaudits, prestatieoptimalisatie, documentatie of andere taken

### Slimme Tools

Siid Code wordt geleverd met krachtige tools die kunnen:

- Bestanden in je project lezen en schrijven
- Commando's uitvoeren in je VS Code-terminal
- Een webbrowser aansturen
- Externe tools gebruiken via MCP (Model Context Protocol)

MCP breidt de mogelijkheden van Siid Code uit door je in staat te stellen onbeperkt aangepaste tools toe te voegen. Integreer met externe API's, maak verbinding met databases of creëer gespecialiseerde ontwikkeltools - MCP biedt het framework om Siid Code uit te breiden naar jouw specifieke wensen.

### Aanpassen

Laat Siid Code werken zoals jij wilt met:

- Aangepaste instructies voor gepersonaliseerd gedrag
- Aangepaste modi voor specialistische taken
- Lokale modellen voor offline gebruik
- Auto-Approve-instellingen voor snellere workflows

## Bronnen

### Documentatie

- Basisgebruik
- Geavanceerde functies
- Veelgestelde vragen

### Support

- **GitHub Issues:** Meld [problemen](https://github.com/Conscendotechnologies/Siid-Code/issues) of vraag [features](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop) aan

---

## Lokale installatie & ontwikkeling

1. **Kloon** de repo:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Installeer afhankelijkheden**:

```sh
npm run install:all
```

3. **Start de webview (Vite/React-app met HMR)**:

```sh
npm run dev
```

4. **Debuggen**:
   Druk op `F5` (of **Run** → **Start Debugging**) in VSCode om een nieuwe sessie met Siid Code te openen.

Wijzigingen aan de webview verschijnen direct. Wijzigingen aan de core-extensie vereisen een herstart van de extensiehost.

Je kunt ook een .vsix bouwen en deze direct in VSCode installeren:

```sh
npm run build
```

Een `.vsix`-bestand verschijnt in de `bin/`-map en kan worden geïnstalleerd met:

```sh
code --install-extension bin/siid-code-<versie>.vsix
```

We gebruiken [changesets](https://github.com/changesets/changesets) voor versiebeheer en publicatie. Bekijk onze `CHANGELOG.md` voor release-opmerkingen.

---

## Disclaimer

**Let op**: Conscendo Technologies geeft **geen** garanties of waarborgen met betrekking tot enige code, modellen of andere tools die worden geleverd of beschikbaar worden gesteld in verband met Siid Code, bijbehorende tools van derden, of enige resulterende output. Je neemt **alle risico's** die gepaard gaan met het gebruik van dergelijke tools of output; deze tools worden geleverd op een **"AS IS"** en **"AS AVAILABLE"** basis. Risico's kunnen onder meer zijn: inbreuk op intellectueel eigendom, cyberkwetsbaarheden of -aanvallen, vooringenomenheid, onnauwkeurigheden, fouten, defecten, virussen, uitval, verlies of schade aan eigendommen en/of persoonlijk letsel. Je bent zelf volledig verantwoordelijk voor het gebruik van dergelijke tools of output (inclusief, maar niet beperkt tot, de legaliteit, geschiktheid en resultaten daarvan).

---

## Bijdragen

We houden van bijdragen uit de community! Begin met het lezen van onze [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licentie

[Apache 2.0 © 2025 Conscendo Technologies](../../LICENSE)

---

**Veel plezier met Siid Code!** Of je het nu kort houdt of autonoom laat werken, we zijn benieuwd wat je bouwt. Heb je vragen of ideeën voor functies, kom dan langs op onze GitHub. Veel programmeerplezier!
