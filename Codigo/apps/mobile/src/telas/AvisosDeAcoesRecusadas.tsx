import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { useSincronizacao } from '../sincronizacao/SincronizacaoContext';

/**
 * Ações da fila que o servidor recusou depois de o montador já ter saído da
 * tela (ponto, avaria, atestado): a linha foi apagada e só a mensagem fica.
 * Aparece igual em todas as telas que enfileiram algo, até ser dispensada.
 * Precisa estar dentro de `ProvedorSincronizacao`.
 */
export function AvisosDeAcoesRecusadas() {
  const { avisosDescartados, dispensarAvisos } = useSincronizacao();
  if (avisosDescartados.length === 0) return null;

  return (
    <>
      {avisosDescartados.map((mensagem, indice) => (
        <Alerta
          key={`${mensagem}-${indice}`}
          variante="erro"
          titulo="Uma ação não foi sincronizada"
          mensagem={mensagem}
        />
      ))}
      <Botao
        variante="fantasma"
        tamanho={40}
        forma="pilula"
        texto="Dispensar"
        aoPressionar={dispensarAvisos}
      />
    </>
  );
}
