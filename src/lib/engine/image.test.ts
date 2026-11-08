import { expect, it } from 'vitest';
import { bytesToBase64 } from './image';

it('encodes raw bytes as base64, including bytes above 127', () => {
  expect(bytesToBase64(new Uint8Array([]))).toBe('');
  expect(bytesToBase64(new TextEncoder().encode('Volet'))).toBe('Vm9sZXQ=');
  expect(bytesToBase64(new Uint8Array([137, 80, 78, 71, 255, 0]))).toBe(Buffer.from([137, 80, 78, 71, 255, 0]).toString('base64'));
});
