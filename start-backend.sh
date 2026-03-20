#!/bin/bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export PATH="/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"
cd "$(dirname "$0")"
mvn -f backend/pom.xml spring-boot:run -Dspring-boot.run.jvmArguments="-Dspring.profiles.active=local"
