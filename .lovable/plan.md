## Caça-Sinal 🚦 — Encontre os melhores pontos pra vender

Nova aba no **Perfil** que mostra ao vendedor uma lista inteligente dos sinais e cruzamentos da cidade dele com **maior fluxo de pessoas/carros**, melhores horários, e o **perfil do público** (classe, tipo de carro, região nobre/popular). Sincroniza dados reais do **Google Maps** com **análise de IA**, pra ele não precisar abrir o Maps na mão.

### Como vai funcionar (para o usuário)

1. No Perfil, novo item: **🚦 Caça-Sinal — Encontre os melhores pontos pra vender**
2. Abre uma página que **já vem com a cidade/estado dele** (pegos do cadastro/perfil), mas com botão pra trocar.
3. Slider de raio de busca (1 km a 20 km) e botão "Buscar sinais bons".
4. Resultado: lista de **cards de cruzamentos/avenidas**, cada um com:
   - Nome do cruzamento + endereço
   - 🔴/🟡/🟢 nível de movimento (do Maps)
   - Distância de você
   - **Melhores horários** pra estar lá (ex: "Seg-Sex 11h-13h e 17h-19h")
   - **Perfil do público** (IA): "Região nobre, carros classe A/B, alta receptividade pra produto de ticket médio-alto" / ou "Avenida popular, alto volume, ticket baixo, ideal pra água/bala"
   - Score "Recomendado pra você" 0-10
   - Botão **"Abrir no Google Maps"** (rota até o ponto)
5. Filtros rápidos: "Mais movimento agora", "Região nobre", "Perto de mim".

### Como vai funcionar (técnico)

**Frontend**
- Novo item no menu de `src/pages/Profile.tsx` → rota `/spot-finder`
- Nova página `src/pages/SpotFinder.tsx`
  - Lê `city` e `state` do `profiles` (já existem no cadastro)
  - Inputs: cidade, estado, raio, tipo de produto (puxa do perfil)
  - Mapa interativo com **Google Maps JS API** (chave browser do connector) mostrando os pontos
  - Lista de cards abaixo do mapa
- Hook `src/hooks/useSpotFinder.ts` que chama edge function

**Backend (Edge Function `find-good-spots`)**
- Recebe: `{ city, state, lat, lng, radius_km, product_context }`
- Geocoda a cidade se não vier lat/lng (Google Geocoding via gateway)
- Busca **cruzamentos/avenidas movimentadas** via **Google Places API (New) `searchNearby`** filtrando por tipos relevantes (intersection, route, shopping_mall, transit_station, etc.) num raio
- Para cada ponto, enriquece com dados do Places (nome, endereço, popularidade, classificação da área)
- Chama **Lovable AI (`google/gemini-3-flash-preview`)** com tool calling estruturado pra:
  - classificar perfil socioeconômico da região (nobre/média/popular)
  - inferir tipo de cliente predominante (carros populares vs alta classe)
  - sugerir melhores faixas de horário pra vendedor de rua
  - dar score 0-10 e razão curta
- Retorna lista ordenada por score

**Integração necessária**
- Conector **Google Maps Platform** (já listado nos connectors disponíveis) — preciso conectar via `standard_connectors--connect`
- `LOVABLE_API_KEY` já existe ✅

**Cache leve**
- Tabela `spot_finder_cache` (key = cidade+raio+lat/lng arredondado) com TTL 24h pra não estourar quota do Maps a cada busca repetida.

### Resumo das mudanças

```text
+ Conectar Google Maps Platform (connector)
+ supabase migration: tabela spot_finder_cache
+ supabase/functions/find-good-spots/index.ts
+ src/hooks/useSpotFinder.ts
+ src/pages/SpotFinder.tsx (mapa + lista)
+ src/components/spotfinder/SpotCard.tsx
~ src/pages/Profile.tsx (novo item no menu)
~ src/App.tsx (nova rota /spot-finder)
```

### Confirma pra eu seguir?

Antes de implementar, preciso de 1 confirmação:
- Posso conectar agora o **Google Maps Platform** (o conector já existe na Lovable, ele cuida da chave/billing pra você nos domínios `.lovable.app`)? Se um dia você publicar em domínio próprio vai precisar de chave própria — aviso na hora.

Se sim, eu já: 1) conecto Maps, 2) crio a migration do cache, 3) escrevo a edge function com IA + Maps, 4) construo a página Caça-Sinal e plugo no Perfil.