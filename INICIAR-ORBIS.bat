@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Orbis - Servidor de Desenvolvimento
echo ============================================
echo            INICIANDO O ORBIS
echo ============================================
echo.

REM 1) Verifica se o Node.js esta instalado
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no seu PC.
  echo.
  echo Instale a versao LTS em: https://nodejs.org
  echo Depois feche e abra este atalho de novo.
  echo.
  pause
  exit /b 1
)

REM 2) Verifica se as dependencias ja foram instaladas
if not exist node_modules (
  echo Primeira vez rodando: instalando dependencias.
  echo Isso pode levar alguns minutos. Aguarde...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] A instalacao falhou. Tire um print desta tela e me mande.
    pause
    exit /b 1
  )
)

REM 3) Verifica se existe o arquivo de chaves
if not exist ".env.local" (
  echo.
  echo [ATENCAO] O arquivo .env.local nao existe.
  echo O app pode abrir com a tela em branco sem as chaves do Supabase.
  echo.
)

echo.
echo Abrindo o navegador em http://localhost:8080
echo Para PARAR o servidor: feche esta janela ou aperte Ctrl + C
echo.
start "" http://localhost:8080
call npm run dev

pause
