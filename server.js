// import { SignJWT,importPKCS8 } from 'jose';
// const privateKey = `MC4CAQAwBQYDK2VwBCIEIApExVfp826PW+0UJ2JhD8SB84UTFM8ge42C3Bkwg1bi
// `



// /**
//  * 使用 EdDSA 生成 JWT
//  */
// export async function generateEdDSAJWT(payload, privateKey) {
//   return await new SignJWT(payload)
//     .setProtectedHeader({ alg: 'EdDSA',kid:"K4WMK9MUAF" })
//     .setIssuedAt()
//     .setExpirationTime('24h')
//     .setIssuer('weather')
//     .setAudience('weather-user')
//     .sign(privateKey);
// }


// const myPayload = {
//   sub:"4GKREUNH55",
//   iat:Math.floor(Date.now() / 1000),
//   exp:Math.floor(Date.now() / 1000) + 60 * 60 * 24,
// }
// console.log('myPayload', myPayload);
// const key = await importPKCS8(privateKey, 'EdDSA');

// generateEdDSAJWT(myPayload, key).then((jwt) => {
//   console.log("Generated JWT:", jwt);
// }).catch((error) => {
//   console.error("Error generating JWT:", error);
// });


import {SignJWT, importPKCS8} from "jose";

const YourPrivateKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIApExVfp826PW+0UJ2JhD8SB84UTFM8ge42C3Bkwg1bi
-----END PRIVATE KEY-----
`

importPKCS8(YourPrivateKey, 'EdDSA').then((privateKey) => {
  const customHeader = {
    alg: 'EdDSA',
    kid: 'K4WMK9MUAF'
  }
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 24;
  const customPayload = {
    sub: '4GKREUNH55',
    iat: iat,
    exp: exp
  }
  new SignJWT(customPayload)
    .setProtectedHeader(customHeader)
    .sign(privateKey)
    .then(token => console.log('JWT: ' + token))
}).catch((error) => console.error(error))