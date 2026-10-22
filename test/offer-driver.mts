// Lanza offerUpdate() en un proceso propio (con su BOND_HOME) para test/offer.test.mts: bun test
// comparte los módulos entre ficheros y BOND_HOME se fija al cargar cli/runtime.mts.
// Uso: bun test/offer-driver.mts '<OfferOptions en JSON, con "answer" en vez de ask>'

import { offerUpdate } from "../cli/update.mts";

const { answer, ...opts } = JSON.parse(process.argv[2] ?? "{}");
const result = await offerUpdate({ ...opts, ask: async () => answer ?? "" });
console.log(`RESULT=${result}`);
