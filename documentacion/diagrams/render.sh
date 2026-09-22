#!/usr/bin/env bash
# Renderiza los diagramas PlantUML a SVG en documentacion/diagrams/
# Uso: bash documentacion/diagrams/render.sh
set -euo pipefail
cd "$(dirname "$0")"

JAR="$HOME/.puml/plantuml.jar"
URL="https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar"

if [ ! -f "$JAR" ]; then
  echo "Descargando PlantUML…"
  mkdir -p "$HOME/.puml"
  curl -fL -o "$JAR" "$URL"
fi

echo "Renderizando diagramas a SVG…"
java -DPLANTUML_LIMIT_SIZE=8192 -jar "$JAR" -tsvg -charset UTF-8 -Playout=smetana ./*.puml
echo "Listo. SVG generados en $(pwd)"