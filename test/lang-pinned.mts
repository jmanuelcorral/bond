// Preload de `bun test`: fija el idioma de la CLI a español para que las aserciones sobre
// cadenas no dependan del locale del que ejecuta la suite. BOND_LANG puesta fuera gana, así
// que se puede pasar BOND_LANG=en para ver la suite entera en inglés.

process.env.BOND_LANG = process.env.BOND_LANG ?? "es";
