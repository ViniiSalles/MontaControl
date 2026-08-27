-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('GESTOR', 'RH', 'MONTADOR', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('AGUARDANDO', 'EM_TRIAGEM', 'RECEBIDO', 'EM_ENTREGA', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "StatusAmbiente" AS ENUM ('PENDENTE', 'EM_PROGRESSO', 'COMPLETO');

-- CreateEnum
CREATE TYPE "StatusPeca" AS ENUM ('TRIADA', 'CARREGADA', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "StatusAvaria" AS ENUM ('REPORTADA', 'EM_ANALISE', 'REPOSICAO_SOLICITADA', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "StatusJornada" AS ENUM ('EM_ANDAMENTO', 'PAUSADA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "StatusAtestado" AS ENUM ('PENDENTE', 'VALIDADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "telefone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "numero_pedido" TEXT NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'AGUARDANDO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_montador" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "pedido_montador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambiente" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusAmbiente" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "ambiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peca" (
    "id" SERIAL NOT NULL,
    "ambiente_id" INTEGER NOT NULL,
    "codigo_barras" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusPeca" NOT NULL DEFAULT 'TRIADA',
    "triada_por" INTEGER,
    "conferida_por" INTEGER,
    "conferida_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_avaria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "tipo_avaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaria" (
    "id" SERIAL NOT NULL,
    "peca_id" INTEGER NOT NULL,
    "tipo_avaria_id" INTEGER NOT NULL,
    "registrada_por" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusAvaria" NOT NULL DEFAULT 'REPORTADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaria_foto" (
    "id" SERIAL NOT NULL,
    "avaria_id" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaria_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornada" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "pedido_id" INTEGER,
    "checkin_latitude" DECIMAL(10,7),
    "checkin_longitude" DECIMAL(10,7),
    "checkin_at" TIMESTAMP(3),
    "checkout_latitude" DECIMAL(10,7),
    "checkout_longitude" DECIMAL(10,7),
    "checkout_at" TIMESTAMP(3),
    "status" "StatusJornada" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pausa" (
    "id" SERIAL NOT NULL,
    "jornada_id" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),

    CONSTRAINT "pausa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banco_horas" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "horas_trabalhadas" DECIMAL(7,2) NOT NULL,
    "horas_previstas" DECIMAL(7,2) NOT NULL,
    "saldo" DECIMAL(7,2) NOT NULL,
    "calculado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_horas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "status" "StatusAtestado" NOT NULL DEFAULT 'PENDENTE',
    "motivo_rejeicao" TEXT,
    "validado_por" INTEGER,
    "validado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atestado_foto" (
    "id" SERIAL NOT NULL,
    "atestado_id" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atestado_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_ferramenta" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "tipo_ferramenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ferramenta" (
    "id" SERIAL NOT NULL,
    "tipo_ferramenta_id" INTEGER NOT NULL,
    "codigo_patrimonio" TEXT NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ferramenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cautela" (
    "id" SERIAL NOT NULL,
    "ferramenta_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "data_retirada" TIMESTAMP(3) NOT NULL,
    "data_devolucao_prevista" DATE NOT NULL,
    "data_devolucao_real" TIMESTAMP(3),
    "devolvida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cautela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_epi" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "validade_meses" INTEGER NOT NULL,

    CONSTRAINT "tipo_epi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi" (
    "id" SERIAL NOT NULL,
    "tipo_epi_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "data_entrega" DATE NOT NULL,
    "data_validade" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norma" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "norma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_auth_user_id_key" ON "usuario"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_numero_pedido_key" ON "pedido"("numero_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_montador_pedido_id_usuario_id_key" ON "pedido_montador"("pedido_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "peca_codigo_barras_key" ON "peca"("codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "banco_horas_usuario_id_mes_ano_key" ON "banco_horas"("usuario_id", "mes", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "ferramenta_codigo_patrimonio_key" ON "ferramenta"("codigo_patrimonio");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_montador" ADD CONSTRAINT "pedido_montador_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_montador" ADD CONSTRAINT "pedido_montador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambiente" ADD CONSTRAINT "ambiente_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peca" ADD CONSTRAINT "peca_ambiente_id_fkey" FOREIGN KEY ("ambiente_id") REFERENCES "ambiente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peca" ADD CONSTRAINT "peca_triada_por_fkey" FOREIGN KEY ("triada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peca" ADD CONSTRAINT "peca_conferida_por_fkey" FOREIGN KEY ("conferida_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaria" ADD CONSTRAINT "avaria_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaria" ADD CONSTRAINT "avaria_tipo_avaria_id_fkey" FOREIGN KEY ("tipo_avaria_id") REFERENCES "tipo_avaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaria" ADD CONSTRAINT "avaria_registrada_por_fkey" FOREIGN KEY ("registrada_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaria_foto" ADD CONSTRAINT "avaria_foto_avaria_id_fkey" FOREIGN KEY ("avaria_id") REFERENCES "avaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornada" ADD CONSTRAINT "jornada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornada" ADD CONSTRAINT "jornada_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pausa" ADD CONSTRAINT "pausa_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banco_horas" ADD CONSTRAINT "banco_horas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado" ADD CONSTRAINT "atestado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado" ADD CONSTRAINT "atestado_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atestado_foto" ADD CONSTRAINT "atestado_foto_atestado_id_fkey" FOREIGN KEY ("atestado_id") REFERENCES "atestado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferramenta" ADD CONSTRAINT "ferramenta_tipo_ferramenta_id_fkey" FOREIGN KEY ("tipo_ferramenta_id") REFERENCES "tipo_ferramenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cautela" ADD CONSTRAINT "cautela_ferramenta_id_fkey" FOREIGN KEY ("ferramenta_id") REFERENCES "ferramenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cautela" ADD CONSTRAINT "cautela_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi" ADD CONSTRAINT "epi_tipo_epi_id_fkey" FOREIGN KEY ("tipo_epi_id") REFERENCES "tipo_epi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi" ADD CONSTRAINT "epi_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

