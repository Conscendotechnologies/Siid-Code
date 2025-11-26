<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • <b>Italiano</b> • [日本語](../ja/README.md)

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

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Scarica%20su%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Scarica su VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Valuta%20%26%20Recensisci-green?style=for-the-badge" alt="Valuta & Recensisci"></a>
</div>

**Siid Code** è un **agente di codifica autonomo** basato sull'IA che vive nel tuo editor. Può:

- Comunicare in linguaggio naturale
- Leggere e scrivere file direttamente nel tuo workspace
- Eseguire comandi del terminale
- Automatizzare le azioni del browser
- Integrarsi con qualsiasi API/modello compatibile con OpenAI o personalizzato
- Adattare la sua "personalità" e capacità attraverso **Modalità Personalizzate**

Che tu stia cercando un partner di codifica flessibile, un architetto di sistema o ruoli specializzati come un ingegnere QA o un product manager, Siid Code può aiutarti a costruire software in modo più efficiente.

Consulta il [CHANGELOG](../../CHANGELOG.md) per aggiornamenti dettagliati e correzioni.

---

## 🎉 Ultima versione

Siid Code porta nuove funzionalità potenti e miglioramenti significativi per migliorare il tuo flusso di lavoro di sviluppo!

- **Coda di messaggi** - Metti in coda più messaggi mentre Siid Code lavora, permettendoti di continuare a pianificare il tuo flusso di lavoro senza interruzioni.
- **Comandi slash personalizzati** - Crea comandi slash personalizzati per accesso rapido a prompt e flussi di lavoro utilizzati frequentemente con gestione completa dell'interfaccia utente.
- **Strumenti Gemini avanzati** - Nuove funzionalità di contesto URL e fondamenti di ricerca Google forniscono ai modelli Gemini informazioni web in tempo reale e capacità di ricerca avanzate.

---

## Cosa Può Fare Siid Code?

- 🚀 **Generare Codice** da descrizioni in linguaggio naturale
- 🔧 **Refactoring e Debug** del codice esistente
- 📝 **Scrivere e Aggiornare** documentazione
- 🤔 **Rispondere a Domande** sul tuo codebase
- 🔄 **Automatizzare** attività ripetitive
- 🏗️ **Creare** nuovi file e progetti

## Avvio Rapido

1. Installa Siid Code
2. Connetti il tuo Provider IA
3. Prova la tua Prima Attività

## Funzionalità Principali

### Modalità Multiple

Siid Code si adatta alle tue esigenze con modalità specializzate:

- **Modalità Codice:** Per attività di codifica generale
- **Modalità Architetto:** Per pianificazione e leadership tecnica
- **Modalità Domanda:** Per rispondere a domande e fornire informazioni
- **Modalità Debug:** Per diagnosi sistematica dei problemi
- **Modalità Personalizzate:** Crea personaggi specializzati illimitati per audit di sicurezza, ottimizzazione delle prestazioni, documentazione o qualsiasi altra attività

### Strumenti Intelligenti

Siid Code viene fornito con potenti strumenti che possono:

- Leggere e scrivere file nel tuo progetto
- Eseguire comandi nel tuo terminale VS Code
- Controllare un browser web
- Utilizzare strumenti esterni tramite MCP (Model Context Protocol)

MCP estende le capacità di Siid Code permettendoti di aggiungere strumenti personalizzati illimitati. Integra con API esterne, connettiti a database o crea strumenti di sviluppo specializzati - MCP fornisce il framework per espandere la funzionalità di Siid Code per soddisfare le tue esigenze specifiche.

### Personalizzazione

Fai funzionare Siid Code a modo tuo con:

- Istruzioni Personalizzate per comportamenti personalizzati
- Modalità Personalizzate per attività specializzate
- Modelli Locali per uso offline
- Impostazioni di Auto-Approvazione per flussi di lavoro più veloci

## Risorse

### Documentazione

- Guida all'Uso di Base
- Funzionalità Avanzate
- Domande Frequenti

### Support

- **GitHub Issues:** [Segnala problemi](https://github.com/Conscendotechnologies/Siid-Code/issues) o [richiedi funzionalità](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Configurazione e Sviluppo Locale

1. **Clona** il repository:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Installa le dipendenze**:

```sh
npm run install:all
```

3. **Avvia la webview (app Vite/React con HMR)**:

```sh
npm run dev
```

4. **Debug**:
   Premi `F5` (o **Run** → **Start Debugging**) in VSCode per aprire una nuova sessione con Siid Code caricato.

Le modifiche alla webview appariranno immediatamente. Le modifiche all'estensione principale richiederanno un riavvio dell'host dell'estensione.

In alternativa puoi creare un file .vsix e installarlo direttamente in VSCode:

```sh
npm run build
```

Un file `.vsix` apparirà nella directory `bin/` che può essere installato con:

```sh
code --install-extension bin/siid-code-<version>.vsix
```

Utilizziamo [changesets](https://github.com/changesets/changesets) per la gestione delle versioni e la pubblicazione. Controlla il nostro `CHANGELOG.md` per le note di rilascio.

---

## Disclaimer

**Si prega di notare** che Conscendo Technologies **non** fa alcuna dichiarazione o garanzia riguardo a qualsiasi codice, modello o altro strumento fornito o reso disponibile in relazione a Siid Code, qualsiasi strumento di terze parti associato o qualsiasi output risultante. Ti assumi **tutti i rischi** associati all'uso di tali strumenti o output; tali strumenti sono forniti su base **"COSÌ COM'È"** e **"COME DISPONIBILE"**. Tali rischi possono includere, senza limitazione, violazione della proprietà intellettuale, vulnerabilità o attacchi informatici, pregiudizi, imprecisioni, errori, difetti, virus, tempi di inattività, perdita o danneggiamento della proprietà e/o lesioni personali. Sei l'unico responsabile del tuo utilizzo di tali strumenti o output (inclusi, senza limitazione, la legalità, l'appropriatezza e i risultati degli stessi).

---

## Contribuire

Amiamo i contributi della community! Inizia leggendo il nostro [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licenza

[Apache 2.0 © 2025 Conscendo Technologies](../LICENSE)

---

**Goditi Siid Code!** Che tu lo tenga al guinzaglio corto o lo lasci vagare autonomamente, non vediamo l'ora di vedere cosa costruirai. Se hai domande o idee per funzionalità, passa dalla nostra [community di Reddit](https://github.com/Conscendotechnologies/Siid-Code) o GitHub. Buona programmazione!
