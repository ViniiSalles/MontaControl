import { useEffect, useState } from 'react';

/** Relógio que reage ao passar do tempo: re-renderiza só quem o usa, a cada `intervaloMs`. */
export function useAgora(intervaloMs: number): number {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(intervalo);
  }, [intervaloMs]);

  return agora;
}
