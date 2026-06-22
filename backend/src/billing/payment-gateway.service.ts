import { Injectable } from '@nestjs/common';

/**
 * PLACEHOLDER online payment gateway.
 *
 * Real JazzCash/Stripe integration will replace `createPaymentLink` later.
 * Kept behind the `StorageProvider`-style seam: only this class knows the
 * vendor, so swapping it in is a localised change.
 */
@Injectable()
export class PaymentGatewayService {
  createPaymentLink(invoiceId: string): { url: string; provider: string } {
    return {
      provider: 'mock',
      url: `https://pay.example.com/mock/${invoiceId}`,
    };
  }
}
