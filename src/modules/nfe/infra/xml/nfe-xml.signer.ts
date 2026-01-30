import * as fs from 'node:fs';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export class NfeXmlSigner {
  constructor(
    private readonly certificadoPfxPath: string,
    private readonly certificadoSenha: string
  ) {}

  sign(xml: string): string {
    const pfxBuffer = fs.readFileSync(this.certificadoPfxPath);
    const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, this.certificadoSenha);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    const certBag = certBags[forge.pki.oids.certBag]?.[0];

    if (!keyBag?.key || !certBag?.cert) {
      throw new Error('Certificado A1 inválido ou não contém chave/certificado.');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    const certificatePem = forge.pki.certificateToPem(certBag.cert);
    const certificateBase64 = certificatePem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\r?\n/g, '')
      .trim();

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      getKeyInfoContent: () =>
        `<X509Data><X509Certificate>${certificateBase64}</X509Certificate></X509Data>`,
    });

    sig.addReference({
      xpath: "//*[local-name(.)='infNFe']",
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });

    sig.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='infNFe']",
        action: 'after',
      },
    });

    return sig.getSignedXml();
  }
}
