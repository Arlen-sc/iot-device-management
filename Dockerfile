FROM openjdk:17-jdk-slim

WORKDIR /app

COPY target/iot-device-management-*.jar app.jar

EXPOSE 18082

ENV JAVA_OPTS="-Xms512m -Xmx1024m"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
