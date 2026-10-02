#!/bin/bash
# Inicia o Meus Mangás. Uso: ./iniciar.sh
# Se existir um arquivo .env nesta pasta, as configuracoes dele sao carregadas (ex.: DATABASE_URL).
cd "$(dirname "$0")" || exit 1

if [ -f .env ]; then
    set -a
    . ./.env
    set +a
fi

# usa o JDK baixado pelo IntelliJ se o JAVA_HOME nao estiver definido (o projeto precisa do Java 25+)
if [ -z "$JAVA_HOME" ]; then
    JAVA_HOME=$(ls -d "$HOME"/.jdks/openjdk-2[5-9]* 2>/dev/null | sort -V | tail -1)
    export JAVA_HOME
fi
JAVA="${JAVA_HOME:+$JAVA_HOME/bin/}java"

if [ ! -f target/mangatracker.jar ]; then
    mvn -q package -DskipTests || exit 1
fi
exec "$JAVA" -jar target/mangatracker.jar
