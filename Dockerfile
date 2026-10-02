# Etapa 1: gera o mangatracker.jar (os testes rodam no seu computador, com mvn package)
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# Etapa 2: imagem final so com o Java e o jar
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/mangatracker.jar .
# /data e o disco permanente (volume): la ficam o mangas.json e as capas
ENV MANGATRACKER_DIR=/data \
    MANGATRACKER_HOST=0.0.0.0 \
    PORT=8080
EXPOSE 8080
CMD ["java", "-XX:MaxRAMPercentage=70", "-jar", "mangatracker.jar"]
