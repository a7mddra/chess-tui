

<p align="center">
  <img src="docs/media/logo.png" alt="chess-tui" height="100">
</p>

<p align="center">
  <a href="https://github.com/a7mddra/chess-tui/stargazers"><img src="https://img.shields.io/github/stars/a7mddra/chess-tui" alt="stars"></a> <a href="https://github.com/a7mddra/chess-tui/actions/workflows/release-ext.yml"><img src="https://github.com/a7mddra/chess-tui/actions/workflows/release-ext.yml/badge.svg" alt="Build status"></a> <a href="https://www.npmjs.com/package/chess-tui"><img src="https://img.shields.io/npm/v/chess-tui" alt="npm"></a> <a href="https://github.com/a7mddra/chess-tui/releases"><img src="https://img.shields.io/github/v/release/a7mddra/chess-tui?sort=semver&color=blue" alt="release"></a> <a href="https://github.com/a7mddra/chess-tui/blob/main/LICENSE"><img src="https://img.shields.io/github/license/a7mddra/chess-tui" alt="license"></a>
</p>

<p align="center">
  <img src="docs/media/demo.gif" alt="chess-tui demo">
</p>

<p align="center">Juega a chess.com desde tu terminal. Tu cuenta real, tu Elo real, sin anuncios.</p>

## Cómo funciona

```
chess.com tab  ←→  WebSocket  ←→  Terminal UI (Ink/React)
```

Chess.com expone `board.move()` en el ámbito JavaScript de la página. Nuestra extensión utiliza esto para inyectar movimientos y extraer el estado del juego (FEN, relojes, información del jugador) del DOM. La TUI representa todo en la terminal y envía los movimientos de vuelta a través de la misma canalización mientras la pestaña está minimizada.

## Inicio rápido

**Requisitos previos:**

- Asegúrate de tener [Node.js y npm](https://nodejs.org/) instalados en tu máquina.
- Asegúrate de tener el navegador [Chrome](https://www.google.com/chrome/) instalado. (Próximamente más navegadores.)
- Asegúrate de tener una cuenta en [chess.com](https://chess.com).

### 1. Instalar el CLI

Instala el paquete globalmente:

```bash
npm install -g chess-tui
```

### 2. Instalar la extensión Bridge

Para conectarte a tus partidas reales de chess.com, necesitas la extensión complementaria para Chrome:

1. Descarga `chess-tui-extension.zip` desde **[Lanzamientos de GitHub](https://github.com/a7mddra/chess-tui/releases/download/v0.1.1/chess-tui-extension.zip)**.
2. Extrae el archivo zip.
3. Abre [`chrome://extensions`](chrome://extensions) en tu navegador.
4. Habilita el **"Modo de desarrollador"** (interruptor en la esquina superior derecha).
5. Haz clic en **"Cargar desempaquetado"** y selecciona la carpeta extraída.
   _(Nota: Si Chrome muestra algún error en la tarjeta de la extensión, puedes ignorarlos con seguridad.)_

### 3. ¡A jugar!

1. Abre [chess.com](https://chess.com) en Chrome y comienza o reanuda una partida.
2. Abre tu terminal en **cualquier lugar** y ejecuta:

```bash
chess-tui
# o simplemente:
chess
```

¡Disfruta jugando sin anuncios directamente desde tu terminal!

### 4. Solución de problemas

La mayoría de los problemas provienen de la conexión entre Chrome y la terminal. La mejor forma de solucionarlos es recargar la pestaña de Chrome y reiniciar la TUI hasta que se vuelvan a conectar.

## Modos de juego

### En línea (chess.com)

Conéctate a tu sesión de chess.com a través de la extensión. Juega partidas en vivo con oponentes reales, ve los relojes, el Elo, ofertas de tablas y piezas capturadas — todo en la terminal.

### Desconectado (Stockfish)

Juega contra el motor Stockfish de forma local. Elo ajustable de 100 a 3000. No se necesita navegador ni conexión a internet.

## Características

- **Renderizado del tablero en vivo** con 4 temas de colores
- **Sistema de premovimientos** con sugerencias de movimientos especulativos
- **Ventana de tablero desmontable** — separa el tablero en una terminal independiente y haz zoom por separado
- **Comandos con slash** — `/theme`, `/new`, `/resign`, `/draw`, `/accept`, `/decline`, `/analyze`, `/flip`, `/diff`, `/undo` `
- **Preferencias del usuario** persistidas en `~/.config/chess-tui/` `

## Documentación

- [Arquitectura](docs/architecture.md) — cómo funciona el sistema (comienza aquí para contribuir)
- [Extensión](docs/extension.md) — detalles internos de la extensión de Chrome
- [Protocolo Bridge](docs/bridge-protocol.md) — contrato de mensajes WebSocket
- [Pruebas](docs/testing.md) — ciclo de vida de las pruebas y manejo de fixtures
- [Contribuir](docs/contributing.md) — configuración, convenciones y dónde agregar código
- [Hoja de ruta](docs/roadmap.md) — lo que ya está hecho y lo que viene
- [Seguridad](SECURITY.md) — límites de datos y política de juego limpio

## Desarrollo

```bash
git clone https://github.com/a7mddra/chess-tui.git
cd chess-tui
npm install

npm run dev:tui      # Ejecutar la TUI
npm run build:ext    # Compilar la extensión
npm run tsc:tui      # Verificar tipos de TUI
npm run tsc:ext      # Verificar tipos de la extensión
```

## Seguridad y Juego Limpio

chess-tui no respalda las trampas. La extensión inyecta movimientos de la misma manera que un clic de ratón humano: llama a la misma función `board.move()`. Sin embargo, conectar motores externos a partidas en vivo viola los términos de servicio de chess.com. Consulta [SECURITY.md](SECURITY.md) para ver la política completa.

## Licencia

Licencia MIT. Consulta [LICENSE](LICENSE).

**Descargo de responsabilidad:** `chess-tui` es un proyecto de código abierto no oficial desarrollado de forma independiente. **No** está afiliado, respaldado, patrocinado ni de otra manera asociado con Chess.com. Todas las marcas comerciales, marcas de servicio y nombres de empresas son propiedad de sus respectivos dueños. Al utilizar este software, aceptas cumplir con los Términos de Servicio y las directrices de Juego Limpio de las plataformas correspondientes.
