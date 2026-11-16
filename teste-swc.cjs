
const net = require("node:net");

try {
  require("./node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node");
  console.log("SUCESSO: SWC carregado.");
} catch (error) {
  console.error("FALHA:", error.code);
  console.error(error.message);
}
