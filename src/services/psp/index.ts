import { PSPProvider } from '@prisma/client';
import { PSPClient } from '../../types';
import { stripeMock } from './stripe.mock';
import { adyenMock } from './adyen.mock';

/**
 * Factory to get the correct PSP client based on the provider
 */
export function getPSPClient(provider: PSPProvider): PSPClient {
  switch (provider) {
    case PSPProvider.STRIPE:
      return stripeMock;
    case PSPProvider.ADYEN:
      return adyenMock;
    default:
      throw new Error(`Unknown PSP provider: ${provider}`);
  }
}

export { stripeMock, adyenMock };
