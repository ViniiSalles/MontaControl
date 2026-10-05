-- Equipes de montadores: atalho do gestor para atribuir várias pessoas ao
-- pedido de uma vez. A atribuição continua por membro em "pedido_montador".
CREATE TABLE "equipe" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipe_membro" (
    "id" SERIAL NOT NULL,
    "equipe_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,

    CONSTRAINT "equipe_membro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipe_nome_key" ON "equipe"("nome");
CREATE UNIQUE INDEX "equipe_membro_equipe_id_usuario_id_key" ON "equipe_membro"("equipe_id", "usuario_id");

ALTER TABLE "equipe_membro" ADD CONSTRAINT "equipe_membro_equipe_id_fkey"
  FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipe_membro" ADD CONSTRAINT "equipe_membro_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
