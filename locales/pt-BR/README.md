<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • [Italiano](../it/README.md) • [日本語](../ja/README.md)

</sub>
<sub>

[한국어](../ko/README.md) • [Nederlands](../nl/README.md) • [Polski](../pl/README.md) • <b>Português (BR)</b> • [Русский](../ru/README.md) • [Türkçe](../tr/README.md) • [Tiếng Việt](../vi/README.md) • [简体中文](../zh-CN/README.md) • [繁體中文](../zh-TW/README.md)

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

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Baixar%20no%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Baixar no VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Avaliar%20%26%20Comentar-green?style=for-the-badge" alt="Avaliar & Comentar"></a>
</div>

**Siid Code** é um **agente de codificação autônomo** movido a IA que reside no seu editor. Ele pode:

- Comunicar-se em linguagem natural
- Ler e escrever arquivos diretamente no seu espaço de trabalho
- Executar comandos do terminal
- Automatizar ações do navegador
- Integrar com qualquer API/modelo compatível com OpenAI ou personalizado
- Adaptar sua "personalidade" e capacidades através de **Modos Personalizados**

Seja você esteja buscando um parceiro de codificação flexível, um arquiteto de sistema ou funções especializadas como engenheiro de QA ou gerente de produto, o Siid Code pode ajudá-lo a construir software com mais eficiência.

Confira o [CHANGELOG](../../CHANGELOG.md) para atualizações e correções detalhadas.

---

## 🎉 Última versão

O Siid Code traz novos recursos poderosos e melhorias significativas para aprimorar seu fluxo de trabalho de desenvolvimento!

- **<bold>Gerenciamento de Sessões do Navegador</bold>** - Gerencie múltiplas sessões de navegador simultaneamente, permitindo a separação de diferentes tarefas e ambientes de teste.
- **<bold>Cache de Prompts</bold>** - Faça cache de prompts frequentemente usados para reduzir significativamente os tempos de resposta e diminuir o uso da API.
- **<bold>Funcionalidade de Uso do Computador</bold>** - A IA pode interagir diretamente com aplicações desktop, tirar screenshots e executar ações de clique e digitação.

---

## O que o Siid Code pode fazer?

- 🚀 **Gerar código** a partir de descrições em linguagem natural
- 🔧 **Refatorar e depurar** código existente
- 📝 **Escrever e atualizar** documentação
- 🤔 **Responder perguntas** sobre sua base de código
- 🔄 **Automatizar** tarefas repetitivas
- 🏗️ **Criar** novos arquivos e projetos

## Início Rápido

1. Instale o Siid Code
2. Conecte seu provedor de IA
3. Experimente sua primeira tarefa

## Principais Recursos

### Múltiplos Modos

O Siid Code se adapta às suas necessidades com modos especializados:

- **Modo Code:** Para tarefas gerais de codificação
- **Modo Architect:** Para planejamento e liderança técnica
- **Modo Ask:** Para responder perguntas e fornecer informações
- **Modo Debug:** Para diagnóstico sistemático de problemas
- **Modos Personalizados:** Crie personas especializadas ilimitadas para auditoria de segurança, otimização de desempenho, documentação ou qualquer outra tarefa

### Ferramentas Inteligentes

O Siid Code vem com poderosas ferramentas que podem:

- Ler e escrever arquivos em seu projeto
- Executar comandos no seu terminal VS Code
- Controlar um navegador web
- Usar ferramentas externas via MCP (Model Context Protocol)

O MCP amplia as capacidades do Siid Code permitindo que você adicione ferramentas personalizadas ilimitadas. Integre com APIs externas, conecte-se a bancos de dados ou crie ferramentas de desenvolvimento especializadas - o MCP fornece o framework para expandir a funcionalidade do Siid Code para atender às suas necessidades específicas.

### Personalização

Faça o Siid Code funcionar do seu jeito com:

- Instruções Personalizadas para comportamento personalizado
- Modos Personalizados para tarefas especializadas
- Modelos Locais para uso offline
- Configurações de Auto-Aprovação para fluxos de trabalho mais rápidos

## Recursos

### Documentação

- Guia de Uso Básico
- Recursos Avançados
- Perguntas Frequentes

### Support

- **GitHub Issues:** [Reportar problemas](https://github.com/Conscendotechnologies/Siid-Code/issues) ou [solicitar recursos](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Configuração e Desenvolvimento Local

1. **Clone** o repositório:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Instale as dependências**:

```sh
npm run install:all
```

3. **Inicie o webview (aplicativo Vite/React com HMR)**:

```sh
npm run dev
```

4. **Depuração**:
   Pressione `F5` (ou **Executar** → **Iniciar Depuração**) no VSCode para abrir uma nova sessão com o Siid Code carregado.

Alterações no webview aparecerão imediatamente. Alterações na extensão principal exigirão a reinicialização do host da extensão.

Alternativamente, você pode construir um .vsix e instalá-lo diretamente no VSCode:

```sh
npm run build
```

Um arquivo `.vsix` aparecerá no diretório `bin/` que pode ser instalado com:

```sh
code --install-extension bin/siid-code-<version>.vsix
```

Usamos [changesets](https://github.com/changesets/changesets) para versionamento e publicação. Verifique nosso `CHANGELOG.md` para notas de lançamento.

---

## Aviso Legal

**Por favor, note** que a Conscendo Technologies **não** faz nenhuma representação ou garantia em relação a qualquer código, modelos ou outras ferramentas fornecidas ou disponibilizadas em conexão com o Siid Code, quaisquer ferramentas de terceiros associadas, ou quaisquer saídas resultantes. Você assume **todos os riscos** associados ao uso de tais ferramentas ou saídas; tais ferramentas são fornecidas em uma base **"COMO ESTÁ"** e **"COMO DISPONÍVEL"**. Tais riscos podem incluir, sem limitação, violação de propriedade intelectual, vulnerabilidades cibernéticas ou ataques, viés, imprecisões, erros, defeitos, vírus, tempo de inatividade, perda ou dano de propriedade e/ou lesões pessoais. Você é o único responsável pelo seu uso de tais ferramentas ou saídas (incluindo, sem limitação, a legalidade, adequação e resultados das mesmas).

---

## Contribuindo

Adoramos contribuições da comunidade! Comece lendo nosso [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licença

[Apache 2.0 © 2025 Conscendo Technologies](../LICENSE)

---

**Aproveite o Siid Code!** Seja você o mantenha em uma coleira curta ou deixe-o vagar autonomamente, mal podemos esperar para ver o que você construirá. Se você tiver dúvidas ou ideias de recursos, passe por nossa [comunidade Reddit](https://github.com/Conscendotechnologies/Siid-Code) ou GitHub. Feliz codificação!
