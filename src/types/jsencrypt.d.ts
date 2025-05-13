declare module 'jsencrypt' {
  export default class JSEncrypt {
    constructor();
    setPublicKey(publicKey: string): void;
    encrypt(data: string): string | false;
    setPrivateKey(privateKey: string): void;
    decrypt(data: string): string | false;
  }
} 