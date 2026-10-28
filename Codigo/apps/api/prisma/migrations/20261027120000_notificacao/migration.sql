-- Notificações em tempo real (WebSocket) e centro de notificações: uma linha
-- por destinatário. "chave_origem" identifica o fato gerador e, junto do
-- destinatário, torna a gravação idempotente.
-- Sem GRANT/REVOKE aqui: os privilégios default de anon/authenticated já foram
-- revogados em "revoke_anon_public" (ALTER DEFAULT PRIVILEGES), e valem para
-- as tabelas criadas depois, como nas demais migrações.

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('AVARIA_REPORTADA', 'AVARIA_ATUALIZADA', 'ATESTADO_ENVIADO', 'ATESTADO_VALIDADO', 'ATESTADO_REJEITADO', 'PECA_INCONSISTENTE', 'PONTO_ATRASO_SOLICITADO', 'PONTO_ATRASO_APROVADO', 'PONTO_ATRASO_REJEITADO');

-- CreateTable
CREATE TABLE "notificacao" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "referencia_tipo" TEXT,
    "referencia_id" INTEGER,
    "chave_origem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lida_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacao_usuario_id_lida_created_at_idx" ON "notificacao"("usuario_id", "lida", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_usuario_id_chave_origem_key" ON "notificacao"("usuario_id", "chave_origem");

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
