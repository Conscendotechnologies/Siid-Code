<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • <b>Español</b> • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • [Italiano](../it/README.md) • [日本語](../ja/README.md)

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

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Descargar%20en%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Descargar en VS Marketplace"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Valorar%20%26%20Opinar-green?style=for-the-badge" alt="Valorar & Opinar"></a>
</div>

**Siid Code** es un **agente de programación autónomo** impulsado por IA que vive en tu editor. Puede:

- Comunicarse en lenguaje natural
- Leer y escribir archivos directamente en tu espacio de trabajo
- Ejecutar comandos en terminal
- Automatizar acciones del navegador
- Integrarse con cualquier API/modelo compatible con OpenAI o personalizado
- Adaptar su "personalidad" y capacidades a través de **Modos Personalizados**

Ya sea que busques un socio de programación flexible, un arquitecto de sistemas o roles especializados como ingeniero de control de calidad o gestor de productos, Siid Code puede ayudarte a construir software de manera más eficiente.

Consulta el [CHANGELOG](../../CHANGELOG.md) para ver actualizaciones detalladas y correcciones.

---

## 🎉 Siid Code 3.25 Lanzado

¡Siid Code 3.25 trae nuevas funcionalidades poderosas y mejoras significativas para mejorar tu flujo de trabajo de desarrollo!

- **Cola de mensajes** - Pon varios mensajes en cola mientras Siid Code trabaja, permitiéndote continuar planificando tu flujo de trabajo sin interrupciones.
- **Comandos slash personalizados** - Crea comandos slash personalizados para acceso rápido a prompts y flujos de trabajo utilizados frecuentemente con gestión completa de la interfaz de usuario.
- **Herramientas Gemini avanzadas** - Nuevas funcionalidades de contexto de URL y fundamentos de búsqueda de Google proporcionan a los modelos Gemini información web en tiempo real y capacidades de búsqueda avanzadas.

---

## ¿Qué puede hacer Siid Code?

- 🚀 **Generar código** a partir de descripciones en lenguaje natural
- 🔧 **Refactorizar y depurar** código existente
- 📝 **Escribir y actualizar** documentación
- 🤔 **Responder preguntas** sobre tu base de código
- 🔄 **Automatizar** tareas repetitivas
- 🏗️ **Crear** nuevos archivos y proyectos

## Inicio rápido

1. Instalar Siid Code
2. Conectar tu proveedor de IA
3. Probar tu primera tarea

## Características principales

### Múltiples modos

Siid Code se adapta a tus necesidades con modos especializados:

- **Modo Código:** Para tareas generales de programación
- **Modo Arquitecto:** Para planificación y liderazgo técnico
- **Modo Consulta:** Para responder preguntas y proporcionar información
- **Modo Depuración:** Para diagnóstico sistemático de problemas
- **Modos personalizados:** Crea un número ilimitado de personas especializadas para auditoría de seguridad, optimización de rendimiento, documentación o cualquier otra tarea

### Herramientas inteligentes

Siid Code viene con potentes herramientas que pueden:

- Leer y escribir archivos en tu proyecto
- Ejecutar comandos en tu terminal de VS Code
- Controlar un navegador web
- Usar herramientas externas a través de MCP (Model Context Protocol)

MCP amplía las capacidades de Siid Code al permitirte añadir herramientas personalizadas ilimitadas. Integra con APIs externas, conéctate a bases de datos o crea herramientas de desarrollo especializadas - MCP proporciona el marco para expandir la funcionalidad de Siid Code para satisfacer tus necesidades específicas.

### Personalización

Haz que Siid Code funcione a tu manera con:

- Instrucciones personalizadas para comportamiento personalizado
- Modos personalizados para tareas especializadas
- Modelos locales para uso sin conexión
- Configuración de aprobación automática para flujos de trabajo más rápidos

## Recursos

### Documentación

- Guía de uso básico
- Funciones avanzadas
- Preguntas frecuentes

### Support

- **GitHub Issues:** Reporta [problemas](https://github.com/Conscendotechnologies/Siid-Code/issues) o solicita [funciones](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Configuración y desarrollo local

1. **Clona** el repositorio:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Instala dependencias**:

```sh
npm run install:all
```

3. **Inicia la vista web (aplicación Vite/React con HMR)**:

```sh
npm run dev
```

4. **Depuración**:
   Presiona `F5` (o **Ejecutar** → **Iniciar depuración**) en VSCode para abrir una nueva sesión con Siid Code cargado.

Los cambios en la vista web aparecerán inmediatamente. Los cambios en la extensión principal requerirán un reinicio del host de extensión.

Alternativamente, puedes construir un archivo .vsix e instalarlo directamente en VSCode:

```sh
npm run build
```

Aparecerá un archivo `.vsix` en el directorio `bin/` que se puede instalar con:

```sh
code --install-extension bin/siid-code-<version>.vsix
```

Usamos [changesets](https://github.com/changesets/changesets) para versionar y publicar. Consulta nuestro `CHANGELOG.md` para ver las notas de lanzamiento.

---

## Aviso legal

**Ten en cuenta** que Conscendo Technologies **no** hace ninguna representación o garantía con respecto a cualquier código, modelo u otras herramientas proporcionadas o puestas a disposición en relación con Siid Code, cualquier herramienta de terceros asociada, o cualquier resultado. Asumes **todos los riesgos** asociados con el uso de dichas herramientas o resultados; tales herramientas se proporcionan "**TAL CUAL**" y "**SEGÚN DISPONIBILIDAD**". Dichos riesgos pueden incluir, sin limitación, infracciones de propiedad intelectual, vulnerabilidades o ataques cibernéticos, sesgo, imprecisiones, errores, defectos, virus, tiempo de inactividad, pérdida o daño de propiedad y/o lesiones personales. Eres el único responsable de tu uso de dichas herramientas o resultados (incluidas, entre otras, la legalidad, idoneidad y resultados de los mismos).

---

## Contribuciones

¡Amamos las contribuciones de la comunidad! Comienza leyendo nuestro [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licencia

[Apache 2.0 © 2025 Conscendo Technologies](../LICENSE)

---

**¡Disfruta Siid Code!** Ya sea que lo mantengas con correa corta o lo dejes vagar de forma autónoma, estamos ansiosos por ver lo que construyes. Si tienes preguntas o ideas para nuevas funciones, visita nuestra GitHub. ¡Feliz programación!
