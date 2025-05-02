@echo off
set GRADLE_OPTS=-Xmx4g -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError
call gradlew.bat %* 