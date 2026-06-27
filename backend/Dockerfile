# syntax=docker/dockerfile:1

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY backend/pom.xml ./pom.xml
RUN mvn -B -DskipTests dependency:go-offline

COPY backend/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

RUN addgroup --system cloudcad \
    && adduser --system --ingroup cloudcad cloudcad \
    && mkdir -p /app/storage \
    && chown -R cloudcad:cloudcad /app

COPY --from=build /workspace/target/cloudcad-backend-*.jar /app/app.jar

USER cloudcad
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
