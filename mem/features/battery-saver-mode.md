---
name: Battery Saver Mode
description: Toggle no DEFCON 4 start screen que desliga animações e blurs para celulares fracos
type: feature
---
Toggle persistido em localStorage (`defcon-battery-saver`) via `useBatterySaver` hook. Quando ativo aplica classe `battery-saver` no body, e regras CSS globais em index.css desligam todas as animações (`animation: none`) e backdrop-blurs. Botão fica disponível na tela inicial do DEFCON 4.
