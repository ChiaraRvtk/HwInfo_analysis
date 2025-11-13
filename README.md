# HWI Electron

Painel Electron que replica o fluxo do HWI_compare totalmente em JavaScript, entregando hardware, relatórios comparativos e gráficos em uma interface moderna sem dependências Python.

## Pré-requisitos

1. Instale as dependências Node (incluindo `papaparse`):
   ```
   npm install
   ```

## Como usar

1. Execute o Electron:
   ```
   npm start
   ```
2. Use os controles superiores para:
   - carregar o XML de hardware do HWiNFO (Save Report → XML, por exemplo `C:\Users\thiag\Downloads\hwi_834\LENOVO_TRV.XML`);
   - selecionar um ou mais relatórios CSV para comparar;
   - ajustar o valor de TjMAX conforme necessário.
3. Clique em **Analisar relatórios** para acionar `src/reportProcessor.js`, que lê os CSVs com `papaparse` e retorna:
   - linhas explicativas para a aba “Hardware do sistema”;
   - resumos detalhados por relatório;
   - grupos de métricas para a tabela de comparação;
   - séries temporais para os gráficos Chart.js por categoria.

4. O último XML de hardware carregado e os filtros de gráficos (relatórios/métricas ocultas) são lembrados em `hwi_electron_config.json`, de modo que basta clicar em “Analisar” e tudo reaparece com os filtros aplicados.

5. Use o botão **Exportar PDF** após analisar: ele cria um documento com a comparação lado a lado e todos os gráficos filtrados, salvando onde você escolher.

> O arquivo `hwi_electron_config.json` é gerado localmente ao salvar filtros ou hardware e está ignorado pelo Git.

## Navegação

- **Hardware do sistema**: agora mostra cartões separados para sistema operacional, processador, memória, discos e GPU, com os campos mais relevantes de cada um.
- **Resumo detalhado**: card por relatório com potências, clocks, FPS e avisos.
- **Comparação lado a lado**: tabela agrupada com destaques para melhor e valores críticos.
- **Gráficos**: selecione categorias (“CPU”, “GPU”, etc.) e use a legenda do Chart.js para ligar/desligar cada série.
- **Filtros de gráfico**: abaixo da área do gráfico há botões para ocultar/mostrar relatórios inteiros e métricas específicas (ex.: “Uso GPU D3D (%)” ou “RAM utilizada (MB)”), para que você veja apenas o que interessa; as escolhas persistem entre execuções.
- **Exportar PDF**: gere um PDF contendo apenas a comparação e os gráficos com filtros aplicados para arquivar ou compartilhar o resultado.

## Personalização

- Edite `src/reportProcessor.js` para ajustar quais métricas são expostas, como são formatadas e quais dados são enviados ao renderer.
- O renderer (`src/renderer.js`) é responsável pela tabulação, layout e Chart.js; altere-o se quiser incluir novos painéis ou filtros.
- Os estilos estão centralizados em `src/styles.css` e seguem um esquema escuro inspirado em dashboards modernos.
