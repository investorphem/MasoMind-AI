import { useEffect, useState } from 'react';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function useMiniPay() {
  const { connect } = useConnect();
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      connect({ connector: injected() });
    }
  }, [connect]);

  return isMiniPay;
}
